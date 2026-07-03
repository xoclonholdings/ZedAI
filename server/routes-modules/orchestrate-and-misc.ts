import type { Express } from "express";

import { isAdmin, isAuthenticated } from "../localAuth";
import { KnowledgeCurationEngine } from "../services/KnowledgeCurationEngine";
import { checkOllamaHealth } from "../services/Ollama/OllamaService";
import {
  getActiveProviderName,
  getResolvedTargetName,
} from "../core/providers/provider-executor";
import {
  getPublicAdminSettings,
  loadAdminSettings,
} from "../services/AdminSettingsStore";
import { ChatExecutionService } from "../services/ChatExecutionService";

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
 *   GET  /api/admin/knowledge/overview  Counts + curation health for the admin Knowledge tab
 *   GET  /api/admin/system-test     Cheap admin-only status probe
 *   POST /api/chat                  Legacy compatibility wrapper through ChatExecutionService
 */
export function registerOrchestrateAndMiscRoutes(
  app: Express,
  opts: { isDatabaseHealthy: () => boolean },
): void {
  app.post("/api/orchestrate", isAuthenticated, async (req: any, res) => {
    const { message, conversationId, targetAgent, context, projectId, workspaceId } = req.body || {};
    const result = await ChatExecutionService.execute({
      userId: req.user.claims.sub,
      message,
      conversationId,
      route: "/api/orchestrate",
      ip: req.ip || "",
      targetAgent,
      isAdmin: Boolean(req.user?.claims?.isAdmin),
      context,
      projectId,
      workspaceId,
      persistUserMessage: true,
    });
    const status = result.error === "message_required" ? 400 : result.error ? 500 : 200;
    res.status(status).json(result);
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
      const [core, project, scratchpad, curation] = await Promise.all([
        MemoryService.getAllCoreMemory(),
        MemoryService.getProjectMemory(defaultUserId).catch(() => []),
        MemoryService.getScratchpadMemory(defaultUserId).catch(() => []),
        KnowledgeCurationEngine.getLatestReview().catch(() => null),
      ]);
      res.json({
        coreCount: core.length,
        projectCount: project.length,
        scratchpadCount: scratchpad.length,
        curation: curation
          ? {
              generatedAt: curation.generatedAt,
              averageHealthScore: curation.summary.averageHealthScore,
              needsReviewCount: curation.summary.needsReviewCount,
              duplicateGroupCount: curation.summary.duplicateGroupCount,
              contradictionCount: curation.summary.contradictionCount,
              orphanedCount: curation.summary.orphanedCount,
              learningGapCount: curation.summary.learningGapCount,
              recommendedQuestionCount: curation.recommendedQuestions.length,
            }
          : null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to load knowledge overview" });
    }
  });

  app.get("/api/admin/system-test", isAdmin, async (_req, res) => {
    const ollama = await checkOllamaHealth();
    res.json({
      system: "ZED",
      ai: getActiveProviderName({ lane: "chat" }),
      target: getResolvedTargetName({ lane: "chat" }),
      ollama: ollama.status,
      database: opts.isDatabaseHealthy() ? "connected" : "offline",
    });
  });

  app.post("/api/chat", isAuthenticated, async (req: any, res) => {
    const result = await ChatExecutionService.execute({
      userId: req.user.claims.sub,
      message: req.body?.message,
      conversationId: req.body?.conversationId,
      route: "/api/chat",
      ip: req.ip || "",
      isAdmin: Boolean(req.user?.claims?.isAdmin),
      context: req.body?.context,
      projectId: req.body?.projectId,
      workspaceId: req.body?.workspaceId,
      persistUserMessage: Boolean(req.body?.conversationId),
    });
    const status = result.error === "message_required" ? 400 : result.error ? 500 : 200;
    res.status(status).json(result);
  });
}
