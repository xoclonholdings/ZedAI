import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage/databaseStorage.ts";
import { upload, processFile, cleanupFile } from "./services/fileProcessor";
import { generateFromOllama } from "./services/Ollama/OllamaService"; 
import { buildOllamaPrompt } from "./services/Ollama/OllamaContextBuilder";
import { setupLocalAuth, isAuthenticated } from "./localAuth";

import {
  insertConversationSchema,
  insertMessageSchema,
  insertFileSchema,
  insertSessionSchema
} from "@shared/schema";

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
  // AUTH
  // =========================

  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    res.json(user);
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

      // Save user message
      const userMessage = await storage.createMessage(
        insertMessageSchema.parse({
          conversationId,
          role: "user",
          content
        })
      );

      // Get history
      const messages = await storage.getMessagesByConversation(conversationId);

      const history = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      // Build prompt (context-aware)
      const prompt = buildOllamaPrompt(content, {
        history
      });

      // Call Ollama
      const aiResponse = await generateFromOllama(prompt);

      // Save AI response
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
  // SIMPLE CHAT
  // =========================

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

    } catch {
      res.status(500).json({
        error: "Chat failed",
        reply: "Error processing request"
      });
    }
  });

  // =========================
  // FILE UPLOAD
  // =========================

  app.post("/api/conversations/:id/upload", isAuthenticated, upload.array('files'), async (req, res) => {
    try {
      const conversationId = req.params.id;
      const files = req.files as any[];

      const processedFiles = [];

      for (const file of files) {
        const processed