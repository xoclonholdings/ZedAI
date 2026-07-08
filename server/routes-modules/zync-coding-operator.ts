import type { Express } from "express";

import { isAdmin } from "../localAuth";
import { logRuntimeEvent } from "../services/RuntimeLogger";
import { ZyncCodingOperatorService } from "../services/ZyncCodingOperatorService";

function logZync(event: string, detail: string, context?: Record<string, unknown>) {
  void logRuntimeEvent({
    level: "info",
    source: "server",
    event,
    detail,
    context,
  });
}

export function registerZyncCodingOperatorRoutes(app: Express): void {
  app.get("/api/admin/zync-coding-operator/status", isAdmin, async (_req, res) => {
    try {
      const [registry, github, verificationJobs] = await Promise.all([
        ZyncCodingOperatorService.loadRegistry(),
        ZyncCodingOperatorService.githubBranches(),
        Promise.resolve(ZyncCodingOperatorService.verificationJobs()),
      ]);
      res.json({ registry, github, verificationJobs });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load Zync status" });
    }
  });

  app.post("/api/admin/zync-coding-operator/repo-scan", isAdmin, async (_req, res) => {
    try {
      const result = await ZyncCodingOperatorService.repoScan();
      logZync("zync.repo_scan", "Repository context scan completed");
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Repository scan failed" });
    }
  });

  app.post("/api/admin/zync-coding-operator/code-search", isAdmin, async (req: any, res) => {
    try {
      const result = await ZyncCodingOperatorService.codeSearch(req.body || {});
      logZync("zync.code_search", `Search completed for "${result.query}"`, {
        matches: result.matches.length,
        searchedFiles: result.searchedFiles,
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Code search failed" });
    }
  });

  app.post("/api/admin/zync-coding-operator/impact-review", isAdmin, async (req: any, res) => {
    try {
      const result = await ZyncCodingOperatorService.impactReview(req.body || {});
      logZync("zync.impact_review", `Impact review completed (${result.risk.level})`, {
        targets: result.targets.map((target) => target.path),
        referenceCount: result.references.length,
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Impact review failed" });
    }
  });

  app.post("/api/admin/zync-coding-operator/verify", isAdmin, async (req: any, res) => {
    try {
      const result = await ZyncCodingOperatorService.runVerification(req.body || {});
      void logRuntimeEvent({
        level: result.ok ? "info" : "error",
        source: "server",
        event: "zync.verification_run",
        detail: `${result.job.id} exited ${result.exitCode}`,
        context: { job: result.job.id, durationMs: result.durationMs },
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "Verification failed" });
    }
  });

  app.get("/api/admin/zync-coding-operator/github-branches", isAdmin, async (_req, res) => {
    try {
      const result = await ZyncCodingOperatorService.githubBranches();
      logZync("zync.github_branch_check", `GitHub branch check: ${result.policy.compliant ? "clean" : "needs attention"}`, {
        extras: result.policy.extras,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "GitHub branch check failed" });
    }
  });

  app.post("/api/admin/zync-coding-operator/github-backup/refresh", isAdmin, async (req: any, res) => {
    try {
      const result = await ZyncCodingOperatorService.refreshGithubBackup(req.body || {});
      logZync("zync.github_backup_refresh", `backup -> ${result.backup}`, {
        matched: result.matched,
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || "GitHub backup refresh failed" });
    }
  });
}
