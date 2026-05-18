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
import { registerAdminSettingsRoutes } from "./routes-modules/admin-settings";
import { registerAdminLogsRoutes } from "./routes-modules/admin-logs";
import { registerApprovalRoutes } from "./routes-modules/approvals";
import { registerMeRoutes } from "./routes-modules/me";
import { registerKnowledgeRoutes } from "./routes-modules/knowledge";
import { registerOrchestrateAndMiscRoutes } from "./routes-modules/orchestrate-and-misc";
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

  // Session-scoped current-user surfaces (identity, personalization,
  // avatar upload) — routes-modules/me.ts
  registerMeRoutes(app);

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


  // Knowledge / memory endpoints — routes-modules/knowledge.ts
  registerKnowledgeRoutes(app);

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

  // Orchestrator + voice stub + admin knowledge overview — packed
  // together in routes-modules/orchestrate-and-misc.ts because each
  // handler is small and they share dependencies (KnowledgeService,
  // ManagerAgent, AdminSettingsStore).
  registerOrchestrateAndMiscRoutes(app, {
    isDatabaseHealthy: () => isDatabaseHealthy,
  });

  // AI host connectivity test — extracted to routes-modules/ai-host-test.ts
  registerAiHostTestRoute(app);

  // Admin settings (app prefs, personalization, integrations, managed
  // users, integration status probes) — routes-modules/admin-settings.ts
  registerAdminSettingsRoutes(app);

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

  // Admin logs + client-log ingest + security log — routes-modules/admin-logs.ts
  registerAdminLogsRoutes(app);

  // Approvals (queue + approve/:id + reject/:id, with the legacy entry
  // shape + working-memory + conversation-confirmation helpers) —
  // routes-modules/approvals.ts
  registerApprovalRoutes(app);

  registerExecutionRoutes(app);
  registerIntakeRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}