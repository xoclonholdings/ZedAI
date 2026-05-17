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
import { buildZedAdminContext } from "./services/ZedContextBuilder";
import { registerFlowRoutes } from "./routes-modules/flows";
import { registerEnvValidateRoute } from "./routes-modules/env-validate";
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
import { registerProjectRoutes } from "./routes-modules/projects";
import { registerDiagnosticsRoutes } from "./routes-modules/diagnostics";
import { registerAiHostTestRoute } from "./routes-modules/ai-host-test";
import { registerRulesetRoutes } from "./routes-modules/ruleset";
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
  // Length + format guidelines (added because output was too verbose
  // and emitted literal <br> tags inside markdown):
  "Match your response length to the question. Greetings get one short sentence. Simple factual questions get one direct answer. Reserve long structured responses for genuinely complex or multi-part requests.",
  "Do not restate the question, do not write preamble like 'Great question!' or 'Here is the answer:', and do not summarize what you're about to say before saying it.",
  "Output in GitHub-flavored markdown. Use **bold** for emphasis, bulleted or numbered lists for enumerations, tables for structured comparisons, and fenced code blocks for code. Never emit literal <br> or <br/> tags — use blank lines or list items instead.",
  "If a table would help, render it as a real markdown table with pipes and a separator row. Don't paste the markdown source as plain text.",
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

/**
 * Detect when a chat-mode message is actually a web lookup / research
 * intent and should be routed through ManagerAgent → IntelligenceAgent
 * (which has web search) instead of plain chat streaming.
 *
 * Catches:
 *  - http(s):// URLs
 *  - www. URLs
 *  - bare domains (any.tld pattern like zwap.online)
 *  - verbs / phrases that imply browsing or fresh research
 */
