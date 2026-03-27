import type { Express } from "express";
import { createServer, type Server } from "http";
import { generateFromOllama } from "./services/Ollama/OllamaService";
import { buildOllamaPrompt } from "./services/Ollama/OllamaContextBuilder";

let isDatabaseHealthy = false;

export function setDatabaseStatus(status: boolean) {
  isDatabaseHealthy = status;
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.get("/api/health", async (_req, res) => {
    let ollama = "offline";

    try {
      const response = await fetch("http://localhost:11434/api/tags");
      ollama = response.ok ? "connected" : "error";
    } catch {
      ollama = "offline";
    }

    res.json({
      ok: true,
      ollama,
      database: isDatabaseHealthy ? "connected" : "ignored",
    });
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
        provider: "ollama",
      });
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({
        error: "Chat failed",
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}