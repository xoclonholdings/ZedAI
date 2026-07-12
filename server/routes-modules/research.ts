import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import {
  deleteResearchBrief,
  generateResearchBrief,
  listResearchBriefs,
} from "../services/research/ResearchEngine";
import { getWebSearchStatus, webSearch } from "../services/WebSearchService";

/**
 * Research workspace routes — the working surface where you hand Zed a
 * subject and it returns a structured, durable brief you can act on.
 */

function userIdFrom(req: any): string {
  return req.user?.claims?.sub || "unknown";
}

export function registerResearchRoutes(app: Express): void {
  // Research component #1 — Search. Real web search via the existing
  // WebSearchService (Brave -> Serper, access-policy enforced).
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

  app.get("/api/research/briefs", isAuthenticated, async (req: any, res) => {
    try {
      const briefs = await listResearchBriefs(userIdFrom(req));
      res.json({ briefs });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load briefs" });
    }
  });

  app.post("/api/research/brief", isAuthenticated, async (req: any, res) => {
    const topic = String(req.body?.topic || "").trim();
    if (!topic) return res.status(400).json({ error: "topic is required" });
    try {
      const brief = await generateResearchBrief({
        userId: userIdFrom(req),
        topic,
        sources: req.body?.sources ? String(req.body.sources) : undefined,
      });
      res.json({ brief });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Zed could not build the brief right now." });
    }
  });

  app.delete("/api/research/briefs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const briefs = await deleteResearchBrief(userIdFrom(req), String(req.params.id));
      res.json({ briefs });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to delete brief" });
    }
  });
}
