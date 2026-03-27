import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage/databaseStorage.ts";
import { upload, processFile, cleanupFile } from "./services/fileProcessor";
import { generateFromOllama } from "./services/OllamaService";
import { setupLocalAuth, isAuthenticated } from "./localAuth";
import {
  insertConversationSchema,
  insertMessageSchema,
  insertFileSchema,
  insertSessionSchema,
  insertCoreMemorySchema,
  insertProjectMemorySchema,
  insertScratchpadMemorySchema
} from "@shared/schema";

import { optimizationService } from "./services/optimizationService";
import { MemoryService } from "./services/memoryService";

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

  // =========================
  // BASIC AUTH
  // =========================

  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // =========================
  // CONVERSATIONS
  // =========================

  app.get("/api/conversations", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const conversations = await storage.getConversationsByUser(userId);
    res.json(conversations);
  });

  app.post("/api/conversations", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;

    const conversationData = insertConversationSchema.parse({
      userId,
      title: req.body.title || "New Chat",
      model: "ollama",
      isActive: true
    });

    const conversation = await storage.createConversation(conversationData);

    const sessionData = insertSessionSchema.parse({
      conversationId: conversation.id,
      userId
    });

    await storage.createSession(sessionData);

    res.json(conversation);
  });

  // =========================
  // MESSAGES (OLLAMA CORE)
  // =========================

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

      // 🔥 OLLAMA CALL (single source of intelligence)
      const aiResponse = await generateFromOllama(content);

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

  // =========================
  // SIMPLE CHAT ENDPOINT
  // =========================

  app.post("/api/chat", async (req, res) => {
    try {
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: "Message required" });
      }

      const reply = await generateFromOllama(message);

      res.json({
        reply,
        provider: "ollama"
      });

    } catch (error) {
      res.status(500).json({
        error: "Chat failed",
        reply: "Error processing request"
      });
    }
  });

  // =========================
  // FILE PROCESSING
  // =========================

  app.post("/api/conversations/:id/upload", isAuthenticated, upload.array('files'), async (req, res) => {
    try {
      const conversationId = req.params.id;
      const files = req.files as any[];

      const processedFiles = [];

      for (const file of files) {
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
        await cleanupFile(file.path);
      }

      res.json({ files: processedFiles });

    } catch {
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // =========================
  // MEMORY SYSTEM
  // =========================

  app.get("/api/memory/core", isAuthenticated, async (_req, res) => {
    const data = await MemoryService.getAllCoreMemory();
    res.json(data);
  });

  app.get("/api/memory/project", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const data = await MemoryService.getProjectMemory(userId);
    res.json(data);
  });

  app.get("/api/memory/scratchpad", isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const data = await MemoryService.getScratchpadMemory(userId);
    res.json(data);
  });

  // =========================
  // SYSTEM CHECK (OLLAMA ONLY)
  // =========================

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

  // =========================
  // OPTIMIZATION
  // =========================

  app.get("/api/admin/optimization/stats", async (_req, res) => {
    res.json(optimizationService.getStats());
  });

  const httpServer = createServer(app);
  return httpServer;
}