function isWebLookupIntent(message: string): boolean {
  if (!message) return false;
  const text = message.toLowerCase();

  // URLs / domains
  if (/\bhttps?:\/\/\S+/i.test(message)) return true;
  if (/\bwww\.\S+/i.test(message)) return true;
  // bare domains: word.tld where tld is 2–24 alphabetic chars
  if (/\b[a-z0-9-]+\.[a-z]{2,24}(?:\/\S*)?\b/i.test(message)) {
    // Avoid false positives on filenames like "file.txt" or version numbers
    // by requiring the TLD half to be at least 2 chars AND the segment to
    // not be a common file extension.
    const fileExt = /\.(txt|md|pdf|png|jpe?g|gif|webp|json|ya?ml|csv|xlsx?|docx?|mp[34]|wav|zip|tar|gz)\b/i;
    if (!fileExt.test(message)) return true;
  }

  // Intent phrases
  const phrases = [
    "visit", "browse", "inspect", "check this site", "check the site",
    "look up", "lookup", "search the web", "web search", "google this",
    "latest", "current", "today's", "news on", "news about", "what's new",
    "analyze this website", "audit this website", "review this website",
    "summarize this page", "summarize this site", "summarize the page",
    "scrape", "crawl", "fetch the page", "read this page", "open the url",
    "look at the link",
  ];
  for (const p of phrases) {
    if (text.includes(p)) return true;
  }

  return false;
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

  // Avatar upload — accepts a single image, stores under /uploads,
  // sets the user's profileImageUrl, and refreshes the session.user
  // so the next /api/me call returns the new URL.
  app.post(
    "/api/me/avatar",
    isAuthenticated,
    upload.single("photo"),
    async (req: any, res) => {
      try {
        const file = req.file as Express.Multer.File | undefined;
        if (!file) return res.status(400).json({ error: "No photo uploaded" });
        if (!file.mimetype?.startsWith("image/")) {
          return res.status(400).json({ error: "Photo must be an image" });
        }
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        // The file is on disk in uploads/. Build a URL that serves it
        // back via the existing /uploads static route.
        const publicUrl = `/uploads/${path.basename(file.path)}`;

        // Persist on the users table if Drizzle is up.
        try {
          if (db) {
            await db
              .insert(users)
              .values({ id: userId, profileImageUrl: publicUrl })
              .onConflictDoUpdate({
                target: users.id,
                set: { profileImageUrl: publicUrl, updatedAt: new Date() },
              });
          }
        } catch (dbErr: any) {
          void logRuntimeEvent({
            level: "warn",
            source: "server",
            event: "avatar.db_update_failed",
            detail: dbErr?.message || String(dbErr),
            context: { userId },
          });
        }

        // Update the live session so the next /api/me reflects it
        // without requiring a logout/login.
        if (req.session?.user) {
          req.session.user.profileImageUrl = publicUrl;
        }

        res.json({ profileImageUrl: publicUrl });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || "Avatar upload failed" });
      }
    },
  );

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

  // ── Projects (CRUD + instructions + sources + conversation assignment) ─
  // Extracted to routes-modules/projects.ts.
  registerProjectRoutes(app);

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

      // ── Web lookup short-circuit ────────────────────────────────────
      // If the user's message contains a URL or web-research intent,
      // route it through ManagerAgent → IntelligenceAgent (which has
      // WebSearchService wired) instead of plain chat streaming.
      // Otherwise ZED replies "I cannot browse" because the chat lane
      // has no tool access. Agent-mode requests already go via
      // /api/orchestrate; this catches chat-mode requests that need
      // the same routing.
      if (isWebLookupIntent(content)) {
        try {
          const isAdmin = !!req.user?.claims?.isAdmin;
          const result = await ManagerAgent.route({
            userId: req.user?.claims?.sub || "unknown",
            message: content,
            conversationId,
            ip: req.ip || "",
            targetAgent: "research",
            context: { isAdmin },
          });
          const aiMessage = await storage.createMessage(
            insertMessageSchema.parse({
              conversationId,
              role: "assistant",
              content: result.reply || "(no response)",
            }),
          );
          await KnowledgeService.persistInteraction({
            userId: req.user?.claims?.sub || "unknown",
            conversationId,
            userContent: content,
            assistantContent: aiMessage.content,
            tags: ["chat", "web", "research"],
          });
          if (stream) {
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");
            res.setHeader("X-Accel-Buffering", "no");
            res.write(
              `data: ${JSON.stringify({ type: "user_message", message: userMessage })}\n\n`,
            );
            res.write(
              `data: ${JSON.stringify({ type: "done", message: aiMessage })}\n\n`,
            );
            res.end();
          } else {
            res.json({ userMessage, aiMessage });
          }
          return;
        } catch (webErr: any) {
          // If the web lookup path itself blows up, fall through to the
          // normal chat path so the user still gets *some* reply rather
          // than a 500. The runtime log captures the failure.
          void logRuntimeEvent({
            level: "error",
            source: "server",
            event: "chat.web_lookup.failed",
            detail: webErr?.message || String(webErr),
            context: {
              conversationId,
              errorKind: webErr?.constructor?.name,
            },
          });
        }
      }

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
        // Pull the admin-defined ruleset + active integrations into the
        // system prompt so ZED actually USES what's in the admin panel
        // instead of just storing it.
        const adminCtx = await buildZedAdminContext({
          userId: req.user?.claims?.sub,
          conversationId,
        });
        systemPrompt = [
          ZED_IDENTITY_PROMPT,
          systemPrompt || "",
          adminCtx.text,
          knowledge.prompt,
        ]
          .filter(Boolean)
          .join("\n\n");
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

  app.post("/api/voice/transcribe", isAuthenticated, async (req: any, res) => {
    res.json({
      transcript: "",
      note: "Server-side transcription requires Whisper. Using browser Speech API instead.",
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

  // AI host connectivity test — extracted to routes-modules/ai-host-test.ts
  registerAiHostTestRoute(app);

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

  // Ruleset YAML CRUD (raw + structured) — extracted to routes-modules/ruleset.ts.
  // ManagerAgent cache flush happens inside the module on every write.
  registerRulesetRoutes(app);

  // ── Diagnostics (admin status snapshot + provider routing + runtime) ─
  // Extracted to routes-modules/diagnostics.ts. Database health is
  // mutated by the boot pipeline, so we pass a getter callback.
  registerDiagnosticsRoutes(app, { isDatabaseHealthy: () => isDatabaseHealthy });

  // ── Flows (admin CRUD + user-facing + run lifecycle) ──────────────
  // Route-order requirement (/api/flows/runs before /api/flows/:id) is
  // preserved inside the module.
  registerFlowRoutes(app);

  // Env validator — pure logic in services/EnvValidator.ts, thin route
  // wrapper in routes-modules/env-validate.ts.
  registerEnvValidateRoute(app);

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