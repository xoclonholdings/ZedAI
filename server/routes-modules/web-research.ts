import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import { WebResearchJobService } from "../services/research/WebResearchJobService";

/**
 * Structured web research routes — bounded single-page fetch and
 * multi-page crawl (Crawl4AI-equivalent capability). Every request goes
 * through WebResearchJobService, which routes fetches through the
 * SSRF-safe WebContentService and records a job with citations.
 */

function userIdFrom(req: any): string {
  return req.user?.claims?.sub || "unknown";
}

export function registerWebResearchRoutes(app: Express): void {
  app.post("/api/web-research/fetch", isAuthenticated, async (req: any, res) => {
    const text = String(req.body?.url || req.body?.text || "").trim();
    if (!text) return res.status(400).json({ error: "url is required" });
    try {
      const job = await WebResearchJobService.runFetch({
        userId: userIdFrom(req),
        text,
        conversationId: req.body?.conversationId ? String(req.body.conversationId) : undefined,
        projectId: req.body?.projectId ? String(req.body.projectId) : undefined,
        workspaceId: req.body?.workspaceId ? String(req.body.workspaceId) : undefined,
        addToKnowledge: Boolean(req.body?.addToKnowledge),
      });
      res.json({ job });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Fetch failed" });
    }
  });

  app.post("/api/web-research/crawl", isAuthenticated, async (req: any, res) => {
    const url = String(req.body?.url || "").trim();
    if (!url) return res.status(400).json({ error: "url is required" });
    try {
      const job = await WebResearchJobService.startCrawl({
        userId: userIdFrom(req),
        url,
        conversationId: req.body?.conversationId ? String(req.body.conversationId) : undefined,
        projectId: req.body?.projectId ? String(req.body.projectId) : undefined,
        workspaceId: req.body?.workspaceId ? String(req.body.workspaceId) : undefined,
        maxPages: req.body?.maxPages ? Number(req.body.maxPages) : undefined,
        maxDepth: req.body?.maxDepth ? Number(req.body.maxDepth) : undefined,
        sameDomainOnly: req.body?.sameDomainOnly !== false,
        addToKnowledge: Boolean(req.body?.addToKnowledge),
      });
      res.status(202).json({ job });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Crawl failed to start" });
    }
  });

  app.get("/api/web-research/jobs", isAuthenticated, async (req: any, res) => {
    try {
      const jobs = await WebResearchJobService.listJobs(userIdFrom(req));
      res.json({ jobs });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to list jobs" });
    }
  });

  app.get("/api/web-research/jobs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const job = await WebResearchJobService.getJob(req.params.id);
      if (!job || job.userId !== userIdFrom(req)) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json({ job });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load job" });
    }
  });

  app.post("/api/web-research/jobs/:id/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const job = await WebResearchJobService.cancel(req.params.id, userIdFrom(req));
      if (!job) return res.status(404).json({ error: "Job not found" });
      res.json({ job });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to cancel job" });
    }
  });
}
