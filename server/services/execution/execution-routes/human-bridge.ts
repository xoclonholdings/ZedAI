import type { Express, Response } from "express";

import { isAdmin } from "../../../localAuth";
import { HumanExecutionBridge } from "../HumanExecutionBridge";

import { userIdFrom } from "./shared";

/**
 * Admin endpoints for the human-execution bridge — the queue of
 * tasks that escalated out of the autonomous pipeline and need a
 * person to claim, complete, abandon, or requeue them.
 */
export function registerHumanBridgeEndpoints(app: Express): void {
  app.get("/api/execution/human-bridge", isAdmin, async (_req, res: Response) => {
    try {
      const entries = await HumanExecutionBridge.list();
      res.json({ entries });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "list failed" });
    }
  });

  app.post(
    "/api/execution/human-bridge/:id/claim",
    isAdmin,
    async (req: any, res: Response) => {
      try {
        const claimed_by = userIdFrom(req);
        const record = await HumanExecutionBridge.claim(
          req.params.id,
          claimed_by,
          req.body?.notes,
        );
        if (!record) return res.status(404).json({ error: "record not found" });
        res.json({ record });
      } catch (err: any) {
        res.status(400).json({ error: err?.message || "claim failed" });
      }
    },
  );

  app.post(
    "/api/execution/human-bridge/:id/complete",
    isAdmin,
    async (req: any, res: Response) => {
      try {
        const record = await HumanExecutionBridge.complete(req.params.id, req.body?.notes);
        if (!record) return res.status(404).json({ error: "record not found" });
        res.json({ record });
      } catch (err: any) {
        res.status(400).json({ error: err?.message || "complete failed" });
      }
    },
  );

  app.post(
    "/api/execution/human-bridge/:id/abandon",
    isAdmin,
    async (req: any, res: Response) => {
      try {
        const record = await HumanExecutionBridge.abandon(req.params.id, req.body?.notes);
        if (!record) return res.status(404).json({ error: "record not found" });
        res.json({ record });
      } catch (err: any) {
        res.status(400).json({ error: err?.message || "abandon failed" });
      }
    },
  );

  app.post(
    "/api/execution/human-bridge/:id/requeue",
    isAdmin,
    async (req: any, res: Response) => {
      try {
        const record = await HumanExecutionBridge.requeue(req.params.id, req.body?.notes);
        if (!record) return res.status(404).json({ error: "record not found" });
        res.json({ record });
      } catch (err: any) {
        res.status(400).json({ error: err?.message || "requeue failed" });
      }
    },
  );
}
