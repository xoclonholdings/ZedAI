/**
 * registerExecutionRoutes
 *
 * Adds the additive HTTP surface for the new execution + approval +
 * workflow + operational layers. No existing routes are touched.
 *
 * All endpoints are namespaced under /api/execution, /api/approval,
 * /api/workflow and /api/operational so they cannot collide with the
 * existing surface.
 *
 * Mobile-first: every payload is JSON only — no UI changes required.
 */

import type { Express, Request, Response } from "express";
import { isAuthenticated, isAdmin } from "../../localAuth";
import { ExecutionPipeline } from "./ExecutionPipeline";
import { TaskLifecycleManager } from "./TaskLifecycleManager";
import { TaskExecutionEngine } from "./TaskExecutionEngine";
import { ApprovalWatchdog } from "../approval/ApprovalWatchdog";
import { ApprovalDecisionHandler } from "../approval/ApprovalDecisionHandler";
import { ApprovalNotificationService } from "../approval/ApprovalNotificationService";
import { HumanExecutionBridge } from "./HumanExecutionBridge";
import { EmailInboxWatchdog } from "../workflow/EmailInboxWatchdog";
import { PriorityClassificationEngine } from "../workflow/PriorityClassificationEngine";
import { VoiceMatchedDraftingEngine } from "../workflow/VoiceMatchedDraftingEngine";
import { SchedulingAssistant } from "../workflow/SchedulingAssistant";
import { MeetingFollowUpGenerator } from "../workflow/MeetingFollowUpGenerator";
import { OmnichannelMemoryService } from "../operational/OmnichannelMemoryService";
import { AutonomousFollowUpEngine } from "../operational/AutonomousFollowUpEngine";
import { ToolOrchestrationEngine } from "../operational/ToolOrchestrationEngine";
import { DeferredActionScheduler } from "../operational/DeferredActionScheduler";

function userIdFrom(req: any): string | null {
  return req?.user?.claims?.sub || req?.session?.userId || null;
}

