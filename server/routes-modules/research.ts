import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import {
  deleteSavedResearch,
  listSavedResearch,
  runResearchAction,
  saveResearchItem,
  type ResearchAction,
  type ResearchResult,
} from "../services/research/ResearchEngine";
import { getWebSearchStatus, webSearch } from "../services/WebSearchService";

/**
 * Research workspace routes.
 *
 * Search is the front door. After a search, Zed can summarize, verify, or
 * save the result — or do whatever the user types under "other".
 */

function userIdFrom(req: any): string {
  return req.user?.claims?.sub || "unknown";
}

function toResults(value: unknown): ResearchResult[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((r: any) => ({
      title: String(r?.title || ""),
      url: String(r?.url || ""),
      snippet: String(r?.snippet || ""),
    }))
    .filter((r) => r.title || r.url || r.snippet);
}

export function registerResearchRoutes(app: Express): void {
  // Search — real web search via the existing WebSearchService.
  app.post("/api/research/search", isAuthenticated, async (req: any, res) => {
    const query = String(req.body?.query || "").trim();
    if (!query) return res.status(400).json({ error: "query is required" });
    try {
      const response = await webSearch(query, Math.min(Number(req.body?.count) || 8, 15));
      res.json(response);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Search failed" });
    }
  });

  app.get("/api/research/search/status", isAuthenticated, async (_req: any, res) => {
    const s = getWebSearchStatus();
    res.json({ available: s.braveConfigured || s.serperConfigured, ...s });
  });

  // Do something with a search: summarize / verify / other.
  app.post("/api/research/act", isAuthenticated, async (req: any, res) => {
    const action = String(req.body?.action || "") as ResearchAction;
    if (!["summarize", "verify", "other"].includes(action)) {
      return res.status(400).json({ error: "action must be summarize, verify, or other" });
    }
    try {
      const result = await runResearchAction({
        userId: userIdFrom(req),
        action,
        query: String(req.body?.query || ""),
        results: toResults(req.body?.results),
        instruction: req.body?.instruction ? String(req.body.instruction) : undefined,
      });
      // Always 200 — Zed explains any hiccup in plain language via the
      // payload, so the UI can show it in his voice with a retry.
      res.json(result);
    } catch (err: any) {
      res.json({
        ok: false,
        text: "Something hiccuped on my end and I couldn't finish that. Mind trying again?",
        retryable: true,
      });
    }
  });

  // Save this for later.
  app.get("/api/research/saved", isAuthenticated, async (req: any, res) => {
    try {
      const items = await listSavedResearch(userIdFrom(req));
      res.json({ items });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load saved items" });
    }
  });

  app.post("/api/research/saved", isAuthenticated, async (req: any, res) => {
    try {
      const item = await saveResearchItem({
        userId: userIdFrom(req),
        query: String(req.body?.query || ""),
        note: req.body?.note ? String(req.body.note) : undefined,
        results: toResults(req.body?.results),
      });
      res.json({ item });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to save" });
    }
  });

  app.delete("/api/research/saved/:id", isAuthenticated, async (req: any, res) => {
    try {
      const items = await deleteSavedResearch(userIdFrom(req), String(req.params.id));
      res.json({ items });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to delete" });
    }
  });
}
