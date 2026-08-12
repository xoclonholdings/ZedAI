import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import { BrowserSessionStore } from "../services/BrowserSessionStore";
import { saveKnowledgeUgcWebsite } from "../services/KnowledgeUgcService";
import { fetchSingleUrl } from "../services/WebContentService";
import { webSearch } from "../services/WebSearchService";
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
        kind: "page",
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
        kind: "page",
        error: err?.message || "Failed to load that page",
        source: "user",
      });
      res.status(422).json({ ok: false, error: visit.error, visit });
    }
  });

  app.post("/api/browser/search", isAuthenticated, async (req: any, res) => {
    const query = String(req.body?.query || "").trim();
    if (!query) return res.status(400).json({ error: "query is required" });

    const userId = ownerUserIdFromAuthenticatedRequest(req);
    try {
      const response = await webSearch(query, 8);
      const visit = await BrowserSessionStore.recordVisit(userId, {
        url: `search:${encodeURIComponent(query)}`,
        kind: "search",
        query,
        title: `Search: ${query}`,
        searchResults: response.results.map(({ title, url, snippet }) => ({ title, url, snippet })),
        source: "user",
        error: response.results.length === 0
          ? "No search results are available. Try a direct website address."
          : undefined,
      });
      res.status(response.results.length > 0 ? 200 : 422).json({
        ok: response.results.length > 0,
        visit,
      });
    } catch (err: any) {
      const visit = await BrowserSessionStore.recordVisit(userId, {
        url: `search:${encodeURIComponent(query)}`,
        kind: "search",
        query,
        title: `Search: ${query}`,
        source: "user",
        error: err?.message || "Search failed",
      });
      res.status(422).json({ ok: false, error: visit.error, visit });
    }
  });

  app.post("/api/knowledge/ugc/websites/from-browser", isAuthenticated, async (req: any, res) => {
    try {
      const userId = ownerUserIdFromAuthenticatedRequest(req);
      const visitId = String(req.body?.visitId || "").trim();
      if (!visitId) return res.status(400).json({ error: "visitId is required" });
      const session = await BrowserSessionStore.getSession(userId);
      const visit = session.history.find((entry) => entry.id === visitId);
      if (!visit || visit.kind === "search" || visit.error || !/^https?:\/\//i.test(visit.url)) {
        return res.status(400).json({ error: "Load a website before saving it to UGC." });
      }
      const item = await saveKnowledgeUgcWebsite({
        userId,
        visitId: visit.id,
        url: visit.url,
        title: visit.title,
        text: visit.text,
        visitedAt: visit.visitedAt,
      });
      res.json({ item });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to save website to Knowledge UGC" });
    }
  });
}
