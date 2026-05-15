import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage/databaseStorage.ts";
import { upload, processFile, cleanupFile } from "./services/fileProcessor";
import {
  generateFromOllama,
  generateChatFromOllama,
  streamChatFromOllama,
  checkOllamaHealth,
  type OllamaMessage,
} from "./services/Ollama/OllamaService";
import { getActiveProviderName, getProviderRoutingSummary, getResolvedTargetName } from "./core/providers/provider-executor";
import { getActiveProviderDefaultModel, getProviderRuntimeConfig } from "./core/providers/provider-config";
import { buildOllamaPrompt } from "./services/Ollama/OllamaContextBuilder";
import { setupLocalAuth, isAdmin, isAuthenticated } from "./localAuth";
import { ManagerAgent } from "./orchestrator/ManagerAgent";
import { checkTiers, filterOutputForTier3 } from "./middleware/TierEnforcement";
import { logSecurityEvent, getRecentSecurityEvents } from "./services/SecurityAudit";
import { injectMemory } from "./services/MemoryInjector";
import { KnowledgeService } from "./services/KnowledgeService";
import { getFirewallIntegrationStatus } from "./services/FirewallIntegrationService";
import { checkGitHubIntegrationStatus, getGitHubRepoReadout } from "./services/GitHubIntegrationService";
import { getRecentRuntimeEvents, logRuntimeEvent } from "./services/RuntimeLogger";
import { FlowStore } from "./services/FlowStore";
import {
  executeFlowRun,
  approveCurrentStage,
  rejectCurrentStage,
} from "./services/flow/FlowExecutor";
import { registerExecutionRoutes } from "./services/execution/registerExecutionRoutes";
import { registerIntakeRoutes } from "./services/intake/registerIntakeRoutes";
import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import {
  createManagedUser,
  getPublicAdminSettings,
  listManagedUsers,
  loadAdminSettings,
  resetAppSettings,
  updateAppSettings,
  updateIntegrationSettings,
  updateManagedUser,
  updatePersonalizationSettings,
} from "./services/AdminSettingsStore";
import { getUserPersonalization, saveUserPersonalization } from "./services/UserPersonalizationStore";
import {
  assignConversationToProject,
  createProject,
  listProjects,
} from "./services/ProjectFilingStore";
import { HUB_CONFIG_DIR, HUB_LOG_DIR, HUB_SHARED_MEMORY_DIR } from "./utils/repoPaths";

import {
  insertConversationSchema,
  insertProjectMemorySchema,
  insertMessageSchema,
  insertScratchpadMemorySchema,
  insertFileSchema,
  insertSessionSchema,
  users,
} from "../shared/schema";
import { db } from "./db";

let isDatabaseHealthy = false;

const ZED_IDENTITY_PROMPT = [
  "You are ZED, the AI assistant for Zed Hub.",
  "Never describe yourself as 'an agent named Agent' or 'ZED Hub's agent'.",
  "If asked your name, answer simply: 'I am ZED.'",
  "Use any provided memory context as background knowledge when it is relevant.",
  "If the knowledge context already identifies the company, project, brand, or user goals, answer from that context instead of asking broad generic follow-up questions.",
  "When the answer is grounded in known foundation, rules, or project memory, prefer a direct, specific response.",
].join(" ");

export function setDatabaseStatus(status: boolean) {
  isDatabaseHealthy = status;
}

async function ensureSessionUserInDatabase(req: any) {
  if (!db) return;

  const sessionUserId = req.user?.claims?.sub;
  if (!sessionUserId) return;

  const sessionUser = req.session?.user || {};
  const claims = req.user?.claims || {};

  // The users table has a unique constraint on email; onConflictDoUpdate
  // here only keys on id, so a row colliding on email (different id, same
  // email) would throw a unique violation and crash any caller. Wrap in
  // try/catch so this never breaks /api/conversations creation — the
  // foreign key only requires the user row exists, not that we just
  // freshly upserted it. Log the failure so we still see when it happens.
  try {
    await db
      .insert(users)
      .values({
        id: sessionUserId,
        email: sessionUser.email || claims.email || null,
        firstName: sessionUser.firstName || claims.first_name || claims.firstName || null,
        lastName: sessionUser.lastName || claims.last_name || claims.lastName || null,
        profileImageUrl:
          sessionUser.profileImageUrl ||
          claims.profile_image_url ||
          claims.profileImageUrl ||
          claims.picture ||
          null,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: sessionUser.email || claims.email || null,
          firstName: sessionUser.firstName || claims.first_name || claims.firstName || null,
          lastName: sessionUser.lastName || claims.last_name || claims.lastName || null,
          profileImageUrl:
            sessionUser.profileImageUrl ||
            claims.profile_image_url ||
            claims.profileImageUrl ||
            claims.picture ||
            null,
          updatedAt: new Date(),
        },
      });
  } catch (err: any) {
    // DrizzleQueryError wraps the real postgres error in .cause. Pull it
    // out so we see the actual code (e.g. 23505 = unique_violation) and
    // constraint name instead of just the SQL text.
    const cause: any = err?.cause || err?.original || err;
    void logRuntimeEvent({
      level: "warn",
      source: "server",
      event: "user.upsert.failed",
      detail: cause?.message || err?.message || String(err),
      context: {
        userId: sessionUserId,
        email: sessionUser.email || claims.email || null,
        errorKind: err?.constructor?.name,
        pgCode: cause?.code,
        pgConstraint: cause?.constraint,
        pgDetail: cause?.detail,
        pgTable: cause?.table,
      },
    });
  }
}

async function requireConversation(req: any, res: Response) {
  const conversation = await storage.getConversation(req.params.id);
  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return null;
  }
  return conversation;
}

