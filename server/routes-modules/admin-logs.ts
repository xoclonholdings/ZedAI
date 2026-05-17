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
}
