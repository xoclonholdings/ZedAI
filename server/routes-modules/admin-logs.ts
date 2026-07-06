import fs from "fs/promises";
import path from "path";
import type { Express } from "express";

import { isAdmin } from "../localAuth";
import { HUB_LOG_DIR } from "../utils/repoPaths";
import { getRecentRuntimeEvents, logRuntimeEvent } from "../services/RuntimeLogger";
import { getRecentSecurityEvents } from "../services/SecurityAudit";

/**
 * Logs surfaces for the admin panel:
 *   GET /api/admin/logs           routing log entries + runtime events
 *   POST /api/client-log          client-side error ingestion
 *   GET /api/admin/security-log   auth / tier / approval audit trail
 *
 * No auth on /api/client-log because the browser can post unhandled
 * errors even after a session expires. Body is bounded by Express's
 * default JSON limit so this isn't an abuse vector.
 */
export function registerAdminLogsRoutes(app: Express): void {
  app.get("/api/admin/logs", isAdmin, async (_req, res) => {
    try {
      await fs.mkdir(HUB_LOG_DIR, { recursive: true });
      const files = await fs.readdir(HUB_LOG_DIR);
      const recent = files.sort().slice(-3);
      const entries: string[] = [];
      for (const f of recent) {
        try {
          const content = await fs.readFile(path.join(HUB_LOG_DIR, f), "utf-8");
          entries.push(...content.trim().split("\n").filter(Boolean));
        } catch {
          /* ignore missing/unreadable rotated log */
        }
      }
      const runtime = await getRecentRuntimeEvents(100);
      res.json({ entries: entries.slice(-100), runtime });
    } catch {
      res.json({ entries: [], runtime: [] });
    }
  });

  app.post("/api/client-log", async (req, res) => {
    try {
      const { level = "error", event = "client.error", detail, context } = req.body || {};
      await logRuntimeEvent({ level, source: "client", event, detail, context });
      res.json({ ok: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to write client log" });
    }
  });

  app.get("/api/admin/security-log", isAdmin, async (_req, res) => {
    res.json({ events: await getRecentSecurityEvents(100) });
  });

  // ── Execution traces ────────────────────────────────────────────
  // Filters runtime.log for chat.execution.trace events. Each entry
  // includes traceId, route, selectedAgent, executionStatus,
  // failureReason, servicesInvoked, providerUsed, and any recorded
  // presentationAdjustments. Validation violations surface as
  // trace.validation.violation entries alongside.
  app.get("/api/admin/traces", isAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt((req.query.limit as string) || "50", 10) || 50, 500);
      const events = await getRecentRuntimeEvents(limit * 4);
      const traces = events
        .filter(
          (e) =>
            e.event === "chat.execution.trace" ||
            e.event === "trace.validation.violation" ||
            e.event === "chat.execution.failed",
        )
        .slice(-limit)
        .reverse();
      res.json({ traces });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load traces" });
    }
  });
}
