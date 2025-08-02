import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { upload, processFile, cleanupFile } from "./services/fileProcessor";
import { generateChatResponse, streamChatResponse } from "./services/openai";
import { setupLocalAuth, isAuthenticated } from "./localAuth";
import { prismaAuth, prismaLogin, getCurrentUser } from "./prismaAuth";
import { PrismaChatService } from "./prismaChatService";
import { QueryLogger } from "./services/queryLogger";
import { insertConversationSchema, insertMessageSchema, insertFileSchema, insertSessionSchema, insertCoreMemorySchema, insertProjectMemorySchema, insertScratchpadMemorySchema } from "@shared/schema";
import { optimizationService } from "./services/optimizationService";
import { MemoryService } from "./services/memoryService";
import { Router } from "express";
import memoryRoutes from "./routes/memory";
import zedMemoryRoutes from "./routes/zedMemory";

// Helper for admin check
function isAdminUser(sessionUser: any) {
  return sessionUser?.username === 'Admin' || sessionUser?.email === 'admin@zed.local';
}

export async function registerRoutes(app: Express): Promise<Server> {
  await setupLocalAuth(app);

  // POST: Log user interaction with ZED
  app.post("/api/log", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.session.user?.id;
      const { prompt, response, metadata } = req.body;

      if (!prompt || !response) {
        return res.status(400).json({ error: "Both prompt and response are required" });
      }
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();

      try {
        const logEntry = await prisma.interaction_log.create({
          data: {
            user_id: userId,
            prompt: prompt.toString(),
            response: response.toString(),
            metadata: metadata || {},
            timestamp: new Date()
          }
        });

        res.status(201).json({
          success: true,
          logId: logEntry.id,
          timestamp: logEntry.timestamp,
          message: "Interaction logged successfully"
        });

      } finally {
        await prisma.$disconnect();
      }

    } catch (error) {
      res.status(500).json({ error: "Failed to log interaction" });
    }
  });

  // GET: Fetch interaction history for specific user
  app.get("/api/logs/:userId", isAuthenticated, async (req: any, res: any) => {
    try {
      const requestedUserId = req.params.userId;
      const sessionUserId = req.session.user?.id;
      const { limit = 50, offset = 0, dateFrom, dateTo } = req.query;

      const sessionUser = req.session.user;
      if (!isAdminUser(sessionUser) && requestedUserId !== sessionUserId) {
        return res.status(403).json({ error: "Access denied. You can only view your own interaction logs" });
      }

      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();

      try {
        const whereClause: any = { user_id: requestedUserId };
        if (dateFrom || dateTo) {
          whereClause.timestamp = {};
          if (dateFrom) whereClause.timestamp.gte = new Date(dateFrom);
          if (dateTo) whereClause.timestamp.lte = new Date(dateTo);
        }

        const logs = await prisma.interaction_log.findMany({
          where: whereClause,
          orderBy: { timestamp: 'desc' },
          take: parseInt(limit as string),
          skip: parseInt(offset as string),
          include: {
            users: {
              select: { email: true, firstName: true, lastName: true }
            }
          }
        });

        const totalCount = await prisma.interaction_log.count({ where: whereClause });

        const formattedLogs = logs.map(log => ({
          id: log.id,
          prompt: log.prompt,
          response: log.response,
          timestamp: log.timestamp,
          metadata: log.metadata,
          user: {
            email: log.users?.email,
            name: `${log.users?.firstName || ''} ${log.users?.lastName || ''}`.trim()
          }
        }));

        res.json({
          success: true,
          userId: requestedUserId,
          logs: formattedLogs,
          pagination: {
            total: totalCount,
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
            hasMore: (parseInt(offset as string) + parseInt(limit as string)) < totalCount
          },
          filters: { dateFrom, dateTo }
        });

      } finally {
        await prisma.$disconnect();
      }

    } catch (error) {
      res.status(500).json({ error: "Failed to fetch interaction logs" });
    }
  });

  // GET: Get interaction statistics for user (admin dashboard)
  app.get("/api/logs/:userId/stats", isAuthenticated, async (req: any, res: any) => {
    try {
      const requestedUserId = req.params.userId;
      const sessionUserId = req.session.user?.id;
      const { days = 30 } = req.query;

      const sessionUser = req.session.user;
      if (!isAdminUser(sessionUser) && requestedUserId !== sessionUserId) {
        return res.status(403).json({ error: "Access denied. You can only view your own statistics" });
      }

      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();

      try {
        const since = new Date();
        since.setDate(since.getDate() - parseInt(days as string));

        const totalInteractions = await prisma.interaction_log.count({
          where: { user_id: requestedUserId, timestamp: { gte: since } }
        });

        const dailyStats = await prisma.$queryRaw`
          SELECT 
            DATE(timestamp) as date,
            COUNT(*) as interaction_count,
            AVG(LENGTH(prompt)) as avg_prompt_length,
            AVG(LENGTH(response)) as avg_response_length
          FROM interaction_log 
          WHERE user_id = ${requestedUserId}
            AND timestamp >= ${since}
          GROUP BY DATE(timestamp)
          ORDER BY date DESC
        `;

        const recentPrompts = await prisma.interaction_log.findMany({
          where: { user_id: requestedUserId, timestamp: { gte: since } },
          select: { prompt: true, timestamp: true },
          orderBy: { timestamp: 'desc' },
          take: 10
        });

        res.json({
          success: true,
          userId: requestedUserId,
          period_days: parseInt(days as string),
          statistics: {
            total_interactions: totalInteractions,
            daily_breakdown: dailyStats,
            recent_prompts: recentPrompts.map(p => ({
              prompt: p.prompt.substring(0, 100) + (p.prompt.length > 100 ? '...' : ''),
              timestamp: p.timestamp
            }))
          }
        });

      } finally {
        await prisma.$disconnect();
      }

    } catch (error) {
      res.status(500).json({ error: "Failed to fetch interaction statistics" });
    }
  });

  // Conversation routes
  // Get all conversations for the current user
  app.get("/api/conversations", async (req: any, res: any) => {
    try {
      // Skip authentication for development - return mock conversations
      console.log("📋 GET Conversations (dev mode)");
      
      const mockConversations = [
        {
          id: "conv-1",
          title: "Welcome to ZED",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          userId: "dev-user"
        }
      ];
      console.log("📁 Returning mock conversations:", mockConversations.length);
      
      return res.json(mockConversations);
    } catch (error) {
      console.error("❌ Error fetching conversations:", error);
      return res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Get a specific conversation
  app.get("/api/conversations/:id", async (req, res) => {
    try {
      const conversationId = req.params.id;
      console.log("📄 GET Conversation:", conversationId);
      
      // Skip authentication for development - return mock conversation
      const mockConversation = {
        id: conversationId,
        title: "Mock Conversation",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: "dev-user"
      };
      
      return res.json(mockConversation);
    } catch (error) {
      console.error("❌ Error fetching conversation:", error);
      return res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  // Create a new conversation
  app.post("/api/conversations", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.session.user?.id;
      const { title = "New Conversation", mode = "chat" } = req.body;
      console.log("➕ POST Create conversation for user:", userId, "title:", title);
      
      const conversationData = insertConversationSchema.parse({
        userId,
        title,
        mode,
        preview: title.substring(0, 100)
      });
      
      const conversation = await storage.createConversation(conversationData);
      console.log("✅ Created conversation:", conversation.id);
      
      return res.json(conversation);
    } catch (error) {
      console.error("❌ Error creating conversation:", error);
      return res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  // Update a conversation
  app.patch("/api/conversations/:id", isAuthenticated, async (req, res) => {
    try {
      const conversationId = req.params.id;
      const updates = req.body;
      console.log("🔄 PATCH Update conversation:", conversationId, "updates:", updates);
      
      const conversation = await storage.updateConversation(conversationId, updates);
      
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      return res.json(conversation);
    } catch (error) {
      console.error("❌ Error updating conversation:", error);
      return res.status(500).json({ error: "Failed to update conversation" });
    }
  });

  // Delete a conversation
  app.delete("/api/conversations/:id", isAuthenticated, async (req, res) => {
    try {
      const conversationId = req.params.id;
      console.log("🗑️ DELETE Conversation:", conversationId);
      
      const success = await storage.deleteConversation(conversationId);
      
      if (!success) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      return res.json({ success: true });
    } catch (error) {
      console.error("❌ Error deleting conversation:", error);
      return res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  // Get messages for a conversation
  app.get("/api/conversations/:id/messages", isAuthenticated, async (req, res) => {
    try {
      const conversationId = req.params.id;
      console.log("📥 GET Messages request for conversation:", conversationId);
      
      const messages = await storage.getMessagesByConversation(conversationId);
      console.log("📋 Found messages:", messages.length);
      
      return res.json(messages);
    } catch (error) {
      console.error("❌ Error fetching messages:", error);
      return res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Get files for a conversation
  app.get("/api/conversations/:id/files", isAuthenticated, async (req, res) => {
    try {
      const conversationId = req.params.id;
      console.log("📁 GET Files for conversation:", conversationId);
      
      const files = await storage.getFilesByConversation(conversationId);
      console.log("📄 Found files:", files.length);
      
      return res.json(files);
    } catch (error) {
      console.error("❌ Error fetching files:", error);
      return res.status(500).json({ error: "Failed to fetch files" });
    }
  });

  // Send message and get AI response
  app.post("/api/conversations/:id/messages", isAuthenticated, async (req, res) => {
    try {
      const conversationId = req.params.id;
      const { content, role = "user" } = req.body;

      if (!content) {
        return res.status(400).json({ error: "Message content is required" });
      }

      const userMessageData = insertMessageSchema.parse({ conversationId, role, content });
      const userMessage = await storage.createMessage(userMessageData);

      const messages = await storage.getMessagesByConversation(conversationId);
      const chatHistory = messages.map(msg => ({
        role: msg.role as "system" | "user" | "assistant",
        content: msg.content
      }));

      const conversation = await storage.getConversation(conversationId);
      const conversationMode = (conversation?.mode as "chat" | "agent") || "chat";

      // Build user context for AI system
      const userContext = {
        userId: req.session.user?.id || 'anonymous',
        accessLevel: isAdminUser(req.session.user) ? 'admin' as const : 'user' as const,
        personalityMode: req.session.user?.personalityMode || 'standard' as const,
        preferences: req.session.user?.preferences || {}
      };

      try {
        const aiResponse = await generateChatResponse(chatHistory, conversationMode, "gpt-4o", userContext);

        const aiMessageData = insertMessageSchema.parse({
          conversationId,
          role: "assistant",
          content: aiResponse
        });

        const aiMessage = await storage.createMessage(aiMessageData);

        if (messages.length <= 2) {
          const title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
          await storage.updateConversation(conversationId, {
            title,
            preview: aiResponse.slice(0, 100) + (aiResponse.length > 100 ? "..." : "")
          });
        }

        return res.json({ userMessage, aiMessage });
      } catch (error) {
        return res.status(500).json({ error: "AI response unavailable. Please try again later or contact support." });
      }
    } catch (error) {
      return res.status(500).json({ error: "Failed to process message" });
    }
  });

    // POST: /api/ask - AI question answering endpoint
  app.post("/api/ask", isAuthenticated, async (req, res) => {
    try {
      const { content, prompt, model, stream } = req.body;
      const userInput = content || prompt;
      
      if (!userInput) {
        return res.status(400).json({ error: "Content or prompt is required" });
      }

      console.log("🤖 ZED: Processing user request with fallback chain");
      const userId = req.session?.user?.id;
      let response: string;
      let modelUsed = 'unknown';

      // Fallback Chain: Local fallback -> OpenAI
      
      try {
        // Use existing OpenAI service
        const openaiResponse = await generateChatResponse([
          { role: "user", content: userInput }
        ], model || "chat");

        if (openaiResponse && openaiResponse.trim()) {
          response = openaiResponse.trim();
          modelUsed = 'openai';
          console.log("✅ ZED: OpenAI responded successfully");
        } else {
          throw new Error("Empty response from OpenAI");
        }
      } catch (openaiError) {
        console.log("⚠️ ZED: OpenAI failed, using fallback...", openaiError instanceof Error ? openaiError.message : String(openaiError));
        
        // Simple fallback response
        response = `I understand you're asking: "${userInput.substring(0, 100)}${userInput.length > 100 ? '...' : ''}". I'm currently running on backup systems and may have limited capabilities. Please try again for a more detailed response.`;
        modelUsed = 'fallback';
      }

      // Log the successful interaction
      if (userId && response) {
        try {
          await QueryLogger.logQuery({
            userId,
            query: userInput,
            response: response,
            model: modelUsed,
            metadata: { 
              source: 'zed-unified',
              fallback_used: modelUsed !== 'openai'
            }
          });
        } catch (logError) {
          console.warn("⚠️ Failed to log interaction:", logError);
        }
      }

      // Return unified ZED response
      return res.json({
        response: response,
        answer: response, // For backward compatibility
        assistant: "ZED",
        success: true
      });

    } catch (error) {
      console.error("❌ ZED: Critical error in ask endpoint:", error);
      return res.status(500).json({ 
        error: "ZED is temporarily offline. Please try again.",
        assistant: "ZED"
      });
    }
  });

  const router = Router();

  // POST: Unified ZED AI endpoint with fallback chain
  app.post("/api/ask", isAuthenticated, async (req: any, res: any) => {
    try {
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }

      console.log("� ZED: Processing user request with fallback chain");
      const userId = req.session.user?.id;
      let response: string;
      let modelUsed = 'unknown';

      // Fallback Chain: Ollama -> OpenAI -> Julius
      
      // 1. Try Ollama first (local model - fastest)
      try {
        console.log("🤖 ZED: Attempting Ollama (local model)...");
        const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'phi', // or 'tinyllama' based on what's available
            prompt: content,
            stream: false
          }),
          signal: AbortSignal.timeout(30000) // 30 second timeout
        });

        if (ollamaResponse.ok) {
          const data = await ollamaResponse.json();
          if (data.response && data.response.trim()) {
            response = data.response.trim();
            modelUsed = 'ollama';
            console.log("✅ ZED: Ollama responded successfully");
          } else {
            throw new Error("Empty response from Ollama");
          }
        } else {
          throw new Error(`Ollama HTTP ${ollamaResponse.status}`);
        }
      } catch (ollamaError) {
        console.log("⚠️ ZED: Ollama failed, trying OpenAI...", ollamaError instanceof Error ? ollamaError.message : String(ollamaError));
        
        // 2. Fallback to OpenAI
        try {
          // Use existing OpenAI service
          const openaiResponse = await generateChatResponse([
            { role: "user", content }
          ], "chat", "gpt-4");

          if (openaiResponse && openaiResponse.trim()) {
            response = openaiResponse.trim();
            modelUsed = 'openai';
            console.log("✅ ZED: OpenAI responded successfully");
          } else {
            throw new Error("Empty response from OpenAI");
          }
        } catch (openaiError) {
          console.log("⚠️ ZED: OpenAI failed, trying Julius...", openaiError instanceof Error ? openaiError.message : String(openaiError));
          
          // 3. Final fallback to Julius (placeholder - implement your Julius integration)
          try {
            // TODO: Implement Julius API call
            // For now, using a simple fallback response
            response = await callJuliusAPI(content);
            modelUsed = 'julius';
            console.log("✅ ZED: Julius responded successfully");
          } catch (juliusError) {
            console.error("❌ ZED: All models failed", juliusError instanceof Error ? juliusError.message : String(juliusError));
            return res.status(503).json({ 
              error: "ZED is temporarily offline. Please try again.",
              assistant: "ZED"
            });
          }
        }
      }

      // Log the successful interaction
      if (userId && response) {
        try {
          await QueryLogger.logQuery({
            userId,
            query: content,
            response: response,
            model: modelUsed,
            metadata: { 
              source: 'zed-unified',
              fallback_used: modelUsed !== 'ollama'
            }
          });
        } catch (logError) {
          console.warn("⚠️ Failed to log interaction:", logError);
        }
      }

      // Return unified ZED response
      res.json({
        response: response,
        assistant: "ZED",
        success: true
      });

    } catch (error) {
      console.error("❌ ZED: Critical error in ask endpoint:", error);
      res.status(500).json({ 
        error: "ZED is temporarily offline. Please try again.",
        assistant: "ZED"
      });
    }
  });

  // Julius API helper function
  async function callJuliusAPI(content: string): Promise<string> {
    // TODO: Replace with actual Julius API integration
    // For now, return a fallback response
    console.log("🔄 ZED: Using Julius fallback...");
    
    // Example Julius API call (replace with actual implementation)
    try {
      // const juliusResponse = await fetch('http://your-julius-api/generate', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ prompt: content })
      // });
      // const data = await juliusResponse.json();
      // return data.response;
      
      // Temporary fallback response
      return `I understand you're asking: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}". I'm currently running on backup systems and may have limited capabilities. Please try again for a more detailed response.`;
    } catch (error) {
      throw new Error("Julius API unavailable");
    }
  }

  // Memory management routes (Admin only)
  app.use('/api/memory', memoryRoutes);
  
  // ZED Core Memory System routes
  app.use('/api/zed/memory', zedMemoryRoutes);

  // Only add API-specific 404 handling, not global
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: "API endpoint not found" });
  });

  // Middleware to handle errors
  app.use((err: any, req: any, res: any, next: any) => {
    res.status(500).json({ error: "Internal Server Error" });
  });

  const httpServer = createServer(app);
  return httpServer;
}