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
import { setupLocalAuth, isAuthenticated } from "./localAuth";
import { ManagerAgent } from "./orchestrator/ManagerAgent";
import { checkTiers, filterOutputForTier3 } from "./middleware/TierEnforcement";
import { logSecurityEvent, getRecentSecurityEvents } from "./services/SecurityAudit";
import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";

import {
  insertConversationSchema,
  insertMessageSchema,
  insertFileSchema,
  insertSessionSchema,
} from "../shared/schema";

let isDatabaseHealthy = false;

export function setDatabaseStatus(status: boolean) {
  isDatabaseHealthy = status;
}

const HUB_CONFIG_DIR = path.resolve(process.cwd(), "hub/config");
const HUB_LOG_DIR = path.resolve(process.cwd(), "hub/logs");

export async function registerRoutes(app: Express): Promise<Server> {
  await setupLocalAuth(app);

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
      const conversation = await storage.createConversation(
        insertConversationSchema.parse({
          userId,
          title: req.body.title || "New Chat",
          mode: req.body.mode || "chat",
          model: "ollama",
          isActive: true,
        })
      );
      await storage.createSession(
        insertSessionSchema.parse({ conversationId: conversation.id, userId })
      );
      res.json(conversation);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to create conversation" });
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

  // ─── Messages ─────────────────────────────────────────────────────────────

  app.get("/api/conversations/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
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

      // Load rules from core memory if present
      let systemPrompt: string | undefined;
      try {
        const mem = await storage.getCoreMemoryByKey("system_prompt");
        if (mem) systemPrompt = mem.value;
      } catch {}

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
      const { message, conversationId } = req.body;
      const userId = req.user.claims.sub;

      if (!message) return res.status(400).json({ error: "Message required" });

      // Save user message to DB if we have a conversation
      if (conversationId) {
        await storage.createMessage(
          insertMessageSchema.parse({ conversationId, role: "user", content: message })
        );
      }

      const ip = req.ip || "";
      const response = await ManagerAgent.route({ userId, message, conversationId, ip });

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
      res.status(500).json({
        error: "Orchestration failed",
        reply: "An error occurred while processing your request.",
        agent: "ManagerAgent",
      });
    }
  });

  app.get("/api/orchestrate/status", async (_req, res) => {
    res.json({
      orchestrator: "ManagerAgent",
      active_agents: ["OperationsAgent", "IntelligenceAgent"],
      stubbed_agents: ["IDEOperatorAgent", "AudioEngineerAgent"],
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

  app.get("/api/admin/system-status", isAuthenticated, async (_req, res) => {
    const ollama = await checkOllamaHealth();
    res.json({
      system: "ZED",
      ollama: { status: ollama.status, models: ollama.models },
      database: isDatabaseHealthy ? "connected" : "offline",
      orchestrator: {
        status: "operational",
        active: ["OperationsAgent", "IntelligenceAgent"],
        stubbed: ["IDEOperatorAgent", "AudioEngineerAgent"],
      },
    });
  });

  app.get("/api/admin/ruleset", isAuthenticated, async (_req, res) => {
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

  app.post("/api/admin/ruleset", isAuthenticated, async (req: any, res) => {
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

  app.get("/api/admin/logs", isAuthenticated, async (_req, res) => {
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
      res.json({ entries: entries.slice(-100) });
    } catch {
      res.json({ entries: [] });
    }
  });

  // ─── Approval Queue ────────────────────────────────────────────────────────

  const APPROVAL_QUEUE_PATH = path.resolve(process.cwd(), "hub/shared-memory/episodic/approval-queue.json");

  app.get("/api/admin/approval-queue", isAuthenticated, async (_req, res) => {
    try {
      const raw = await fs.readFile(APPROVAL_QUEUE_PATH, "utf-8");
      const queue = JSON.parse(raw);
      res.json(queue);
    } catch {
      res.json({ version: "1.0", entries: [] });
    }
  });

  app.post("/api/admin/approve/:id", isAuthenticated, async (req: any, res) => {
    const { id } = req.params;
    try {
      const raw = await fs.readFile(APPROVAL_QUEUE_PATH, "utf-8");
      const queue = JSON.parse(raw);
      const entry = queue.entries.find((e: any) => e.id === id);
      if (!entry) return res.status(404).json({ error: "Entry not found" });
      entry.status = "approved";
      entry.resolvedAt = new Date().toISOString();
      await fs.writeFile(APPROVAL_QUEUE_PATH, JSON.stringify(queue, null, 2));
      await logSecurityEvent({
        type: "approval.approved",
        userId: req.user?.claims?.sub,
        detail: `Approved: ${entry.message?.slice(0, 80)}`,
      });
      res.json({ success: true, entry });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/reject/:id", isAuthenticated, async (req: any, res) => {
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

  app.get("/api/admin/security-log", isAuthenticated, async (_req, res) => {
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
