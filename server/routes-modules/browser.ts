import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import { BrowserSessionStore } from "../services/BrowserSessionStore";
import { fetchSingleUrl } from "../services/WebContentService";
import { ownerUserIdFromAuthenticatedRequest } from "../services/auth/OwnerContext";

/**
 * The console's live browser. Both the user (via the "Go" action) and ZAR
 * (via IntelligenceAgent's own web lookups, see server/agents/intelligence/
 * IntelligenceAgent.ts) record into the same per-user BrowserSessionStore,
 * so either side's browsing shows up here.
 */

export function registerBrowserRoutes(app: Express): void {
  app.get("/api/browser/session", isAuthenticated, async (req: any, res) => {
    try {
      const session = await BrowserSessionStore.getSession(ownerUserIdFromAuthenticatedRequest(req));
      res.json(session);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load browser session" });
    }
  });

  app.post("/api/browser/navigate", isAuthenticated, async (req: any, res) => {
    const url = String(req.body?.url || "").trim();
    if (!url) return res.status(400).json({ error: "url is required" });

    const userId = ownerUserIdFromAuthenticatedRequest(req);
    try {
      const page = await fetchSingleUrl(url);
      const visit = await BrowserSessionStore.recordVisit(userId, {
        url: page.url,
        title: page.title,
        text: page.text,
        sanitizedHtml: page.sanitizedHtml,
        status: page.status,
        source: "user",
      });
      res.json({ ok: true, visit });
    } catch (err: any) {
      const visit = await BrowserSessionStore.recordVisit(userId, {
        url,
        error: err?.message || "Failed to load that page",
        source: "user",
      });
      res.status(422).json({ ok: false, error: visit.error, visit });
    }
  });
}
