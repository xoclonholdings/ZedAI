import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage/databaseStorage.ts";
import { upload, processFile, cleanupFile } from "./services/fileProcessor";
import { generateFromOllama } from "./services/Ollama/OllamaService";
import { buildOllamaPrompt } from "./services/Ollama/OllamaContextBuilder";
import { setupLocalAuth, isAuthenticated } from "./localAuth";
import { ManagerAgent } from "./orchestrator/ManagerAgent";

import {
  insertConversationSchema,
  insertMessageSchema,
  insertFileSchema,
  insertSessionSchema
} from "../shared/schema";

let isDatabaseHealthy = false;

export function setDatabaseStatus(status: boolean) {
  isDatabaseHealthy = status;

  if (!status) {
    import("./storage").then(({ storage }) => {
      storage.setOfflineMode(true);
    });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  await setupLocalAuth(app);

  // Session check — used by the frontend to determine if the user is logged in
  app.get("/api/me", (req, res) => {
    const session = (req as any).session;
    if (session?.userId && session?.user) {
      return res.json({ user: session.user });
    }
    return res.json({ user: null });
  });

  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    res.json(user);
  });

  app.get("/api/conversations", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const conversations = await storage.getConversationsByUser(userId);
    res.json(conversations);
  });

  app.post("/api/conversations", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;

    const conversation = await storage.createConversation(
      insertConversationSchema.parse({
        userId,
        title: req.body.title || "New Chat",
        model: "ollama",
        isActive: true
      })
    );

    await storage.createSession(
      insertSessionSchema.parse({
        conversationId: conversation.id,
        userId
      })
    );

    res.json(conversation);
  });

  app.post("/api/conversations/:id/messages", isAuthenticated, async (req, res) => {
    try {
      const conversationId = req.params.id;
      const { content } = req.body;

      if (!content) {
        return res.status(400).json({ error: "Message required" });
      }

      const userMessage = await storage.createMessage(
        insertMessageSchema.parse({
          conversationId,
          role: "user",
          content
        })
      );

      const messages = await storage.getMessagesByConversation(conversationId);

      const history = messages.map((m: any) => ({
        role: m.role,
        content: m.content
      }));

      const prompt = buildOllamaPrompt(content, { history });
      const aiResponse = await generateFromOllama(prompt);

      const aiMessage = await storage.createMessage(
        insertMessageSchema.parse({
          conversationId,
          role: "assistant",
          content: aiResponse
        })
      );

      res.json({ userMessage, aiMessage });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Message processing failed" });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message required" });
      }

      const prompt = buildOllamaPrompt(message);
      const reply = await generateFromOllama(prompt);

      res.json({
        reply,
        provider: "ollama"
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error: "Chat failed",
        reply: "Error processing request"
      });
    }
  });

  app.post("/api/conversations/:id/upload", isAuthenticated, upload.array("files"), async (req, res) => {
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
              analysis: processed.analysis
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

  app.post("/api/orchestrate", async (req, res) => {
    try {
      const { message, conversationId } = req.body;
      const userId = (req as any).user?.claims?.sub || "anonymous";

      if (!message) {
        return res.status(400).json({ error: "Message required" });
      }

      const response = await ManagerAgent.route({
        userId,
        message,
        conversationId,
      });

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
      hub_config: "server/hub/config/",
      shared_memory: "server/hub/shared-memory/",
      status: "operational",
    });
  });

  app.get("/api/admin/system-test", async (_req, res) => {
    let ollamaStatus = "unknown";

    try {
      const r = await fetch("http://localhost:11434/api/tags");
      ollamaStatus = r.ok ? "connected" : "error";
    } catch {
      ollamaStatus = "offline";
    }

    res.json({
      system: "ZED",
      ai: "ollama-only",
      ollama: ollamaStatus,
      database: isDatabaseHealthy ? "connected" : "offline"
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}