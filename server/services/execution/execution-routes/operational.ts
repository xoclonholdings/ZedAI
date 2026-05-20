import type { Express, Request, Response } from "express";

import { isAdmin, isAuthenticated } from "../../../localAuth";
import { AutonomousFollowUpEngine } from "../../operational/AutonomousFollowUpEngine";
import { DeferredActionScheduler } from "../../operational/DeferredActionScheduler";
import { OmnichannelMemoryService } from "../../operational/OmnichannelMemoryService";
import { ToolOrchestrationEngine } from "../../operational/ToolOrchestrationEngine";

import { userIdFrom } from "./shared";

/**
 * Operational layer (Newo-style) — append/search omnichannel
 * memory, schedule autonomous follow-ups, run multi-step tool
 * orchestrations, defer actions for later execution.
 *
 * `/api/operational/follow-up/tick` is admin-only because it's the
 * cron-style sweep that actually fires scheduled follow-ups.
 */
export function registerOperationalEndpoints(app: Express): void {
  app.post("/api/operational/memory", isAuthenticated, async (req: any, res: Response) => {
    try {
      const user_id = userIdFrom(req);
      const entry = await OmnichannelMemoryService.append({
        ...req.body,
        user_id: req.body?.user_id ?? user_id ?? null,
      });
      res.json({ entry });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "append failed" });
    }
  });

  app.get("/api/operational/memory", isAuthenticated, async (req: any, res: Response) => {
    try {
      const user_id = userIdFrom(req) || undefined;
      const items = await OmnichannelMemoryService.search({
        text: typeof req.query.q === "string" ? req.query.q : undefined,
        channel:
          typeof req.query.channel === "string"
            ? (req.query.channel as any)
            : undefined,
        related_task_id:
          typeof req.query.task_id === "string" ? req.query.task_id : undefined,
        user_id,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });
      res.json({ entries: items });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "search failed" });
    }
  });

  app.post(
    "/api/operational/follow-up",
    isAuthenticated,
    async (req: any, res: Response) => {
      try {
        const { task_id, follow_up_type, scheduled_for, notes } = req.body || {};
        if (!task_id || !follow_up_type || !scheduled_for) {
          return res
            .status(400)
            .json({ error: "task_id, follow_up_type, scheduled_for are required" });
        }
        const action = await AutonomousFollowUpEngine.schedule({
          task_id,
          follow_up_type,
          scheduled_for,
          notes,
        });
        res.json({ action });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || "schedule failed" });
      }
    },
  );

  app.post("/api/operational/follow-up/tick", isAdmin, async (_req, res: Response) => {
    try {
      const result = await AutonomousFollowUpEngine.tick();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "tick failed" });
    }
  });

  app.post(
    "/api/operational/orchestrate",
    isAuthenticated,
    async (req: any, res: Response) => {
      try {
        const { task_id, steps, approved } = req.body || {};
        const user_id = userIdFrom(req);
        if (!task_id || !Array.isArray(steps)) {
          return res.status(400).json({ error: "task_id and steps[] are required" });
        }
        if (!user_id) return res.status(401).json({ error: "Unauthenticated" });
        const result = await ToolOrchestrationEngine.run({
          task_id,
          user_id,
          steps,
          approved: !!approved,
        });
        res.json(result);
      } catch (err: any) {
        res.status(500).json({ error: err?.message || "orchestrate failed" });
      }
    },
  );

  app.post(
    "/api/operational/defer",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const action = await DeferredActionScheduler.schedule(req.body || {});
        res.json({ action });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || "defer failed" });
      }
    },
  );

  app.get("/api/operational/defer", isAuthenticated, async (req: any, res: Response) => {
    try {
      const items = await DeferredActionScheduler.list({
        task_id: typeof req.query.task_id === "string" ? req.query.task_id : undefined,
        kind: typeof req.query.kind === "string" ? (req.query.kind as any) : undefined,
        include_completed: req.query.include_completed === "true",
      });
      res.json({ actions: items });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "list failed" });
    }
  });
}
