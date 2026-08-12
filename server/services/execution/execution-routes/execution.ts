import type { Express, Request, Response } from "express";

import { isAuthenticated } from "../../../localAuth";
import { ApprovalWatchdog } from "../../approval/ApprovalWatchdog";
import { ApprovalNotificationService } from "../../approval/ApprovalNotificationService";
import { DeferredActionScheduler } from "../../operational/DeferredActionScheduler";
import { ExecutionPipeline } from "../ExecutionPipeline";
import { TaskExecutionEngine } from "../TaskExecutionEngine";
import { TaskLifecycleManager } from "../TaskLifecycleManager";

import { ownerContextFrom, userIdFrom } from "./shared";

/**
 * Core execution endpoints — prepare → preview → approve → dispatch
 * pipeline plus task list/get reads. The approval watchdog is run
 * inline on `prepare` so the task's approval state is settled
 * before the client renders it.
 */
export function registerExecutionEndpoints(app: Express): void {
  app.post("/api/execution/prepare", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { user_request, context, conversation_id } = req.body || {};
      if (!user_request || typeof user_request !== "string") {
        return res.status(400).json({ error: "user_request is required" });
      }
      const user_id = userIdFrom(req);
      const prepared = await ExecutionPipeline.prepare(
        user_id,
        { user_request, context },
        conversation_id || null,
      );
      // Run the watchdog so approval state is set before the client
      // renders the task.
      await ApprovalWatchdog.evaluate(prepared.task);
      await ApprovalNotificationService.notify({
        recipient_role: "user",
        recipient_id: user_id,
        task_id: prepared.task.id,
        title: "ZAR suggested a task",
        message: prepared.task.plan.summary,
        action_type: "approve",
        approval_required: true,
        target_surface: "task",
        category: "suggestion",
        dedupe_key: `suggestion:${prepared.task.id}`,
      });
      const refreshed = await TaskLifecycleManager.get(prepared.task.id);
      res.json({ ...prepared, task: refreshed });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "prepare failed" });
    }
  });

  // No auth — preview is a pure plan generator that doesn't touch
  // any persisted state. Used by tooling that wants to "what would
  // happen if" a request.
  app.post("/api/execution/preview", async (req: Request, res: Response) => {
    try {
      const { user_request, context } = req.body || {};
      if (!user_request || typeof user_request !== "string") {
        return res.status(400).json({ error: "user_request is required" });
      }
      const plan = TaskExecutionEngine.prepare({ user_request, context });
      res.json({ plan });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "preview failed" });
    }
  });

  app.post("/api/execution/approve", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { task_id, approved, notes } = req.body || {};
      if (!task_id || typeof approved !== "boolean") {
        return res.status(400).json({ error: "task_id and approved are required" });
      }
      const result = await ExecutionPipeline.approve({
        task_id,
        actor: ownerContextFrom(req),
        actor_role: req.user?.claims?.isAdmin ? "admin" : "user",
        approved,
        notes,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "approve failed" });
    }
  });

  app.post("/api/execution/dispatch", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { task_id, action_type, payload, notes } = req.body || {};
      if (!task_id) return res.status(400).json({ error: "task_id is required" });
      const result = await ExecutionPipeline.dispatch({
        task_id,
        actor: ownerContextFrom(req),
        actor_role: req.user?.claims?.isAdmin ? "admin" : "user",
        action_type,
        payload,
        notes,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "dispatch failed" });
    }
  });

  app.get("/api/execution/tasks", isAuthenticated, async (req: any, res: Response) => {
    try {
      const tasks = await TaskLifecycleManager.listForOwner(ownerContextFrom(req));
      res.json({ tasks });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "list failed" });
    }
  });

  app.post("/api/execution/tasks", isAuthenticated, async (req: any, res: Response) => {
    try {
      const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
      const assignee = req.body?.assignee;
      const scheduledFor = req.body?.scheduled_for || null;
      if (!text) return res.status(400).json({ error: "text is required" });
      if (!["user", "zar", "both"].includes(assignee)) {
        return res.status(400).json({ error: "assignee must be user, zar, or both" });
      }
      if (scheduledFor && Number.isNaN(new Date(scheduledFor).getTime())) {
        return res.status(400).json({ error: "scheduled_for must be a valid date" });
      }

      const user_id = userIdFrom(req);
      const task = await TaskLifecycleManager.create({
        user_id,
        plan: TaskExecutionEngine.prepare({ user_request: text }),
        initial_status: "approved",
        origin: "user",
        assignee,
        scheduled_for: scheduledFor,
        acceptance_status: "accepted",
      });

      if (scheduledFor) {
        await DeferredActionScheduler.schedule({
          task_id: task.id,
          kind: "reminder",
          scheduled_for: scheduledFor,
          notes: assignee === "user"
            ? "This task is scheduled for you."
            : "This scheduled task is ready for review or approved execution.",
        });
      }

      res.json({ task });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "create failed" });
    }
  });

  app.post("/api/execution/tasks/:id/acceptance", isAuthenticated, async (req: any, res: Response) => {
    try {
      const task = await TaskLifecycleManager.getForOwner(req.params.id, ownerContextFrom(req));
      if (!task) return res.status(404).json({ error: "task not found" });
      const accepted = req.body?.accepted;
      if (typeof accepted !== "boolean") {
        return res.status(400).json({ error: "accepted is required" });
      }
      const updated = await TaskLifecycleManager.update(
        task.id,
        {
          acceptance_status: accepted ? "accepted" : "denied",
          ...(accepted ? {} : { status: "blocked", approval_status: "rejected" as const }),
        },
        accepted ? "ZAR suggestion accepted" : "ZAR suggestion denied",
      );
      await ApprovalNotificationService.markTaskCategoryRead(task.id, "suggestion");
      res.json({ task: updated });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "acceptance failed" });
    }
  });

  app.post("/api/execution/tasks/:id/complete", isAuthenticated, async (req: any, res: Response) => {
    try {
      const task = await TaskLifecycleManager.getForOwner(req.params.id, ownerContextFrom(req));
      if (!task) return res.status(404).json({ error: "task not found" });
      const updated = await TaskLifecycleManager.update(task.id, { status: "complete" }, "Task completed");
      res.json({ task: updated });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "completion failed" });
    }
  });

  app.get("/api/execution/tasks/:id", isAuthenticated, async (req: any, res: Response) => {
    try {
      const task = await TaskLifecycleManager.getForOwner(
        req.params.id,
        ownerContextFrom(req),
      );
      if (!task) return res.status(404).json({ error: "task not found" });
      res.json({ task });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "fetch failed" });
    }
  });
}
