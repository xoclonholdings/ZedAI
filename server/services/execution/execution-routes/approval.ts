import type { Express, Response } from "express";

import { isAdmin, isAuthenticated } from "../../../localAuth";
import { ApprovalDecisionHandler } from "../../approval/ApprovalDecisionHandler";
import { ApprovalNotificationService } from "../../approval/ApprovalNotificationService";
import { ApprovalWatchdog } from "../../approval/ApprovalWatchdog";

import { userIdFrom } from "./shared";

/**
 * Approval layer endpoints — admin-triggered watchdog sweep,
 * user/admin decision endpoint, and notification list + mark-read
 * for the bell badge in the UI.
 */
export function registerApprovalEndpoints(app: Express): void {
  app.post("/api/approval/sweep", isAdmin, async (_req, res: Response) => {
    try {
      const verdicts = await ApprovalWatchdog.sweep();
      res.json({ verdicts });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "sweep failed" });
    }
  });

  app.post("/api/approval/decide", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { task_id, action, reason, manual_handling_notes, decider_role } =
        req.body || {};
      if (!task_id || !action) {
        return res.status(400).json({ error: "task_id and action are required" });
      }
      const user_id = userIdFrom(req);
      if (!user_id) return res.status(401).json({ error: "Unauthenticated" });
      const result = await ApprovalDecisionHandler.decide({
        task_id,
        decided_by: user_id,
        decider_role: decider_role || "user",
        action,
        reason,
        manual_handling_notes,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "decide failed" });
    }
  });

  app.get("/api/approval/notifications", isAuthenticated, async (req: any, res: Response) => {
    try {
      const user_id = userIdFrom(req);
      const role = req.query.role === "admin" ? "admin" : "user";
      const items = await ApprovalNotificationService.list({
        recipient_role: role,
        // User notifications are scoped to the requester; admin
        // notifications are global so we omit the recipient_id filter.
        recipient_id: role === "user" ? user_id || undefined : undefined,
        unread_only: req.query.unread === "true",
      });
      res.json({ notifications: items });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "list failed" });
    }
  });

  app.post(
    "/api/approval/notifications/:id/read",
    isAuthenticated,
    async (req: any, res: Response) => {
      try {
        const ok = await ApprovalNotificationService.markRead(req.params.id);
        res.json({ ok });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || "mark failed" });
      }
    },
  );
}
