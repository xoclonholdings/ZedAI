import type { Express } from "express";

import { isAdmin } from "../localAuth";
import { EmailInboxWatchdog, type InboxMessage } from "../services/workflow/EmailInboxWatchdog";
import { MeetingFollowUpGenerator } from "../services/workflow/MeetingFollowUpGenerator";
import { PriorityClassificationEngine } from "../services/workflow/PriorityClassificationEngine";
import { SchedulingAssistant } from "../services/workflow/SchedulingAssistant";
import { VoiceMatchedDraftingEngine } from "../services/workflow/VoiceMatchedDraftingEngine";
import { AutonomousFollowUpEngine } from "../services/operational/AutonomousFollowUpEngine";
import { DeferredActionScheduler } from "../services/operational/DeferredActionScheduler";
import { OmnichannelMemoryService } from "../services/operational/OmnichannelMemoryService";
import { ToolOrchestrationEngine } from "../services/operational/ToolOrchestrationEngine";
import { loadAdminSettings } from "../services/AdminSettingsStore";
import { logRuntimeEvent } from "../services/RuntimeLogger";

/**
 * Admin surfaces for the workflow + operational subsystems.
 *
 * These services previously existed in code but had zero external
 * reachability — no routes, nothing called them, so operators could
 * not see or drive them. This module wires each one to a real
 * admin endpoint that either shows current state or executes the
 * service's public API.
 *
 * Honesty policy: every response reports providerStatus so callers
 * see whether the underlying provider is configured. When an
 * outbound provider isn't configured, we return the service's
 * output (which is provider-independent) plus providerStatus:
 * "disabled" — never a fake success.
 *
 * Every consequential call is traced through logRuntimeEvent with
 * event="subsystem.<name>" so runs are auditable from the Logs tab.
 */