export function registerExecutionRoutes(app: Express): void {
  // ─── Execution Layer ─────────────────────────────────────────────────────

  app.post("/api/execution/prepare", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { user_request, context, conversation_id } = req.body || {};
      if (!user_request || typeof user_request !== "string") {
        return res.status(400).json({ error: "user_request is required" });
      }
      const user_id = userIdFrom(req);
      if (!user_id) return res.status(401).json({ error: "Unauthenticated" });
      const prepared = await ExecutionPipeline.prepare(
        user_id,
        { user_request, context },
        conversation_id || null,
      );
      // Run the watchdog so approval state is set before the client renders.
      await ApprovalWatchdog.evaluate(prepared.task);
      const refreshed = await TaskLifecycleManager.get(prepared.task.id);
      res.json({ ...prepared, task: refreshed });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "prepare failed" });
    }
  });

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
      const { task_id, approved, approver_role, notes } = req.body || {};
      if (!task_id || typeof approved !== "boolean") {
        return res.status(400).json({ error: "task_id and approved are required" });
      }
      const user_id = userIdFrom(req);
      if (!user_id) return res.status(401).json({ error: "Unauthenticated" });
      const result = await ExecutionPipeline.approve({
        task_id,
        user_id,
        approved,
        approver_role: approver_role || "user",
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
      const user_id = userIdFrom(req);
      const tasks = await TaskLifecycleManager.list({ user_id: user_id || undefined });
      res.json({ tasks });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "list failed" });
    }
  });

  app.get("/api/execution/tasks/:id", isAuthenticated, async (req: any, res: Response) => {
    try {
      const task = await TaskLifecycleManager.get(req.params.id);
      if (!task) return res.status(404).json({ error: "task not found" });
      res.json({ task });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "fetch failed" });
    }
  });

  app.get("/api/execution/human-bridge", isAdmin, async (_req, res: Response) => {
    try {
      const entries = await HumanExecutionBridge.list();
      res.json({ entries });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "list failed" });
    }
  });

  // ─── Approval Layer ──────────────────────────────────────────────────────

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
      const { task_id, action, reason, manual_handling_notes, decider_role } = req.body || {};
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
        recipient_id: role === "user" ? user_id || undefined : undefined,
        unread_only: req.query.unread === "true",
      });
      res.json({ notifications: items });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "list failed" });
    }
  });

  app.post("/api/approval/notifications/:id/read", isAuthenticated, async (req: any, res: Response) => {
    try {
      const ok = await ApprovalNotificationService.markRead(req.params.id);
      res.json({ ok });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "mark failed" });
    }
  });

  // ─── Workflow Layer (Demi-style) ─────────────────────────────────────────

  app.post("/api/workflow/inbox/inspect", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { messages } = req.body || {};
      if (!Array.isArray(messages)) {
        return res.status(400).json({ error: "messages array is required" });
      }
      const findings = await EmailInboxWatchdog.inspect(messages);
      res.json({ findings });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "inspect failed" });
    }
  });

  app.post("/api/workflow/classify", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const result = PriorityClassificationEngine.classify(req.body || {});
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "classify failed" });
    }
  });

  app.post("/api/workflow/draft", isAuthenticated, async (req: any, res: Response) => {
    try {
      const user_id = userIdFrom(req) || "anonymous";
      const { thread_summary, desired_intent, voice_samples, context } = req.body || {};
      if (!thread_summary || !desired_intent) {
        return res.status(400).json({ error: "thread_summary and desired_intent are required" });
      }
      const draft = VoiceMatchedDraftingEngine.draft({
        user_id,
        thread_summary,
        desired_intent,
        voice_samples,
        context,
      });
      res.json(draft);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "draft failed" });
    }
  });

  app.post("/api/workflow/scheduling", isAuthenticated, async (req: any, res: Response) => {
    try {
      const user_id = userIdFrom(req) || "anonymous";
      const { preferred_duration_minutes, message_excerpt, availability, timezone } = req.body || {};
      const draft = SchedulingAssistant.prepare({
        user_id,
        preferred_duration_minutes: Number(preferred_duration_minutes) || 30,
        message_excerpt: message_excerpt || "",
        availability,
        timezone,
      });
      res.json(draft);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "scheduling failed" });
    }
  });

  app.post("/api/workflow/meeting-follow-up", isAuthenticated, async (req: any, res: Response) => {
    try {
      const user_id = userIdFrom(req) || "anonymous";
      const { meeting_title, participants, notes_or_transcript, occurred_at } = req.body || {};
      if (!meeting_title || !notes_or_transcript) {
        return res.status(400).json({ error: "meeting_title and notes_or_transcript are required" });
      }
      const result = MeetingFollowUpGenerator.generate({
        user_id,
        meeting_title,
        participants,
        notes_or_transcript,
        occurred_at,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "follow-up failed" });
    }
  });

  // ─── Operational Layer (Newo-style) ──────────────────────────────────────

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
        channel: typeof req.query.channel === "string" ? (req.query.channel as any) : undefined,
        related_task_id: typeof req.query.task_id === "string" ? req.query.task_id : undefined,
        user_id,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });
      res.json({ entries: items });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "search failed" });
    }
  });

  app.post("/api/operational/follow-up", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { task_id, follow_up_type, scheduled_for, notes } = req.body || {};
      if (!task_id || !follow_up_type || !scheduled_for) {
        return res.status(400).json({ error: "task_id, follow_up_type, scheduled_for are required" });
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
  });

  app.post("/api/operational/follow-up/tick", isAdmin, async (_req, res: Response) => {
    try {
      const result = await AutonomousFollowUpEngine.tick();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "tick failed" });
    }
  });

  app.post("/api/operational/orchestrate", isAuthenticated, async (req: any, res: Response) => {
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
  });

  app.post("/api/operational/defer", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const action = await DeferredActionScheduler.schedule(req.body || {});
      res.json({ action });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "defer failed" });
    }
  });

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

export default registerExecutionRoutes;
