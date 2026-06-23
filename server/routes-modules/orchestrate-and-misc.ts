import type { Express } from "express";

import { isAdmin, isAuthenticated } from "../localAuth";
import { storage } from "../storage/databaseStorage";
import { insertMessageSchema } from "../../shared/schema";
import { ManagerAgent } from "../orchestrator/ManagerAgent";
import { ZedAutonomousOrchestrator } from "../zcos/orchestration/ZedAutonomousOrchestrator";
import { KnowledgeService } from "../services/KnowledgeService";
import { injectMemory } from "../services/MemoryInjector";
import {
  checkOllamaHealth,
  generateFromOllama,
} from "../services/Ollama/OllamaService";
import { buildOllamaPrompt } from "../services/Ollama/OllamaContextBuilder";
import {
  getActiveProviderName,
  getResolvedTargetName,
} from "../core/providers/provider-executor";
import {
  getPublicAdminSettings,
  loadAdminSettings,
} from "../services/AdminSettingsStore";

/**
 * Orchestrator + a handful of small one-shot endpoints. They live
 * together because each is too small to deserve its own module but
 * they share dependencies (provider executor, KnowledgeService,
 * AdminSettingsStore).
 *
 * Endpoints:
 *   POST /api/orchestrate           Autonomous ZED dispatch through ZCOS
 *   GET  /api/orchestrate/status    Active vs planned agents + integrations
 *   POST /api/voice/transcribe      Stub for future Whisper integration
 *   GET  /api/admin/knowledge/overview  Counts for the admin Knowledge tab
 *   GET  /api/admin/system-test     Cheap status probe (no auth)
 *   POST /api/chat                  Bare-bones single-shot chat (no auth)
 */
export function registerOrchestrateAndMiscRoutes(
  app: Express,
  opts: { isDatabaseHealthy: () => boolean },
): void {
  app.post("/api/orchestrate", isAuthenticated, async (req: any, res) => {
    try {
      const { message, conversationId, targetAgent } = req.body;
      const userId = req.user.claims.sub;
      if (!message) return res.status(400).json({ error: "Message required" });

      if (conversationId) {
        await storage.createMessage(
          insertMessageSchema.parse({
            conversationId,
            role: "user",
            content: message,
          }),
        );
      }

      const ip = req.ip || "";
      const knowledge = await KnowledgeService.buildContext({
        userId,
        query: message,
        conversationId,
        lane: "manager",
        injectedMemory: (
          await injectMemory("ManagerAgent", {
            includeFoundation: !!req.user?.claims?.isAdmin,
          }).catch(() => ({ formatted: "" }))
        ).formatted,
        includeAdminFoundation: !!req.user?.claims?.isAdmin,
      });

      const response = await ZedAutonomousOrchestrator.route({
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
            metadata: {
              agent: response.agent,
              requiresApproval: response.requiresApproval,
              autonomous: response.metadata?.autonomous,
              flowRecommendation: response.metadata?.flowRecommendation,
            },
          }),
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
        reply: `ZED orchestration is unavailable right now: ${detail}`,
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
          status: (isBusinessReady ? "active" : "planned") as "active" | "planned",
          description: isBusinessReady
            ? "Business operations lane is enabled for commerce, property, credit, and planning workflows."
            : agent.description,
        };
      }
      return agent;
    });
    res.json({
      orchestrator: "ManagerAgent",
      active_agents: normalizedAgents.filter((a) => a.status === "active"),
      planned_agents: normalizedAgents.filter((a) => a.status === "planned"),
      integrations: settings.integrations,
      status: "operational",
    });
  });

  app.post("/api/voice/transcribe", isAuthenticated, async (_req: any, res) => {
    res.json({
      transcript: "",
      note: "Server-side transcription requires Whisper. Using browser Speech API instead.",
    });
  });

  app.get("/api/admin/knowledge/overview", isAdmin, async (_req, res) => {
    try {
      const settings = await loadAdminSettings();
      const defaultUserId = settings.users?.[0]?.id || "admin-user";
      const { MemoryService } = await import("../services/memoryService");
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

  app.get("/api/admin/system-test", async (_req, res) => {
    const ollama = await checkOllamaHealth();
    res.json({
      system: "ZED",
      ai: getActiveProviderName({ lane: "chat" }),
      target: getResolvedTargetName({ lane: "chat" }),
      ollama: ollama.status,
      database: opts.isDatabaseHealthy() ? "connected" : "offline",
    });
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message) return res.status(400).json({ error: "Message required" });
      const prompt = buildOllamaPrompt(message);
      const options = { lane: "chat" as const };
      const reply = await generateFromOllama(prompt, options);
      res.json({
        reply,
        provider: getActiveProviderName(options),
        target: getResolvedTargetName(options),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Chat failed", reply: "Error processing request" });
    }
  });
}
