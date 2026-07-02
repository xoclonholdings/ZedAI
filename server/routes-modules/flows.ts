import type { Express } from "express";

import { isAdmin, isAuthenticated } from "../localAuth";
import { FlowStore } from "../services/FlowStore";
import {
  approveCurrentStage,
  cancelFlowRun,
  executeFlowRun,
  rejectCurrentStage,
  retryFlowRun,
} from "../zcos/flows/ZcosFlowEngine";

/**
 * Registers all /api/admin/flows* and /api/flows* endpoints.
 *
 * ZED owns the HTTP surface. ZCOS owns flow execution state and lifecycle.
 * Route order matters: /api/flows/runs before /api/flows/:id.
 */
export function registerFlowRoutes(app: Express): void {
  app.get("/api/admin/flows", isAdmin, async (req: any, res) => {
    const includeArchived = String(req.query.includeArchived || "") === "true";
    const flows = await FlowStore.listDefinitions({ includeArchived });
    res.json({ flows });
  });

  app.get("/api/admin/flows/:id", isAdmin, async (req: any, res) => {
    const flow = await FlowStore.getDefinition(req.params.id);
    if (!flow) return res.status(404).json({ error: "Not found" });
    res.json(flow);
  });

  app.post("/api/admin/flows", isAdmin, async (req, res) => {
    try {
      const flow = await FlowStore.createDefinition(req.body);
      res.json(flow);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Failed to create flow" });
    }
  });

  app.put("/api/admin/flows/:id", isAdmin, async (req: any, res) => {
    const flow = await FlowStore.updateDefinition(req.params.id, req.body);
    if (!flow) return res.status(404).json({ error: "Not found" });
    res.json(flow);
  });

  app.post("/api/admin/flows/:id/publish", isAdmin, async (req: any, res) => {
    const flow = await FlowStore.publishDefinition(req.params.id);
    if (!flow) return res.status(404).json({ error: "Not found" });
    res.json(flow);
  });

  app.post("/api/admin/flows/:id/archive", isAdmin, async (req: any, res) => {
    const flow = await FlowStore.archiveDefinition(req.params.id);
    if (!flow) return res.status(404).json({ error: "Not found" });
    res.json(flow);
  });

  app.post("/api/admin/flows/:id/duplicate", isAdmin, async (req: any, res) => {
    const flow = await FlowStore.duplicateDefinition(req.params.id);
    if (!flow) return res.status(404).json({ error: "Not found" });
    res.json(flow);
  });

  app.get("/api/flows", isAuthenticated, async (_req, res) => {
    const flows = await FlowStore.listPublished();
    res.json({
      flows: flows.map((f) => ({
        id: f.id,
        slug: f.slug,
        name: f.name,
        category: f.category,
        userFacingLabel: f.userFacingLabel,
        userFacingBlurb: f.userFacingBlurb,
        icon: f.icon,
        stageCount: f.stages.length,
        agents: f.agents,
      })),
    });
  });

  app.get("/api/flows/runs", isAuthenticated, async (req: any, res) => {
    const runs = await FlowStore.listRuns({
      userId: req.user?.claims?.sub,
      limit: 50,
    });
    res.json({ runs });
  });

  app.get("/api/flows/runs/:runId", isAuthenticated, async (req: any, res) => {
    const run = await FlowStore.getRun(req.params.runId);
    if (!run) return res.status(404).json({ error: "Not found" });
    res.json(run);
  });

  app.get("/api/flows/runs/:runId/report", isAuthenticated, async (req: any, res) => {
    const run = await FlowStore.getRun(req.params.runId);
    if (!run) return res.status(404).json({ error: "Not found" });
    if (!run.report) return res.status(404).json({ error: "Report not generated yet" });
    res.json(run.report);
  });

  app.get("/api/flows/:id", isAuthenticated, async (req: any, res) => {
    const flow = await FlowStore.getDefinition(req.params.id);
    if (!flow || flow.status !== "published") {
      return res.status(404).json({ error: "Not found" });
    }
    res.json(flow);
  });

  app.post("/api/flows/:id/run", isAuthenticated, async (req: any, res) => {
    const flow = await FlowStore.getDefinition(req.params.id);
    if (!flow || flow.status !== "published") {
      return res.status(404).json({ error: "Not found" });
    }
    const run = await FlowStore.startRun({
      flow,
      userId: req.user?.claims?.sub || "anonymous",
      conversationId: req.body?.conversationId,
      context: req.body?.context,
    });
    void executeFlowRun(run.id);
    res.json(run);
  });

  app.post("/api/flows/runs/:runId/approve", isAuthenticated, async (req: any, res) => {
    const run = await approveCurrentStage(
      req.params.runId,
      req.body?.note,
      req.user?.claims?.sub || "user",
      req.user?.claims?.isAdmin ? "admin" : "user",
    );
    if (!run) {
      return res.status(404).json({ error: "Run not found or not pending approval" });
    }
    res.json(run);
  });

  app.post("/api/flows/runs/:runId/reject", isAuthenticated, async (req: any, res) => {
    const run = await rejectCurrentStage(
      req.params.runId,
      req.body?.reason,
      req.user?.claims?.sub || "user",
      req.user?.claims?.isAdmin ? "admin" : "user",
    );
    if (!run) {
      return res.status(404).json({ error: "Run not found or not pending approval" });
    }
    res.json(run);
  });

  app.post("/api/flows/runs/:runId/resume", isAuthenticated, async (req: any, res) => {
    const run = await FlowStore.getRun(req.params.runId);
    if (!run) return res.status(404).json({ error: "Not found" });
    void executeFlowRun(req.params.runId);
    res.json({ ok: true, runId: req.params.runId });
  });

  app.post("/api/flows/runs/:runId/retry", isAuthenticated, async (req: any, res) => {
    const run = await retryFlowRun(req.params.runId);
    if (!run) return res.status(404).json({ error: "Run not found" });
    res.json(run);
  });

  app.post("/api/flows/runs/:runId/cancel", isAuthenticated, async (req: any, res) => {
    const run = await cancelFlowRun(req.params.runId, req.body?.reason);
    if (!run) return res.status(404).json({ error: "Run not found" });
    res.json(run);
  });
}