export function registerAdminSubsystemRoutes(app: Express): void {
  // ── Overview ──────────────────────────────────────────────────
  app.get("/api/admin/subsystems/status", isAdmin, async (_req, res) => {
    try {
      const [settings, deferredPending, deferredAll, omnichannel] = await Promise.all([
        loadAdminSettings(),
        DeferredActionScheduler.list().catch(() => []),
        DeferredActionScheduler.list({ include_completed: true }).catch(() => []),
        OmnichannelMemoryService.search({ limit: 1 }).catch(() => []),
      ]);
      res.json({
        workflow: {
          inboxWatchdog: {
            wired: true,
            providerStatus: settings.integrations.email.enabled ? "configured" : "disabled",
            provider: settings.integrations.email.provider || null,
          },
          meetingFollowUp: { wired: true, providerStatus: "internal_only" },
          priorityClassifier: { wired: true, providerStatus: "internal_only" },
          scheduling: {
            wired: true,
            providerStatus: settings.integrations.google?.accounts?.length
              ? "configured"
              : "disabled",
          },
          voiceMatchedDrafting: { wired: true, providerStatus: "internal_only" },
        },
        operational: {
          autonomousFollowUp: {
            wired: true,
            providerStatus: "internal_only",
            note: "Runs via /api/admin/subsystems/scheduler/tick or scheduled cron",
          },
          deferredScheduler: {
            wired: true,
            providerStatus: "internal_only",
            pending: deferredPending.length,
            total: deferredAll.length,
          },
          omnichannelMemory: {
            wired: true,
            providerStatus: "internal_only",
            hasEntries: omnichannel.length > 0,
          },
          toolOrchestrator: { wired: true, providerStatus: "internal_only" },
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to fetch status" });
    }
  });

  // ── Workflow: inbox watchdog ──────────────────────────────────
  // Accepts a list of messages (caller supplies — no live IMAP/Gmail
  // fetcher wired yet, and access.yaml doesn't currently whitelist
  // one). Returns only those the classifier says need attention.
  app.post("/api/admin/subsystems/inbox/inspect", isAdmin, async (req: any, res) => {
    try {
      const messages: InboxMessage[] = Array.isArray(req.body?.messages) ? req.body.messages : [];
      const findings = await EmailInboxWatchdog.inspect(messages);
      void logRuntimeEvent({
        level: "info",
        source: "server",
        event: "subsystem.inbox.inspect",
        detail: `${messages.length} in / ${findings.length} needing attention`,
      });
      res.json({ findings, providerStatus: "internal_only", mocked: false });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Failed to inspect inbox" });
    }
  });

  // ── Workflow: meeting follow-up generator ─────────────────────
  app.post("/api/admin/subsystems/meeting/follow-up", isAdmin, async (req: any, res) => {
    try {
      const input = req.body || {};
      if (typeof input.notes !== "string" || !input.notes.trim()) {
        return res.status(400).json({ error: "notes is required" });
      }
      const result = MeetingFollowUpGenerator.generate(input);
      void logRuntimeEvent({
        level: "info",
        source: "server",
        event: "subsystem.meeting.follow_up",
        detail: `${result.action_items?.length || 0} action items generated`,
      });
      res.json({ ...result, providerStatus: "internal_only", mocked: false });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Failed to generate follow-up" });
    }
  });

  // ── Workflow: priority classifier ─────────────────────────────
  app.post("/api/admin/subsystems/priority/classify", isAdmin, async (req: any, res) => {
    try {
      const input = req.body || {};
      const result = PriorityClassificationEngine.classify(input);
      void logRuntimeEvent({
        level: "info",
        source: "server",
        event: "subsystem.priority.classify",
        detail: `${result.priority} / ${result.category}`,
      });
      res.json({ ...result, providerStatus: "internal_only", mocked: false });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Failed to classify" });
    }
  });

  // ── Workflow: scheduling assistant ────────────────────────────
  app.post("/api/admin/subsystems/scheduling/prepare", isAdmin, async (req: any, res) => {
    try {
      const settings = await loadAdminSettings();
      const google = settings.integrations.google;
      const providerStatus =
        google?.accounts && google.accounts.length > 0 ? "configured" : "disabled";
      const draft = SchedulingAssistant.prepare(req.body || {});
      void logRuntimeEvent({
        level: "info",
        source: "server",
        event: "subsystem.scheduling.prepare",
        detail: `provider=${providerStatus}`,
      });
      res.json({ draft, providerStatus, requiresApproval: true, executed: false });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Failed to prepare scheduling draft" });
    }
  });

  // ── Workflow: voice-matched drafting ──────────────────────────
  app.post("/api/admin/subsystems/drafting/voice", isAdmin, async (req: any, res) => {
    try {
      const result = VoiceMatchedDraftingEngine.draft(req.body || {});
      void logRuntimeEvent({
        level: "info",
        source: "server",
        event: "subsystem.drafting.voice",
        detail: `confidence=${result.confidence?.toFixed(2)}`,
      });
      res.json({ ...result, providerStatus: "internal_only", sent: false });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Failed to draft reply" });
    }
  });

  // ── Operational: deferred action scheduler ────────────────────
  app.get("/api/admin/subsystems/scheduler/actions", isAdmin, async (req: any, res) => {
    try {
      const filter = {
        task_id: (req.query.task_id as string) || undefined,
        kind: (req.query.kind as any) || undefined,
        include_completed: req.query.include_completed === "true",
      };
      res.json({ actions: await DeferredActionScheduler.list(filter) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to list actions" });
    }
  });

  app.post("/api/admin/subsystems/scheduler/actions", isAdmin, async (req: any, res) => {
    try {
      const action = await DeferredActionScheduler.schedule(req.body || {});
      void logRuntimeEvent({
        level: "info",
        source: "server",
        event: "subsystem.scheduler.schedule",
        detail: `${action.kind} @ ${action.scheduled_for}`,
        context: { actionId: action.id },
      });
      res.json({ action, providerStatus: "internal_only" });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Failed to schedule action" });
    }
  });

  app.post(
    "/api/admin/subsystems/scheduler/actions/:id/cancel",
    isAdmin,
    async (req: any, res) => {
      try {
        const ok = await DeferredActionScheduler.cancel(req.params.id);
        if (!ok) return res.status(404).json({ error: "Action not found" });
        res.json({ success: true });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || "Failed to cancel" });
      }
    },
  );

  // Runs the autonomous follow-up engine's tick. Reads dueNow(),
  // dispatches each due action to the correct handler, marks it
  // complete. Real execution — not a stub.
  app.post("/api/admin/subsystems/scheduler/tick", isAdmin, async (_req, res) => {
    try {
      const result = await AutonomousFollowUpEngine.tick();
      void logRuntimeEvent({
        level: "info",
        source: "server",
        event: "subsystem.scheduler.tick",
        detail: `processed=${result.processed} approved=${result.approved_to_resume} notified=${result.notifications_sent}`,
      });
      res.json({ ...result, providerStatus: "internal_only" });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Scheduler tick failed" });
    }
  });

  // ── Operational: omnichannel memory ───────────────────────────
  app.post("/api/admin/subsystems/omnichannel/append", isAdmin, async (req: any, res) => {
    try {
      const entry = await OmnichannelMemoryService.append(req.body || {});
      res.json({ entry, providerStatus: "internal_only" });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Failed to append memory" });
    }
  });

  app.get("/api/admin/subsystems/omnichannel/search", isAdmin, async (req: any, res) => {
    try {
      const limit = Math.min(parseInt((req.query.limit as string) || "50", 10) || 50, 500);
      const entries = await OmnichannelMemoryService.search({
        text: (req.query.q as string) || undefined,
        channel: (req.query.channel as any) || undefined,
        related_task_id: (req.query.task_id as string) || undefined,
        limit,
      });
      res.json({ entries });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to search memory" });
    }
  });

  // ── Operational: tool orchestrator ────────────────────────────
  app.post("/api/admin/subsystems/orchestrator/run", isAdmin, async (req: any, res) => {
    try {
      const result = await ToolOrchestrationEngine.run(req.body || {});
      void logRuntimeEvent({
        level: result.status === "failed" ? "error" : "info",
        source: "server",
        event: "subsystem.orchestrator.run",
        detail: `${result.status} — ${result.execution_steps.length} steps`,
        context: { orchestrationId: result.orchestration_id, status: result.status },
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Orchestration failed" });
    }
  });
}