export async function registerRoutes(app: Express): Promise<Server> {
  await setupLocalAuth(app);

  app.use(async (req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      const status = res.statusCode;
      if (status >= 400) {
        void logRuntimeEvent({
          level: status >= 500 ? "error" : "warn",
          source: "server",
          event: "http.response",
          detail: `${req.method} ${req.originalUrl} -> ${status}`,
          context: {
            method: req.method,
            url: req.originalUrl,
            status,
            durationMs: Date.now() - startedAt,
          },
        });
      }
    });
    next();
  });

  app.get("/api/me", (req, res) => {
    const session = (req as any).session;
    if (session?.userId && session?.user) {
      void getUserPersonalization(session.userId)
        .then((personalization) => {
          res.json({
            user: {
              ...session.user,
              displayName: personalization.displayName,
              personalization,
            },
          });
        })
        .catch(() => {
          res.json({ user: session.user });
        });
      return;
    }
    return res.json({ user: null });
  });

  app.get("/api/settings/personalization", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const personalization = await getUserPersonalization(userId);
      res.json(personalization);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch personalization" });
    }
  });

  app.put("/api/settings/personalization", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const personalization = await saveUserPersonalization(userId, req.body || {});
      res.json(personalization);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update personalization" });
    }
  });

  app.get("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversations = await storage.getConversationsByUser(userId);
      res.json(conversations);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.post("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await ensureSessionUserInDatabase(req);
      const conversation = await storage.createConversation(
        insertConversationSchema.parse({
          userId,
          title: req.body.title || "New Chat",
          mode: req.body.mode || "chat",
          model: "ollama",
          isActive: true,
        })
      );
      try {
        await storage.createSession(
          insertSessionSchema.parse({ conversationId: conversation.id, userId })
        );
      } catch (sessionError) {
        console.warn("[Conversations] Session creation failed (non-fatal):", sessionError);
      }
      res.json(conversation);
    } catch (err: any) {
      const detail = err?.message || String(err);
      console.error("[POST /api/conversations] failed:", err);
      await logRuntimeEvent({
        level: "error",
        source: "server",
        event: "conversation.create.failed",
        detail,
        context: {
          userId: req.user?.claims?.sub,
          mode: req.body?.mode,
          errorKind: err?.constructor?.name,
          stack: err?.stack?.split("\n").slice(0, 4).join(" | "),
        },
      });
      res.status(500).json({ error: detail || "Failed to create conversation" });
    }
  });

  app.get("/api/projects", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const projects = await listProjects(userId);
      res.json({ projects });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch projects" });
    }
  });

  app.get("/api/knowledge/context", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const query = String(req.query.q || "").trim();
      if (!query) return res.status(400).json({ error: "Query required" });

      const hubMemory = await injectMemory("KnowledgeContext", { includeFoundation: true }).catch(() => ({ formatted: "" }));
      const knowledge = await KnowledgeService.buildContext({
        userId,
        query,
        conversationId: typeof req.query.conversationId === "string" ? req.query.conversationId : undefined,
        lane: "admin",
        injectedMemory: hubMemory.formatted,
        includeAdminFoundation: true,
      });

      res.json(knowledge);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to build knowledge context" });
    }
  });

  app.get("/api/knowledge/search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const query = String(req.query.q || "").trim();
      if (!query) return res.status(400).json({ error: "Query required" });

      const results = await KnowledgeService.search({
        userId,
        query,
        conversationId: typeof req.query.conversationId === "string" ? req.query.conversationId : undefined,
      });

      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Knowledge search failed" });
    }
  });

  app.get("/api/knowledge/project-memory", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { MemoryService } = await import("./services/memoryService");
      const items = await MemoryService.getProjectMemory(userId);
      res.json({ items });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch project memory" });
    }
  });

  app.get("/api/knowledge/personal-base", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { MemoryService } = await import("./services/memoryService");
      const items = await MemoryService.getProjectMemory(userId);
      const item =
        items.find((entry) => (entry.type || "").toLowerCase() === "profile" && entry.isActive !== false) ||
        items.find((entry) => (entry.type || "").toLowerCase() === "profile") ||
        null;
      res.json({ item });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch personal base memory" });
    }
  });

  app.get("/api/knowledge/core-memory", isAdmin, async (_req: any, res) => {
    try {
      const { MemoryService } = await import("./services/memoryService");
      const items = await MemoryService.getAllCoreMemory();
      res.json({ items });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch core memory" });
    }
  });

  app.put("/api/knowledge/core-memory/:key", isAdmin, async (req: any, res) => {
    try {
      const { MemoryService } = await import("./services/memoryService");
      const item = await MemoryService.setCoreMemory({
        key: req.params.key,
        value: String(req.body?.value || ""),
        description: req.body?.description || "",
        adminOnly: req.body?.adminOnly ?? true,
      });
      res.json({ item });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update core memory" });
    }
  });

  app.post("/api/knowledge/project-memory", isAuthenticated, async (req: any, res) => {
    try {
      await ensureSessionUserInDatabase(req);
      const userId = req.user.claims.sub;
      const { MemoryService } = await import("./services/memoryService");
      const item = await MemoryService.createProjectMemory(
        insertProjectMemorySchema.parse({
          userId,
          name: req.body?.name || "Untitled knowledge item",
          description: req.body?.description || "",
          content: req.body?.content || "",
          type: req.body?.type || "context",
          isActive: req.body?.isActive ?? true,
        }),
      );
      res.json({ item });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create project memory" });
    }
  });

  app.put("/api/knowledge/personal-base", isAuthenticated, async (req: any, res) => {
    try {
      await ensureSessionUserInDatabase(req);
      const userId = req.user.claims.sub;
      const { MemoryService } = await import("./services/memoryService");
      const existing = (await MemoryService.getProjectMemory(userId)).find(
        (entry) => (entry.type || "").toLowerCase() === "profile",
      );

      const payload = {
        userId,
        name: req.body?.name || "Personal Base Memory",
        description: req.body?.description || "User-owned profile, preferences, goals, and working context.",
        content: req.body?.content || "",
        type: "profile",
        isActive: req.body?.isActive ?? true,
      };

      const item = existing
        ? await MemoryService.updateProjectMemory(existing.id, payload)
        : await MemoryService.createProjectMemory(insertProjectMemorySchema.parse(payload));

      res.json({ item });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to save personal base memory" });
    }
  });

  app.patch("/api/knowledge/project-memory/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { MemoryService } = await import("./services/memoryService");
      const item = await MemoryService.updateProjectMemory(req.params.id, req.body || {});
      res.json({ item });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update project memory" });
    }
  });

  app.delete("/api/knowledge/project-memory/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { MemoryService } = await import("./services/memoryService");
      const success = await MemoryService.deleteProjectMemory(req.params.id);
      res.json({ success });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to delete project memory" });
    }
  });

  app.get("/api/knowledge/scratchpad", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { MemoryService } = await import("./services/memoryService");
      const items = await MemoryService.getScratchpadMemory(userId);
      res.json({ items });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch scratchpad memory" });
    }
  });

  app.post("/api/knowledge/scratchpad", isAuthenticated, async (req: any, res) => {
    try {
      await ensureSessionUserInDatabase(req);
      const userId = req.user.claims.sub;
      const { MemoryService } = await import("./services/memoryService");
      const item = await MemoryService.createScratchpadMemory(
        insertScratchpadMemorySchema.parse({
          userId,
          conversationId: req.body?.conversationId || null,
          content: req.body?.content || "",
          tags: Array.isArray(req.body?.tags) ? req.body.tags : [],
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        }),
      );
      res.json({ item });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create scratchpad memory" });
    }
  });

  app.delete("/api/knowledge/scratchpad/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { MemoryService } = await import("./services/memoryService");
      const success = await MemoryService.deleteScratchpadMemory(req.params.id);
      res.json({ success });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to delete scratchpad memory" });
    }
  });

  app.post("/api/projects", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const project = await createProject(userId, req.body?.name || "");
      res.json({ project });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create project" });
    }
  });

  app.put("/api/conversations/:id/project", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const projects = await assignConversationToProject(userId, req.params.id, req.body?.projectId ?? null);
      res.json({ projects });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to assign conversation to project" });
    }
  });

  app.get("/api/conversations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) return res.status(404).json({ error: "Not found" });
      res.json(conversation);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.patch("/api/conversations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const updated = await storage.updateConversation(req.params.id, req.body);
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update conversation" });
    }
  });

  app.delete("/api/conversations/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteConversation(req.params.id);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  app.delete("/api/conversations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || "user_001";
      const all = await storage.getConversationsByUser(userId);
      let deleted = 0;
      for (const conv of all) {
        try { await storage.deleteConversation(conv.id); deleted++; } catch {}
      }
      await logSecurityEvent({ type: "data.clear_all", userId, detail: `Cleared ${deleted} conversations` });
      res.json({ success: true, deleted });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const conversation = await requireConversation(req, res);
      if (!conversation) return;
      const messages = await storage.getMessagesByConversation(req.params.id);
      res.json(messages);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const conversationId = req.params.id;
      const { content, stream = true } = req.body;
      const conversation = await requireConversation(req, res);
      if (!conversation) return;

      if (!content) return res.status(400).json({ error: "Message required" });

      const tierCheck = await checkTiers(content, req.user?.claims?.sub || "unknown", req.ip || "");
      if (tierCheck.blocked) {
        const blockedMsg = await storage.createMessage(
          insertMessageSchema.parse({ conversationId, role: "assistant", content: tierCheck.reply })
        );
        if (stream) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          res.write(`data: ${JSON.stringify({ type: "done", message: blockedMsg })}\n\n`);
          res.end();
        } else {
          res.json({ aiMessage: blockedMsg });
        }
        return;
      }

      const userMessage = await storage.createMessage(
        insertMessageSchema.parse({ conversationId, role: "user", content })
      );

      const history = await storage.getMessagesByConversation(conversationId);
      const ollamaMessages: OllamaMessage[] = history
        .slice(-20)
        .map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content }));

      let systemPrompt: string | undefined;
      try {
        const mem = await storage.getCoreMemoryByKey("system_prompt");
        if (mem) systemPrompt = mem.value;
      } catch {}

      try {
        const isAdmin = !!req.user?.claims?.isAdmin;
        const memCtx = await injectMemory("ChatMode", { includeFoundation: isAdmin });
        const knowledge = await KnowledgeService.buildContext({
          userId: req.user.claims.sub,
          query: content,
          conversationId,
          lane: "chat",
          injectedMemory: memCtx.formatted,
          includeAdminFoundation: isAdmin,
        });
        systemPrompt = systemPrompt
          ? `${ZED_IDENTITY_PROMPT}\n\n${systemPrompt}\n\n${knowledge.prompt}`
          : `${ZED_IDENTITY_PROMPT}\n\n${knowledge.prompt}`;
      } catch (memErr) {
        console.warn("[SSE] Memory injection failed (non-fatal):", memErr);
      }

      if (!systemPrompt) {
        systemPrompt = ZED_IDENTITY_PROMPT;
      }

      if (stream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");

        let fullResponse = "";

        res.write(`data: ${JSON.stringify({ type: "user_message", message: userMessage })}\n\n`);

        await streamChatFromOllama(
          ollamaMessages,
          systemPrompt,
          (token) => {
            fullResponse += token;
            res.write(`data: ${JSON.stringify({ type: "token", token })}\n\n`);
          },
          async () => {
            const aiMessage = await storage.createMessage(
              insertMessageSchema.parse({
                conversationId,
                role: "assistant",
                content: fullResponse || "(no response)",
              })
            );
            await KnowledgeService.persistInteraction({
              userId: req.user.claims.sub,
              conversationId,
              userContent: content,
              assistantContent: aiMessage.content,
              tags: ["chat", "conversation"],
            });
            res.write(`data: ${JSON.stringify({ type: "done", message: aiMessage })}\n\n`);
            res.end();
          },
          async (err) => {
            console.error("[SSE] stream error:", err);
            const provider = getActiveProviderName({ lane: "chat" });
            const target = getResolvedTargetName({ lane: "chat" });
            const isConnRefused =
              err.message?.includes("ECONNREFUSED") || err.message?.includes("fetch failed");
            const fallback = isConnRefused
              ? `Provider '${provider}' is not reachable at ${target}. Verify the URL, network access, and that the upstream service is running.`
              : `AI model error (${provider} @ ${target}): ${err.message}`;
            const aiMessage = await storage.createMessage(
              insertMessageSchema.parse({ conversationId, role: "assistant", content: fallback })
            );
            res.write(`data: ${JSON.stringify({ type: "error", message: aiMessage, error: err.message })}\n\n`);
            res.end();
          },
          { lane: "chat" },
        );
      } else {
        let aiText: string;
        try {
          aiText = await generateChatFromOllama(ollamaMessages, systemPrompt, { lane: "chat" });
        } catch (err: any) {
          aiText = `AI model error: ${err?.message || "unknown error"}`;
        }
        const aiMessage = await storage.createMessage(
          insertMessageSchema.parse({ conversationId, role: "assistant", content: aiText })
        );
        await KnowledgeService.persistInteraction({
          userId: req.user.claims.sub,
          conversationId,
          userContent: content,
          assistantContent: aiMessage.content,
          tags: ["chat", "conversation"],
        });
        res.json({ userMessage, aiMessage });
      }
    } catch (error) {
      console.error("[Messages] Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Message processing failed" });
      }
    }
  });

  app.get("/api/conversations/:id/files", isAuthenticated, async (req: any, res) => {
    try {
      const files = await storage.getFilesByConversation(req.params.id);
      res.json(files);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch files" });
    }
  });

  app.post("/api/conversations/:id/upload", isAuthenticated, upload.array("files"), async (req: any, res) => {
    try {
      const conversationId = req.params.id;
      const files = req.files as any[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const processedFiles = [];

      for (const file of files) {
        try {
          const processed = await processFile(file.path, file.mimetype);
          const saved = await storage.createFile(
            insertFileSchema.parse({
              conversationId,
              fileName: file.filename,
              originalName: file.originalname,
              mimeType: file.mimetype,
              size: file.size,
              status: processed.error ? "error" : "completed",
              extractedContent: processed.extractedContent,
              analysis: processed.analysis,
            })
          );
          processedFiles.push(saved);
        } catch (err) {
          console.error("File processing error:", err);
        }
        await cleanupFile(file.path);
      }

      res.json({ files: processedFiles });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  app.post("/api/orchestrate", isAuthenticated, async (req: any, res) => {
    try {
      const { message, conversationId, targetAgent } = req.body;
      const userId = req.user.claims.sub;

      if (!message) return res.status(400).json({ error: "Message required" });

      if (conversationId) {
        await storage.createMessage(
          insertMessageSchema.parse({ conversationId, role: "user", content: message })
        );
      }

      const ip = req.ip || "";
      const knowledge = await KnowledgeService.buildContext({
        userId,
        query: message,
        conversationId,
        lane: "manager",
        injectedMemory: (
          await injectMemory("ManagerAgent", { includeFoundation: !!req.user?.claims?.isAdmin }).catch(() => ({ formatted: "" }))
        ).formatted,
        includeAdminFoundation: !!req.user?.claims?.isAdmin,
      });

      const response = await ManagerAgent.route({
        userId,
        message,
        conversationId,
        ip,
        targetAgent,
        context: {
          ...(req.body?.context || {}),
          knowledgePrompt: knowledge.prompt,
          isAdmin: Boolean(req.user?.claims?.isAdmin),
        },
      });

      if (conversationId) {
        await storage.createMessage(
          insertMessageSchema.parse({
            conversationId,
            role: "assistant",
            content: response.reply,
            metadata: { agent: response.agent, requiresApproval: response.requiresApproval },
          })
        );
      }

      res.json(response);
    } catch (error) {
      console.error("[Orchestrator] Error:", error);
      const detail =
        error instanceof Error && error.message
          ? error.message
          : "The selected agent is temporarily unavailable.";
      res.json({
        error: "Orchestration failed",
        reply: `Agent lane unavailable right now: ${detail}`,
        agent: "ManagerAgent",
      });
    }
  });

  app.get("/api/orchestrate/status", async (_req, res) => {
    const settings = await getPublicAdminSettings();
    const normalizedAgents = settings.agents.map((agent) => {
      if (agent.key === "BusinessManagerAgent") {
        const isBusinessReady = settings.integrations.businessOperations.enabled;
        return {
          ...agent,
          status: isBusinessReady ? "active" : "planned",
          description: isBusinessReady
            ? "Business operations lane is enabled for commerce, property, credit, and planning workflows."
            : agent.description,
        };
      }
      return agent;
    });
    res.json({
      orchestrator: "ManagerAgent",
      active_agents: normalizedAgents.filter((agent) => agent.status === "active"),
      planned_agents: normalizedAgents.filter((agent) => agent.status === "planned"),
      integrations: settings.integrations,
      status: "operational",
    });
  });

  app.get("/api/system/runtime", isAuthenticated, async (_req, res) => {
    try {
      const config = getProviderRuntimeConfig();
      const target = getResolvedTargetName({ lane: "chat" });
      const provider = getActiveProviderName({ lane: "chat" });
      // probeUrl must reflect the ACTIVE provider's base URL, not always
      // the Ollama URL — otherwise the admin Provider Routing card shows
      // "localhost:11434" even when chat actually goes to Lightning/OpenAI.
      const probeUrl =
        provider === "openai"
          ? config.openai.baseUrl
          : provider === "claude"
            ? config.claude.baseUrl
            : provider === "claw-temp"
              ? config.clawTemp.baseUrl
              : config.ollama.baseUrl;

      const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(probeUrl);
      const targetHost = (() => {
        try {
          return new URL(probeUrl).host;
        } catch {
          return probeUrl;
        }
      })();
      const locationLabel = isLocal
        ? "Local"
        : /lightning/i.test(probeUrl)
          ? "Lightning"
          : targetHost || "Remote";

      const ollamaHealth = await checkOllamaHealth();

      const model = getActiveProviderDefaultModel(config);

      res.json({
        provider,
        model,
        target,
        target_url: probeUrl,
        location_label: locationLabel,
        is_local: isLocal,
        status: ollamaHealth.status,
        available_models: ollamaHealth.models,
        lane_models: {
          chat: config.laneModels.chat || "",
          manager: config.laneModels.manager || "",
          operations: config.laneModels.operations || "",
          research: config.laneModels.research || "",
          business: config.laneModels.business || "",
          finance: config.laneModels.finance || "",
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to read runtime status" });
    }
  });

  app.post("/api/voice/transcribe", isAuthenticated, async (req: any, res) => {
    res.json({
      transcript: "",
      note: "Server-side transcription requires Whisper. Using browser Speech API instead.",
    });
  });

  app.get("/api/admin/system-status", isAdmin, async (_req, res) => {
    const ollama = await checkOllamaHealth();
    const providerConfig = getProviderRuntimeConfig();
    const activeProvider = getActiveProviderName({ lane: "chat" });
    const routingSummary = getProviderRoutingSummary();
    const settings = await getPublicAdminSettings();
    const github = await checkGitHubIntegrationStatus();
    const firewall = await getFirewallIntegrationStatus();
    const normalizedAgents = settings.agents.map((agent) => {
      if (agent.key === "BusinessManagerAgent") {
        const isBusinessReady = settings.integrations.businessOperations.enabled;
        return {
          ...agent,
          status: isBusinessReady ? "active" : "planned",
          description: isBusinessReady
            ? "Business Manager lane is enabled through Business Operations."
            : agent.description,
        };
      }
      return agent;
    });
    res.json({
      system: "ZED",
      ollama: { status: ollama.status, models: ollama.models, provider: ollama.provider || "ollama" },
      aiHost: {
        provider: activeProvider,
        target: getResolvedTargetName({ lane: "chat" }),
        configuredModel:
          providerConfig.activeModel || getActiveProviderDefaultModel(providerConfig),
        remoteMode: providerConfig.clawTemp.mode,
      },
      providerRouting: routingSummary.routing,
      database: isDatabaseHealthy ? "connected" : "offline",
      orchestrator: {
        status: "operational",
        active: normalizedAgents.filter((agent) => agent.status === "active"),
        planned: normalizedAgents.filter((agent) => agent.status === "planned"),
      },
      integrations: settings.integrations,
      github,
      firewall,
      auth: {
        adminUsername: settings.auth.adminUsername,
        requireSecureCookies: settings.auth.requireSecureCookies,
      },
    });
  });

  app.get("/api/admin/knowledge/overview", isAdmin, async (_req, res) => {
    try {
      const settings = await loadAdminSettings();
      const defaultUserId = settings.users?.[0]?.id || "admin-user";
      const { MemoryService } = await import("./services/memoryService");
      const [core, project, scratchpad] = await Promise.all([
        MemoryService.getAllCoreMemory(),
        MemoryService.getProjectMemory(defaultUserId).catch(() => []),
        MemoryService.getScratchpadMemory(defaultUserId).catch(() => []),
      ]);

      res.json({
        coreCount: core.length,
        projectCount: project.length,
        scratchpadCount: scratchpad.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to load knowledge overview" });
    }
  });

  app.post("/api/admin/ai-host/test", isAdmin, async (_req, res) => {
    try {
      const health = await checkOllamaHealth();
      const provider = getActiveProviderName({ lane: "chat" });
      const target = getResolvedTargetName({ lane: "chat" });
      const providerConfig = getProviderRuntimeConfig();
      const model =
        providerConfig.activeModel || getActiveProviderDefaultModel(providerConfig);

      let chatStatus: "ok" | "error" = "ok";
      let reply = "";
      let error = "";
      let errorKind = "";
      const startedAt = Date.now();

      try {
        reply = await generateChatFromOllama(
          [{ role: "user", content: "Reply with READY only." }],
          undefined,
          { lane: "manager" },
        );
      } catch (chatError: any) {
        chatStatus = "error";
        const message =
          (typeof chatError?.message === "string" && chatError.message) ||
          (typeof chatError === "string" && chatError) ||
          "";
        const constructor = chatError?.constructor?.name || "Error";
        error =
          message ||
          (() => {
            try {
              return JSON.stringify(chatError);
            } catch {
              return String(chatError);
            }
          })();
        errorKind = constructor;
        await logRuntimeEvent({
          level: "error",
          source: "server",
          event: "admin.ai_host.test_failed",
          detail: error,
          context: { provider, target, model, kind: errorKind },
        });
      }

      res.json({
        provider,
        target,
        model,
        elapsedMs: Date.now() - startedAt,
        health,
        chat: {
          status: chatStatus,
          reply,
          error,
          errorKind,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        error:
          error?.message ||
          (() => {
            try {
              return JSON.stringify(error);
            } catch {
              return String(error);
            }
          })(),
      });
    }
  });

  app.get("/api/admin/settings", isAdmin, async (_req, res) => {
    const settings = await getPublicAdminSettings();
    res.json(settings);
  });

  app.put("/api/admin/settings/app", isAdmin, async (req, res) => {
    try {
      const appSettings = await updateAppSettings(req.body || {});
      res.json(appSettings);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update app settings" });
    }
  });

  app.post("/api/admin/settings/app/reset", isAdmin, async (_req, res) => {
    try {
      const settings = await resetAppSettings();
      res.json(settings);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to reset app settings" });
    }
  });

  app.put("/api/admin/settings/personalization", isAdmin, async (req, res) => {
    try {
      const personalization = await updatePersonalizationSettings(req.body || {});
      res.json(personalization);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update personalization" });
    }
  });

  app.put("/api/admin/settings/integrations", isAdmin, async (req, res) => {
    try {
      await updateIntegrationSettings(req.body || {});
      const settings = await getPublicAdminSettings();
      res.json(settings.integrations);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update integrations" });
    }
  });

  app.get("/api/admin/integrations/github/status", isAdmin, async (_req, res) => {
    const status = await checkGitHubIntegrationStatus();
    res.json(status);
  });

  app.get("/api/admin/integrations/github/readout", isAdmin, async (_req, res) => {
    const readout = await getGitHubRepoReadout();
    res.json(readout);
  });

  app.get("/api/admin/integrations/firewall/status", isAdmin, async (_req, res) => {
    const status = await getFirewallIntegrationStatus();
    res.json(status);
  });

  app.get("/api/admin/users", isAdmin, async (_req, res) => {
    const users = await listManagedUsers();
    res.json({ users });
  });

  app.post("/api/admin/users", isAdmin, async (req, res) => {
    try {
      const users = await createManagedUser(req.body || {});
      res.json({ users });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create user" });
    }
  });

  app.patch("/api/admin/users/:id", isAdmin, async (req, res) => {
    try {
      const users = await updateManagedUser(req.params.id, req.body || {});
      res.json({ users });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update user" });
    }
  });

  app.get("/api/admin/ruleset", isAdmin, async (_req, res) => {
    const files = ["personality.yaml", "security.yaml", "parameters.yaml", "access.yaml"];
    const ruleset: Record<string, string> = {};
    for (const f of files) {
      try {
        ruleset[f] = await fs.readFile(path.join(HUB_CONFIG_DIR, f), "utf-8");
      } catch {
        ruleset[f] = "";
      }
    }
    res.json(ruleset);
  });

  app.get("/api/admin/provider-diagnostics", isAdmin, async (_req, res) => {
    const providerConfig = getProviderRuntimeConfig();
    const health = await checkOllamaHealth();
    const activeProvider = getActiveProviderName({ lane: "chat" });
    const routingSummary = getProviderRoutingSummary();
    const defaultModel = getActiveProviderDefaultModel(providerConfig);
    const target = getResolvedTargetName({ lane: "chat" });

    res.json({
      activeProvider,
      health,
      config: {
        defaultModel,
        target,
        ollamaBaseUrl: providerConfig.ollama.baseUrl,
        clawBaseUrl: providerConfig.clawTemp.baseUrl,
        clawMode: providerConfig.clawTemp.mode,
        openaiConfigured: Boolean(providerConfig.openai.apiKey),
        claudeConfigured: Boolean(providerConfig.claude.apiKey),
      },
      laneModels: {
        chat: providerConfig.laneModels.chat || "",
        manager: providerConfig.laneModels.manager || "",
        operations: providerConfig.laneModels.operations || "",
        research: providerConfig.laneModels.research || "",
        business: providerConfig.laneModels.business || "",
        finance: providerConfig.laneModels.finance || "",
      },
      routing: routingSummary.routing,
    });
  });

  app.get("/api/admin/flows", isAdmin, async (req: any, res) => {
    const includeArchived = String(req.query.includeArchived || "") === "true";
    const flows = await FlowStore.listDefinitions({ includeArchived });
    res.json({ flows });
  });

  app.get("/api/admin/flows/:id", isAdmin, async (req, res) => {
    const flow = await FlowStore.getDefinition(req.params.id);
    if (!flow) return res.status(404).json({ error: "Not found" });
    res.json(flow);
  });

  app.post("/api/admin/flows", isAdmin, async (req, res) => {
    try {
      const flow = await FlowStore.createDefinition(req.body);
      res.json(flow);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Failed to create flow" });
    }
  });

  app.put("/api/admin/flows/:id", isAdmin, async (req, res) => {
    const flow = await FlowStore.updateDefinition(req.params.id, req.body);
    if (!flow) return res.status(404).json({ error: "Not found" });
    res.json(flow);
  });

  app.post("/api/admin/flows/:id/publish", isAdmin, async (req, res) => {
    const flow = await FlowStore.publishDefinition(req.params.id);
    if (!flow) return res.status(404).json({ error: "Not found" });
    res.json(flow);
  });

  app.post("/api/admin/flows/:id/archive", isAdmin, async (req, res) => {
    const flow = await FlowStore.archiveDefinition(req.params.id);
    if (!flow) return res.status(404).json({ error: "Not found" });
    res.json(flow);
  });

  app.post("/api/admin/flows/:id/duplicate", isAdmin, async (req, res) => {
    const flow = await FlowStore.duplicateDefinition(req.params.id);
    if (!flow) return res.status(404).json({ error: "Not found" });
    res.json(flow);
  });

  app.get("/api/flows", isAuthenticated, async (_req, res) => {
    const flows = await FlowStore.listPublished();
    res.json({
      flows: flows.map((f) => ({
        id: f.id,
        slug: f.slug,
        name: f.name,
        category: f.category,
        userFacingLabel: f.userFacingLabel,
        userFacingBlurb: f.userFacingBlurb,
        icon: f.icon,
        stageCount: f.stages.length,
        agents: f.agents,
      })),
    });
  });

  // ⚠️ /api/flows/runs and /api/flows/runs/:runId MUST be registered
  // before /api/flows/:id, otherwise Express matches "runs" as the :id
  // parameter and the runs list 404s.
  app.get("/api/flows/runs", isAuthenticated, async (req: any, res) => {
    const runs = await FlowStore.listRuns({
      userId: req.user?.claims?.sub,
      limit: 50,
    });
    res.json({ runs });
  });

  app.get("/api/flows/runs/:runId", isAuthenticated, async (req, res) => {
    const run = await FlowStore.getRun(req.params.runId);
    if (!run) return res.status(404).json({ error: "Not found" });
    res.json(run);
  });

  app.get("/api/flows/:id", isAuthenticated, async (req, res) => {
    const flow = await FlowStore.getDefinition(req.params.id);
    if (!flow || flow.status !== "published") {
      return res.status(404).json({ error: "Not found" });
    }
    res.json(flow);
  });

  app.post("/api/flows/:id/run", isAuthenticated, async (req: any, res) => {
    const flow = await FlowStore.getDefinition(req.params.id);
    if (!flow || flow.status !== "published") {
      return res.status(404).json({ error: "Not found" });
    }
    const run = await FlowStore.startRun({
      flow,
      userId: req.user?.claims?.sub || "anonymous",
      conversationId: req.body?.conversationId,
      context: req.body?.context,
    });
    // Kick off async execution. Don't block the response — the UI will
    // poll the run detail endpoint to observe progress.
    void executeFlowRun(run.id);
    res.json(run);
  });

  app.post("/api/flows/runs/:runId/approve", isAuthenticated, async (req, res) => {
    const run = await approveCurrentStage(req.params.runId, req.body?.note);
    if (!run) return res.status(404).json({ error: "Run not found or not pending approval" });
    res.json(run);
  });

  app.post("/api/flows/runs/:runId/reject", isAuthenticated, async (req, res) => {
    const run = await rejectCurrentStage(req.params.runId, req.body?.reason);
    if (!run) return res.status(404).json({ error: "Run not found or not pending approval" });
    res.json(run);
  });

  app.post("/api/flows/runs/:runId/resume", isAuthenticated, async (req, res) => {
    // Manual nudge if a run got stuck (e.g. process restarted mid-execution).
    const run = await FlowStore.getRun(req.params.runId);
    if (!run) return res.status(404).json({ error: "Not found" });
    void executeFlowRun(req.params.runId);
    res.json({ ok: true, runId: req.params.runId });
  });

  app.get("/api/admin/env-validate", isAdmin, async (_req, res) => {
    type Severity = "ok" | "warn" | "error";
    interface EnvCheck {
      name: string;
      severity: Severity;
      message: string;
      hint?: string;
    }
    const checks: EnvCheck[] = [];
    const env = process.env;

    const trimmed = (k: string) => (env[k] ?? "").trim();
    const present = (k: string) => trimmed(k).length > 0;

    const provider = (env.MODEL_PROVIDER || "").trim().toLowerCase();
    if (!provider) {
      checks.push({
        name: "MODEL_PROVIDER",
        severity: "error",
        message: "Not set. Active provider cannot be determined.",
        hint: 'Set to one of: "openai", "claude", "ollama", "claw-temp".',
      });
    } else if (!["openai", "claude", "ollama", "claw-temp"].includes(provider)) {
      checks.push({
        name: "MODEL_PROVIDER",
        severity: "error",
        message: `Unknown value "${provider}".`,
        hint: 'Must be one of: "openai", "claude", "ollama", "claw-temp".',
      });
    } else {
      checks.push({
        name: "MODEL_PROVIDER",
        severity: "ok",
        message: `Active provider is "${provider}".`,
      });
    }

    function checkUrl(name: string, expectedSuffix?: string) {
      const raw = trimmed(name);
      if (!raw) return null as EnvCheck | null;
      const malformedChars = /[<>"`\s]/;
      if (malformedChars.test(raw)) {
        return {
          name,
          severity: "error" as Severity,
          message: `Contains illegal characters (one of: < > " \` whitespace). Likely a copy-paste mistake.`,
          hint: "Remove any angle brackets / quotes; the value should be the raw URL only.",
        };
      }
      let url: URL;
      try {
        url = new URL(raw);
      } catch {
        return {
          name,
          severity: "error" as Severity,
          message: `"${raw.slice(0, 80)}" is not a valid URL.`,
        };
      }
      if (!["http:", "https:"].includes(url.protocol)) {
        return {
          name,
          severity: "error" as Severity,
          message: `Expected http(s) but got ${url.protocol}.`,
        };
      }
      if (raw.endsWith("/")) {
        return {
          name,
          severity: "warn" as Severity,
          message: "URL has a trailing slash; some gateways double-up paths.",
          hint: "Remove the trailing slash.",
        };
      }
      if (expectedSuffix && !raw.toLowerCase().endsWith(expectedSuffix.toLowerCase())) {
        return {
          name,
          severity: "warn" as Severity,
          message: `Doesn't end in "${expectedSuffix}". Most OpenAI-compatible providers expect a base URL ending there.`,
          hint: `Try ${raw.replace(/\/+$/, "")}${expectedSuffix} unless your provider documents a different path.`,
        };
      }
      return {
        name,
        severity: "ok" as Severity,
        message: `${url.host}${url.pathname || ""} — looks well-formed.`,
      };
    }

    if (provider === "openai") {
      if (!present("OPENAI_API_KEY")) {
        checks.push({
          name: "OPENAI_API_KEY",
          severity: "error",
          message: "Required when MODEL_PROVIDER=openai but not set.",
        });
      } else {
        checks.push({
          name: "OPENAI_API_KEY",
          severity: "ok",
          message: `Set (length ${trimmed("OPENAI_API_KEY").length}).`,
        });
      }
      const urlCheck = checkUrl("OPENAI_BASE_URL", "/v1");
      if (urlCheck) checks.push(urlCheck);
      else
        checks.push({
          name: "OPENAI_BASE_URL",
          severity: "warn",
          message: "Not set; falling back to https://api.openai.com/v1.",
          hint: "Set explicitly when using a non-OpenAI gateway like Lightning AI.",
        });
      if (!present("OPENAI_MODEL") && !present("MODEL_NAME")) {
        checks.push({
          name: "OPENAI_MODEL",
          severity: "warn",
          message: "Not set. Default model will be used (gpt-4o-mini).",
          hint: "Set OPENAI_MODEL to your gateway's model identifier.",
        });
      } else {
        checks.push({
          name: "OPENAI_MODEL",
          severity: "ok",
          message: `Default model: ${trimmed("OPENAI_MODEL") || trimmed("MODEL_NAME")}.`,
        });
      }
    }

    if (provider === "claude") {
      if (!present("CLAUDE_API_KEY") && !present("ANTHROPIC_API_KEY")) {
        checks.push({
          name: "CLAUDE_API_KEY",
          severity: "error",
          message: "Required when MODEL_PROVIDER=claude but neither CLAUDE_API_KEY nor ANTHROPIC_API_KEY is set.",
        });
      }
      const urlCheck = checkUrl("CLAUDE_BASE_URL");
      if (urlCheck) checks.push(urlCheck);
    }

    if (provider === "ollama") {
      const urlCheck = checkUrl("OLLAMA_URL");
      if (urlCheck) checks.push(urlCheck);
    }

    const lanes = ["CHAT", "MANAGER", "OPERATIONS", "RESEARCH", "BUSINESS", "FINANCE"];
    const overrideCount = lanes.filter((lane) => present(`MODEL_${lane}`)).length;
    if (overrideCount > 0) {
      checks.push({
        name: "MODEL_<lane> overrides",
        severity: "ok",
        message: `${overrideCount} of ${lanes.length} lanes have explicit overrides.`,
      });
    }

    const sessionSecret = trimmed("SESSION_SECRET");
    if (!sessionSecret) {
      checks.push({
        name: "SESSION_SECRET",
        severity: "error",
        message: "Not set. Session cookies cannot be signed; logins will fail.",
        hint: "Generate a 32-byte random hex string.",
      });
    } else if (sessionSecret.length < 24) {
      checks.push({
        name: "SESSION_SECRET",
        severity: "error",
        message: `Only ${sessionSecret.length} characters — too short to be cryptographically strong.`,
        hint: "Use at least 32 random characters (e.g. openssl rand -hex 32).",
      });
    } else if (/@/.test(sessionSecret) || /^[a-zA-Z]+$/.test(sessionSecret)) {
      checks.push({
        name: "SESSION_SECRET",
        severity: "error",
        message: "Looks like an email or simple word, not a random secret.",
        hint: "Replace with a high-entropy random string (32+ bytes).",
      });
    } else if (/^(password|secret|admin|test|changeme)/i.test(sessionSecret)) {
      checks.push({
        name: "SESSION_SECRET",
        severity: "warn",
        message: "Starts with a common dictionary word.",
      });
    } else {
      checks.push({
        name: "SESSION_SECRET",
        severity: "ok",
        message: `Set (length ${sessionSecret.length}).`,
      });
    }

    const dbUrl = trimmed("DATABASE_URL");
    if (!dbUrl) {
      checks.push({
        name: "DATABASE_URL",
        severity: "error",
        message: "Not set. Database access will fail.",
      });
    } else if (!/^postgres(ql)?:\/\//.test(dbUrl)) {
      checks.push({
        name: "DATABASE_URL",
        severity: "error",
        message: 'Does not start with "postgres://" or "postgresql://".',
        hint: "Drizzle expects a Postgres connection string.",
      });
    } else {
      try {
        const u = new URL(dbUrl);
        checks.push({
          name: "DATABASE_URL",
          severity: "ok",
          message: `${u.hostname}${u.pathname} — well-formed Postgres URL.`,
        });
      } catch {
        checks.push({
          name: "DATABASE_URL",
          severity: "error",
          message: "Could not parse as a URL.",
        });
      }
    }

    if (!present("ZED_ADMIN_USERNAME")) {
      checks.push({
        name: "ZED_ADMIN_USERNAME",
        severity: "error",
        message: "Not set. Admin login form will reject every attempt.",
      });
    } else {
      checks.push({
        name: "ZED_ADMIN_USERNAME",
        severity: "ok",
        message: `Set to "${trimmed("ZED_ADMIN_USERNAME")}".`,
      });
    }

    if (!present("ZED_ADMIN_PASSWORD") && !present("ZED_ADMIN_SECURE_PHRASE")) {
      checks.push({
        name: "ZED_ADMIN_PASSWORD",
        severity: "error",
        message:
          "Neither ZED_ADMIN_PASSWORD nor ZED_ADMIN_SECURE_PHRASE is set. Admin login is impossible.",
      });
    } else if (
      present("ZED_ADMIN_PASSWORD") &&
      trimmed("ZED_ADMIN_PASSWORD").length < 10
    ) {
      checks.push({
        name: "ZED_ADMIN_PASSWORD",
        severity: "warn",
        message: `Only ${trimmed("ZED_ADMIN_PASSWORD").length} characters — short.`,
        hint: "Use 16+ characters for a public deploy.",
      });
    } else {
      checks.push({
        name: "ZED_ADMIN_PASSWORD",
        severity: "ok",
        message: "Set with reasonable length.",
      });
    }

    const frontendUrlCheck = checkUrl("FRONTEND_URL");
    if (frontendUrlCheck) checks.push(frontendUrlCheck);

    if (present("BRAVE_SEARCH_API_KEY")) {
      checks.push({
        name: "BRAVE_SEARCH_API_KEY",
        severity: "ok",
        message: "Set — web search via Brave is wired.",
      });
    }

    const summary = {
      ok: checks.filter((c) => c.severity === "ok").length,
      warn: checks.filter((c) => c.severity === "warn").length,
      error: checks.filter((c) => c.severity === "error").length,
    };

    res.json({
      ok: summary.error === 0,
      summary,
      checks,
    });
  });

  app.get("/api/admin/ruleset/structured", isAdmin, async (_req, res) => {
    const files = ["personality.yaml", "security.yaml", "parameters.yaml", "access.yaml"];
    const ruleset: Record<string, any> = {};
    for (const f of files) {
      try {
        const raw = await fs.readFile(path.join(HUB_CONFIG_DIR, f), "utf-8");
        ruleset[f] = yaml.load(raw) || {};
      } catch {
        ruleset[f] = {};
      }
    }
    res.json(ruleset);
  });

  app.post("/api/admin/ruleset", isAdmin, async (req: any, res) => {
    const { filename, content } = req.body;
    const allowed = ["personality.yaml", "security.yaml", "parameters.yaml", "access.yaml"];
    if (!allowed.includes(filename)) {
      return res.status(400).json({ error: "Invalid filename" });
    }
    try {
      yaml.load(content);
      await fs.mkdir(HUB_CONFIG_DIR, { recursive: true });
      await fs.writeFile(path.join(HUB_CONFIG_DIR, filename), content, "utf-8");
      ManagerAgent.flushConfig();
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/admin/ruleset/structured", isAdmin, async (req: any, res) => {
    const { filename, content } = req.body;
    const allowed = ["personality.yaml", "security.yaml", "parameters.yaml", "access.yaml"];
    if (!allowed.includes(filename)) {
      return res.status(400).json({ error: "Invalid filename" });
    }
    try {
      const serialized = yaml.dump(content || {}, { noRefs: true, lineWidth: 120, sortKeys: false });
      yaml.load(serialized);
      await fs.mkdir(HUB_CONFIG_DIR, { recursive: true });
      await fs.writeFile(path.join(HUB_CONFIG_DIR, filename), serialized, "utf-8");
      ManagerAgent.flushConfig();
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/admin/logs", isAdmin, async (_req, res) => {
    try {
      await fs.mkdir(HUB_LOG_DIR, { recursive: true });
      const files = await fs.readdir(HUB_LOG_DIR);
      const recent = files.sort().slice(-3);
      const entries: string[] = [];
      for (const f of recent) {
        try {
          const content = await fs.readFile(path.join(HUB_LOG_DIR, f), "utf-8");
          entries.push(...content.trim().split("\n").filter(Boolean));
        } catch {}
      }
      const runtime = await getRecentRuntimeEvents(100);
      res.json({ entries: entries.slice(-100), runtime });
    } catch {
      res.json({ entries: [], runtime: [] });
    }
  });

  app.post("/api/client-log", async (req, res) => {
    try {
      const { level = "error", event = "client.error", detail, context } = req.body || {};
      await logRuntimeEvent({
        level,
        source: "client",
        event,
        detail,
        context,
      });
      res.json({ ok: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to write client log" });
    }
  });

  const WORKING_MEMORY_PATH = path.resolve(HUB_SHARED_MEMORY_DIR, "working/current-tasks.md");

  function legacyEntryShape(task: any) {
    const draftLog = (task.logs || [])
      .map((l: any) => l.message || "")
      .find((m: string) => m.startsWith("Draft from "));
    const draft = draftLog ? draftLog.replace(/^Draft from [^:]+:\s*/, "") : "";
    const status =
      task.approval_status === "approved"
        ? "approved"
        : task.approval_status === "rejected"
          ? "rejected"
          : "pending";
    return {
      id: task.id,
      timestamp: task.created_at,
      status,
      userId: task.user_id,
      conversationId: task.conversation_id || null,
      message: task.plan?.summary?.replace(/^\[[^\]]+\]\s*Prepared\s+\w+\s+plan\s+for:\s*/i, "") || "",
      draft,
      agent: (task.plan?.summary || "").match(/\[([A-Za-z]+Agent)\]/)?.[1] || "Agent",
      resolvedAt: task.approved_at || null,
      rejectionReason: task.approval_status === "rejected" ? task.approval_reason : undefined,
      approvalStatus: task.approval_status,
      approvalRole: task.approval_role,
      approvalReason: task.approval_reason,
      executionResult: task.last_result?.execution_result || null,
    };
  }

  async function postApprovalConfirmationToConversation(task: any): Promise<string> {
    const timestamp = new Date().toISOString();
    const message = task.plan?.summary || `Task ${task.id}`;
    const summary = `\n## [${timestamp}] ✅ APPROVED & EXECUTED — User: ${task.user_id}\n**Request**: ${message}\n`;
    try {
      await fs.appendFile(WORKING_MEMORY_PATH, summary);
    } catch (err) {
      console.warn("[ApprovalExecutor] Working memory write failed:", err);
    }
    if (task.conversation_id) {
      try {
        const execMessage = `✅ **Action Approved**\n\nYour request has been reviewed and approved by the admin.\n\n**Request**: ${message}`;
        await storage.createMessage(
          insertMessageSchema.parse({
            conversationId: task.conversation_id,
            role: "assistant",
            content: execMessage,
          }),
        );
      } catch (err) {
        console.warn("[ApprovalExecutor] Conversation message failed:", err);
      }
    }
    return `Approved at ${timestamp}${task.conversation_id ? " and posted to conversation" : ""}.`;
  }

  app.get("/api/admin/approval-queue", isAdmin, async (_req, res) => {
    try {
      const { TaskLifecycleManager } = await import("./services/execution/TaskLifecycleManager");
      const tasks = await TaskLifecycleManager.list();
      const pendingStates = new Set([
        "user_required",
        "admin_required",
        "manual_handling_required",
      ]);
      const interesting = tasks.filter(
        (t) =>
          (t.approval_status && pendingStates.has(t.approval_status)) ||
          t.status === "blocked",
      );
      const recent = tasks
        .filter((t) => t.approval_status === "approved" || t.approval_status === "rejected")
        .slice(0, 10);
      const merged = [...interesting, ...recent];
      res.json({ version: "2.0", entries: merged.map(legacyEntryShape) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to read approval queue" });
    }
  });

  app.post("/api/admin/approve/:id", isAdmin, async (req: any, res) => {
    const { id } = req.params;
    try {
      const { ApprovalDecisionHandler } = await import("./services/approval/ApprovalDecisionHandler");
      const result = await ApprovalDecisionHandler.decide({
        task_id: id,
        decided_by: req.user?.claims?.sub || "admin",
        decider_role: "admin",
        action: "approve",
      });
      if (!result.ok || !result.task) {
        return res.status(404).json({ error: result.message });
      }
      const exec = await postApprovalConfirmationToConversation(result.task);
      await logSecurityEvent({
        type: "approval.approved",
        userId: req.user?.claims?.sub,
        detail: `Approved task ${id}: ${(result.task.plan?.summary || "").slice(0, 80)}`,
      });
      res.json({ success: true, entry: { ...legacyEntryShape(result.task), executionResult: exec } });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Approve failed" });
    }
  });

  app.post("/api/admin/reject/:id", isAdmin, async (req: any, res) => {
    const { id } = req.params;
    const { reason } = req.body || {};
    try {
      const { ApprovalDecisionHandler } = await import("./services/approval/ApprovalDecisionHandler");
      const result = await ApprovalDecisionHandler.decide({
        task_id: id,
        decided_by: req.user?.claims?.sub || "admin",
        decider_role: "admin",
        action: "reject",
        reason: reason || "Rejected by admin",
      });
      if (!result.ok || !result.task) {
        return res.status(404).json({ error: result.message });
      }
      await logSecurityEvent({
        type: "approval.rejected",
        userId: req.user?.claims?.sub,
        detail: `Rejected task ${id}: ${(result.task.plan?.summary || "").slice(0, 80)} — ${reason || "no reason"}`,
      });
      res.json({ success: true, entry: legacyEntryShape(result.task) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Reject failed" });
    }
  });

  app.get("/api/admin/security-log", isAdmin, async (_req, res) => {
    const events = await getRecentSecurityEvents(100);
    res.json({ events });
  });

  app.get("/api/admin/system-test", async (_req, res) => {
    const ollama = await checkOllamaHealth();
    res.json({
      system: "ZED",
      ai: getActiveProviderName({ lane: "chat" }),
      target: getResolvedTargetName({ lane: "chat" }),
      ollama: ollama.status,
      database: isDatabaseHealthy ? "connected" : "offline",
    });
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: "Message required" });
      const prompt = buildOllamaPrompt(message);
      const options = { lane: "chat" as const };
      const reply = await generateFromOllama(prompt, options);
      res.json({ reply, provider: getActiveProviderName(options), target: getResolvedTargetName(options) });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Chat failed", reply: "Error processing request" });
    }
  });

  registerExecutionRoutes(app);
  registerIntakeRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}