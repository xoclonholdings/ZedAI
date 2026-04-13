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
].join(" ");

export function setDatabaseStatus(status: boolean) {
  isDatabaseHealthy = status;
}

async function ensureSessionUserInDatabase(req: any) {
  if (!db) return;

  const sessionUserId = req.user?.claims?.sub;
  const sessionUser = req.session?.user;

  if (!sessionUserId || !sessionUser) return;

  await db
    .insert(users)
    .values({
      id: sessionUserId,
      email: sessionUser.email || null,
      firstName: sessionUser.firstName || null,
      lastName: sessionUser.lastName || null,
      profileImageUrl: sessionUser.profileImageUrl || null,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: sessionUser.email || null,
        firstName: sessionUser.firstName || null,
        lastName: sessionUser.lastName || null,
        profileImageUrl: sessionUser.profileImageUrl || null,
        updatedAt: new Date(),
      },
    });
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

  // ─── Auth ────────────────────────────────────────────────────────────────

  app.get("/api/me", (req, res) => {
    const session = (req as any).session;
    if (session?.userId && session?.user) {
      return res.json({ user: session.user });
    }
    return res.json({ user: null });
  });

  // ─── Conversations ────────────────────────────────────────────────────────

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
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create conversation" });
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

      const hubMemory = await injectMemory("KnowledgeContext").catch(() => ({ formatted: "" }));
      const knowledge = await KnowledgeService.buildContext({
        userId,
        query,
        conversationId: typeof req.query.conversationId === "string" ? req.query.conversationId : undefined,
        lane: "admin",
        injectedMemory: hubMemory.formatted,
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

  // ─── Messages ─────────────────────────────────────────────────────────────

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

  // SSE streaming chat endpoint
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

      // Save user message
      const userMessage = await storage.createMessage(
        insertMessageSchema.parse({ conversationId, role: "user", content })
      );

      // Build chat history for context
      const history = await storage.getMessagesByConversation(conversationId);
      const ollamaMessages: OllamaMessage[] = history
        .slice(-20)
        .map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content }));

      // Load rules from core memory if present, then inject hub memory
      let systemPrompt: string | undefined;
      try {
        const mem = await storage.getCoreMemoryByKey("system_prompt");
        if (mem) systemPrompt = mem.value;
      } catch {}

      try {
        const memCtx = await injectMemory("ChatMode");
        const knowledge = await KnowledgeService.buildContext({
          userId: req.user.claims.sub,
          query: content,
          conversationId,
          lane: "chat",
          injectedMemory: memCtx.formatted,
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
        // SSE streaming response
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");

        let fullResponse = "";

        // Send user message first so client can render it
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
            const isConnRefused = err.message?.includes("ECONNREFUSED") || err.message?.includes("fetch failed");
            const ollamaUrl = process.env.OLLAMA_URL || "localhost:11434";
            const fallback = isConnRefused
              ? `Ollama is not reachable at ${ollamaUrl}. Start Ollama on your local machine and ensure this server can reach it. If using Tailscale, set the OLLAMA_URL environment variable to your Tailscale IP (e.g., http://100.x.x.x:11434).`
              : `AI model error: ${err.message}`;
            const aiMessage = await storage.createMessage(
              insertMessageSchema.parse({ conversationId, role: "assistant", content: fallback })
            );
            res.write(`data: ${JSON.stringify({ type: "error", message: aiMessage, error: err.message })}\n\n`);
            res.end();
          }
        );
      } else {
        // Non-streaming fallback
        let aiText: string;
        try {
          aiText = await generateChatFromOllama(ollamaMessages, systemPrompt);
        } catch {
          aiText = "I'm having trouble connecting to the AI model. Please check that Ollama is running locally.";
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

  // ─── Files ────────────────────────────────────────────────────────────────

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

  // ─── Agent Orchestration ──────────────────────────────────────────────────

  app.post("/api/orchestrate", isAuthenticated, async (req: any, res) => {
    try {
      const { message, conversationId, targetAgent = "auto" } = req.body;
      const userId = req.user.claims.sub;

      if (!message) return res.status(400).json({ error: "Message required" });

      // Save user message to DB if we have a conversation
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
        injectedMemory: (await injectMemory("ManagerAgent").catch(() => ({ formatted: "" }))).formatted,
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
        },
      });

      // Save agent response
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

  // ─── Voice ────────────────────────────────────────────────────────────────

  app.post("/api/voice/transcribe", isAuthenticated, async (req: any, res) => {
    // Web Speech API handles transcription on the client side for now
    // This endpoint is a placeholder for future Whisper integration
    res.json({
      transcript: "",
      note: "Server-side transcription requires Whisper. Using browser Speech API instead.",
    });
  });

  // ─── Admin ────────────────────────────────────────────────────────────────

  app.get("/api/admin/system-status", isAdmin, async (_req, res) => {
    const ollama = await checkOllamaHealth();
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
      const defaultUserId = settings.managedUsers?.[0]?.id || "admin-user";
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
      let chatStatus: "ok" | "error" = "ok";
      let reply = "";
      let error = "";

      try {
        reply = await generateChatFromOllama([{ role: "user", content: "Reply with READY only." }]);
      } catch (chatError: any) {
        chatStatus = "error";
        error = chatError?.message || "AI host test failed";
      }

      res.json({
        health,
        chat: {
          status: chatStatus,
          reply,
          error,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "AI host test failed" });
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

  app.post("/api/admin/ruleset", isAdmin, async (req: any, res) => {
    const { filename, content } = req.body;
    const allowed = ["personality.yaml", "security.yaml", "parameters.yaml", "access.yaml"];
    if (!allowed.includes(filename)) {
      return res.status(400).json({ error: "Invalid filename" });
    }
    try {
      yaml.load(content); // validate YAML
      await fs.mkdir(HUB_CONFIG_DIR, { recursive: true });
      await fs.writeFile(path.join(HUB_CONFIG_DIR, filename), content, "utf-8");
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

  // ─── Approval Queue ────────────────────────────────────────────────────────

  const APPROVAL_QUEUE_PATH = path.resolve(HUB_SHARED_MEMORY_DIR, "episodic/approval-queue.json");
  const WORKING_MEMORY_PATH = path.resolve(HUB_SHARED_MEMORY_DIR, "working/current-tasks.md");

  async function executeApprovedEntry(entry: any): Promise<string> {
    const timestamp = new Date().toISOString();
    const summary = `\n## [${timestamp}] ✅ APPROVED & EXECUTED — User: ${entry.userId}\n**Request**: ${entry.message}\n**Draft executed**: ${entry.draft}\n`;
    try {
      await fs.appendFile(WORKING_MEMORY_PATH, summary);
    } catch (err) {
      console.warn("[ApprovalExecutor] Working memory write failed:", err);
    }
    if (entry.conversationId) {
      try {
        const execMessage = `✅ **Action Approved & Executed**\n\nYour request has been reviewed and approved by the admin.\n\n**Request**: ${entry.message}\n\n**Executed draft**:\n${entry.draft}`;
        await storage.createMessage(
          insertMessageSchema.parse({ conversationId: entry.conversationId, role: "assistant", content: execMessage })
        );
      } catch (err) {
        console.warn("[ApprovalExecutor] Conversation message failed:", err);
      }
    }
    return `Executed at ${timestamp}: wrote to working memory${entry.conversationId ? " and posted to conversation" : ""}.`;
  }

  app.get("/api/admin/approval-queue", isAdmin, async (_req, res) => {
    try {
      const raw = await fs.readFile(APPROVAL_QUEUE_PATH, "utf-8");
      const queue = JSON.parse(raw);
      res.json(queue);
    } catch {
      res.json({ version: "1.0", entries: [] });
    }
  });

  app.post("/api/admin/approve/:id", isAdmin, async (req: any, res) => {
    const { id } = req.params;
    try {
      const raw = await fs.readFile(APPROVAL_QUEUE_PATH, "utf-8");
      const queue = JSON.parse(raw);
      const entry = queue.entries.find((e: any) => e.id === id);
      if (!entry) return res.status(404).json({ error: "Entry not found" });
      entry.status = "approved";
      entry.resolvedAt = new Date().toISOString();

      // Execute: write to working memory and notify conversation
      const execResult = await executeApprovedEntry(entry);
      entry.executionResult = execResult;

      await fs.writeFile(APPROVAL_QUEUE_PATH, JSON.stringify(queue, null, 2));
      await logSecurityEvent({
        type: "approval.approved",
        userId: req.user?.claims?.sub,
        detail: `Approved & executed: ${entry.message?.slice(0, 80)}`,
      });
      res.json({ success: true, entry });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/reject/:id", isAdmin, async (req: any, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    try {
      const raw = await fs.readFile(APPROVAL_QUEUE_PATH, "utf-8");
      const queue = JSON.parse(raw);
      const entry = queue.entries.find((e: any) => e.id === id);
      if (!entry) return res.status(404).json({ error: "Entry not found" });
      entry.status = "rejected";
      entry.resolvedAt = new Date().toISOString();
      entry.rejectionReason = reason || "Rejected by admin";
      await fs.writeFile(APPROVAL_QUEUE_PATH, JSON.stringify(queue, null, 2));
      await logSecurityEvent({
        type: "approval.rejected",
        userId: req.user?.claims?.sub,
        detail: `Rejected: ${entry.message?.slice(0, 80)} — Reason: ${entry.rejectionReason}`,
      });
      res.json({ success: true, entry });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/security-log", isAdmin, async (_req, res) => {
    const events = await getRecentSecurityEvents(100);
    res.json({ events });
  });

  // Legacy endpoint
  app.get("/api/admin/system-test", async (_req, res) => {
    const ollama = await checkOllamaHealth();
    res.json({
      system: "ZED",
      ai: "ollama-only",
      ollama: ollama.status,
      database: isDatabaseHealthy ? "connected" : "offline",
    });
  });

  // ─── Simple chat (no conversation context) ────────────────────────────────

  app.post("/api/chat", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: "Message required" });
      const prompt = buildOllamaPrompt(message);
      const reply = await generateFromOllama(prompt);
      res.json({ reply, provider: "ollama" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Chat failed", reply: "Error processing request" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
