import type { Express } from "express";
import { ZCOS_INTELLIGENCE_SCHEMA_VERSION } from "../../shared/zcos-intelligence";

import { isAdmin, isAuthenticated } from "../localAuth";
import { KnowledgeCurationEngine } from "../services/KnowledgeCurationEngine";
import { checkModelProviderHealth } from "../services/ModelProviderService";
import {
  getActiveProviderName,
  getResolvedTargetName,
} from "../core/providers/provider-executor";
import { getPublicAdminSettings } from "../services/AdminSettingsStore";
import { ChatExecutionService } from "../services/ChatExecutionService";
import { ownerUserIdFromAuthenticatedRequest } from "../services/auth/OwnerContext";
import { zcosCapabilityRegistry } from "../zcos/capabilities/ZcosCapabilityRegistry";

/**
 * Orchestrator + a handful of small one-shot endpoints. They live
 * together because each is too small to deserve its own module but
 * they share dependencies (provider executor, KnowledgeService,
 * AdminSettingsStore).
 *
 * Endpoints:
 *   POST /api/orchestrate           Autonomous ZAR dispatch through ZCOS
 *   GET  /api/orchestrate/status    Active vs planned agents + integrations
 *   POST /api/voice/transcribe      Stub for future Whisper integration
 *   GET  /api/admin/knowledge/overview  Counts + curation health for the admin Knowledge tab
 *   GET  /api/admin/system-test     Cheap admin-only status probe
 */
export function registerOrchestrateAndMiscRoutes(
  app: Express,
  opts: { isDatabaseHealthy: () => boolean },
): void {
  app.post("/api/orchestrate", isAuthenticated, async (req: any, res) => {
    const { message, conversationId, context, projectId, workspaceId } = req.body || {};
    const result = await ChatExecutionService.execute({
      userId: ownerUserIdFromAuthenticatedRequest(req),
      message,
      conversationId,
      route: "/api/orchestrate",
      ip: req.ip || "",
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
    res.json({
      orchestrator: "ZCOSCapabilityRuntime",
      orchestrationMode: "governed-typed-capability-plan",
      operator: settings.agents[0],
      active_agents: settings.agents,
      planned_agents: [],
      capabilities: zcosCapabilityRegistry.list().map((capability) => ({
        id: capability.id,
        ownerGalaxy: capability.ownerGalaxy,
        operations: capability.operations,
        requiredIntegrations: capability.requiredIntegrations,
        certificationState: capability.certificationState,
        approvalRequired: capability.approvalRequired,
        version: capability.version,
      })),
      integrations: settings.integrations,
      status: "operational",
    });
  });

  app.get("/api/zcos/capabilities", isAuthenticated, (_req, res) => {
    res.json({
      schemaVersion: ZCOS_INTELLIGENCE_SCHEMA_VERSION,
      settingsPath: "/settings/integrations",
      capabilities: zcosCapabilityRegistry.list(),
    });
  });

  app.post("/api/voice/transcribe", isAuthenticated, async (_req: any, res) => {
    res.json({
      transcript: "",
      note: "Server-side transcription requires Whisper. Using browser Speech API instead.",
    });
  });

  app.get("/api/admin/knowledge/overview", isAdmin, async (req, res) => {
    try {
      const defaultUserId = ownerUserIdFromAuthenticatedRequest(req);
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
    const aiHealth = await checkModelProviderHealth();
    res.json({
      system: "ZAR",
      ai: getActiveProviderName({ lane: "chat" }),
      target: getResolvedTargetName({ lane: "chat" }),
      aiProvider: aiHealth.status,
      database: opts.isDatabaseHealthy() ? "connected" : "offline",
    });
  });
}
