import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import {
  DocumentationContextService,
  formatDocsForPrompt,
} from "../services/documentation/DocumentationContextService";
import { REPO_ROOT } from "../utils/repoPaths";

/** Documentation Context capability routes (Context7-referenced). */
export function registerDocumentationRoutes(app: Express): void {
  app.post("/api/documentation/resolve", isAuthenticated, async (req: any, res) => {
    const query = String(req.body?.query || "").trim();
    if (!query) return res.status(400).json({ error: "query is required" });
    res.json(await DocumentationContextService.resolveLibrary(query));
  });

  app.post("/api/documentation/retrieve", isAuthenticated, async (req: any, res) => {
    const libraryId = String(req.body?.libraryId || "").trim();
    const packageName = String(req.body?.packageName || "").trim();
    if (!libraryId && !packageName) {
      return res.status(400).json({ error: "libraryId or packageName is required" });
    }
    try {
      if (packageName) {
        const result = await DocumentationContextService.retrieveDocsForPackage({
          packageName,
          topic: req.body?.topic ? String(req.body.topic) : undefined,
          version: req.body?.version ? String(req.body.version) : undefined,
          // Version resolution reads THIS repository's manifests only —
          // never a client-supplied path.
          projectDir: req.body?.resolveVersionFromRepo ? REPO_ROOT : undefined,
        });
        return res.json({
          ...result,
          prompt: result.docs ? formatDocsForPrompt(result.docs) : undefined,
        });
      }
      const docs = await DocumentationContextService.retrieveLibraryDocs({
        libraryId,
        topic: req.body?.topic ? String(req.body.topic) : undefined,
        requestedVersion: req.body?.version ? String(req.body.version) : undefined,
        refresh: Boolean(req.body?.refresh),
      });
      res.json({ docs, prompt: formatDocsForPrompt(docs) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Documentation retrieval failed" });
    }
  });

  app.get("/api/documentation/health", isAuthenticated, async (_req: any, res) => {
    res.json(await DocumentationContextService.health());
  });
}
