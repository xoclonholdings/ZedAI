import path from "path";
import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import { BrowserSessionService } from "../services/browser/BrowserSessionService";
import {
  BrowserToolService,
  BROWSER_ACTION_RISK,
  type BrowserActionName,
} from "../services/browser/BrowserToolService";
import { BrowserOperatorService } from "../services/browser/BrowserOperatorService";
import { TaskLifecycleManager } from "../services/execution/TaskLifecycleManager";

/**
 * Deterministic browser automation + goal-directed operator routes.
 * Consequential actions require an approved task in the EXISTING
 * execution/approval pipeline (/api/execution/approve, /api/approval/decide)
 * — this module never carries its own approval mechanism.
 */

function userIdFrom(req: any): string {
  return req.user?.claims?.sub || "unknown";
}

export function registerBrowserRoutes(app: Express): void {
  app.post("/api/browser/sessions", isAuthenticated, async (req: any, res) => {
    try {
      const session = await BrowserSessionService.create({
        userId: userIdFrom(req),
        conversationId: req.body?.conversationId ? String(req.body.conversationId) : undefined,
        allowedDomains: Array.isArray(req.body?.allowedDomains)
          ? req.body.allowedDomains.map(String)
          : undefined,
      });
      res.json({ session });
    } catch (err: any) {
      res.status(429).json({ error: err?.message || "Failed to create browser session" });
    }
  });

  app.get("/api/browser/sessions", isAuthenticated, async (req: any, res) => {
    res.json({ sessions: await BrowserSessionService.listSessions(userIdFrom(req)) });
  });

  app.get("/api/browser/sessions/:id", isAuthenticated, async (req: any, res) => {
    const record = await BrowserSessionService.getRecord(req.params.id, userIdFrom(req));
    if (!record) return res.status(404).json({ error: "Session not found" });
    res.json({ session: record });
  });

  app.post("/api/browser/sessions/:id/close", isAuthenticated, async (req: any, res) => {
    try {
      const record = await BrowserSessionService.close(req.params.id, userIdFrom(req));
      if (!record) return res.status(404).json({ error: "Session not found" });
      res.json({ session: record });
    } catch (err: any) {
      res.status(403).json({ error: err?.message || "Failed to close session" });
    }
  });

  // Typed action execution. Consequential actions without an approved
  // task return approvalRequired plus a freshly created pending task the
  // user can approve through the existing approval surfaces.
  app.post("/api/browser/sessions/:id/actions", isAuthenticated, async (req: any, res) => {
    const userId = userIdFrom(req);
    const action = String(req.body?.action || "") as BrowserActionName;
    if (!BROWSER_ACTION_RISK[action]) {
      return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    const input = {
      sessionId: req.params.id,
      userId,
      action,
      url: req.body?.url ? String(req.body.url) : undefined,
      selector: req.body?.selector ? String(req.body.selector) : undefined,
      text: req.body?.text !== undefined ? String(req.body.text) : undefined,
      value: req.body?.value !== undefined ? String(req.body.value) : undefined,
      key: req.body?.key ? String(req.body.key) : undefined,
      deltaY: req.body?.deltaY !== undefined ? Number(req.body.deltaY) : undefined,
      timeoutMs: req.body?.timeoutMs ? Number(req.body.timeoutMs) : undefined,
      state: req.body?.state,
      filePath: req.body?.filePath ? String(req.body.filePath) : undefined,
      approvalTaskId: req.body?.approvalTaskId ? String(req.body.approvalTaskId) : undefined,
    };

    const result = await BrowserToolService.execute(input);

    if (!result.ok && result.approvalRequired) {
      // Create the pending approval task in the existing lifecycle so the
      // user can approve it from the existing approval UI/endpoints.
      const task = await TaskLifecycleManager.create({
        user_id: userId,
        conversation_id: req.body?.conversationId ? String(req.body.conversationId) : null,
        plan: {
          task_type: "resolve",
          summary: `Browser ${action} on session ${req.params.id}${input.selector ? ` (${input.selector})` : ""}`,
          required_info: [],
          steps: [
            `Execute consequential browser action '${action}' in session ${req.params.id}.`,
            "Only runs after explicit approval.",
          ],
          script: "",
          decision_points: [],
          execution_mode: "digital",
        },
      });
      await TaskLifecycleManager.update(
        task.id,
        { approval_status: "user_required", approval_requested_at: new Date().toISOString() },
        "Browser consequential action awaiting approval",
      );
      return res.status(202).json({ result, approvalTask: task });
    }

    res.json({ result });
  });

  // Screenshot/download artifacts, ownership-checked, served from the
  // session's recorded artifact list only (no arbitrary path reads).
  app.get("/api/browser/sessions/:id/artifacts/:index", isAuthenticated, async (req: any, res) => {
    const record = await BrowserSessionService.getRecord(req.params.id, userIdFrom(req));
    if (!record) return res.status(404).json({ error: "Session not found" });
    const artifact = record.artifacts[Number(req.params.index)];
    if (!artifact) return res.status(404).json({ error: "Artifact not found" });
    res.sendFile(path.resolve(artifact.path));
  });

  // ---- Goal-directed operator ----

  app.post("/api/browser/operator/tasks", isAuthenticated, async (req: any, res) => {
    const goal = String(req.body?.goal || "").trim();
    const startUrl = String(req.body?.startUrl || "").trim();
    if (!goal || !startUrl) return res.status(400).json({ error: "goal and startUrl are required" });
    try {
      const task = await BrowserOperatorService.start({
        userId: userIdFrom(req),
        goal,
        startUrl,
        conversationId: req.body?.conversationId ? String(req.body.conversationId) : undefined,
        allowedDomains: Array.isArray(req.body?.allowedDomains)
          ? req.body.allowedDomains.map(String)
          : undefined,
        maxSteps: req.body?.maxSteps ? Number(req.body.maxSteps) : undefined,
      });
      res.status(202).json({ task });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to start operator task" });
    }
  });

  app.get("/api/browser/operator/tasks/:id", isAuthenticated, async (req: any, res) => {
    const task = await BrowserOperatorService.get(req.params.id, userIdFrom(req));
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json({ task });
  });

  app.post("/api/browser/operator/tasks/:id/cancel", isAuthenticated, async (req: any, res) => {
    const task = await BrowserOperatorService.cancel(req.params.id, userIdFrom(req));
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json({ task });
  });
}
