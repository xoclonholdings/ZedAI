import fs from "fs/promises";
import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import {
  createResearchDocument,
  deleteResearchDocument,
  deleteSavedResearch,
  listResearchDocuments,
  listSavedResearch,
  runResearchAction,
  saveResearchDocument,
  saveResearchItem,
  type ResearchAction,
  type ResearchResult,
} from "../services/research/ResearchEngine";
import { processFile, upload } from "../services/fileProcessor";
import { getWebSearchStatus, webSearch } from "../services/WebSearchService";
import { ownerUserIdFromAuthenticatedRequest } from "../services/auth/OwnerContext";

/**
 * Research workspace routes.
 *
 * Search is the front door. After a search, ZAR can summarize, verify, or
 * save the result — or do whatever the user types under "other".
 */

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
        userId: ownerUserIdFromAuthenticatedRequest(req),
        action,
        query: String(req.body?.query || ""),
        results: toResults(req.body?.results),
        instruction: req.body?.instruction ? String(req.body.instruction) : undefined,
      });
      // Always 200 — ZAR explains any hiccup in plain language via the
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

  // Create/Document — ZAR writes the research up as a document.
  app.post("/api/research/document", isAuthenticated, async (req: any, res) => {
    try {
      const draft = await createResearchDocument({
        userId: ownerUserIdFromAuthenticatedRequest(req),
        instruction: String(req.body?.instruction || ""),
        title: req.body?.title ? String(req.body.title) : undefined,
        sources: req.body?.sources ? String(req.body.sources) : undefined,
        docType: req.body?.docType ? String(req.body.docType) : undefined,
      });
      res.json(draft);
    } catch {
      res.json({
        ok: false,
        title: "",
        content: "Something hiccuped and I couldn't write that up. Mind trying again?",
        retryable: true,
      });
    }
  });

  // ZAR's Files — keep a filed document in the workspace (a home for
  // documents until the user connects iCloud / Google Drive).
  app.get("/api/research/documents", isAuthenticated, async (req: any, res) => {
    try {
      res.json({ documents: await listResearchDocuments(ownerUserIdFromAuthenticatedRequest(req)) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load documents" });
    }
  });

  app.post("/api/research/documents", isAuthenticated, async (req: any, res) => {
    const content = String(req.body?.content || "").trim();
    if (!content) return res.status(400).json({ error: "content is required" });
    try {
      const document = await saveResearchDocument({
        userId: ownerUserIdFromAuthenticatedRequest(req),
        title: String(req.body?.title || "Untitled document"),
        content,
      });
      res.json({ document });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to file document" });
    }
  });

  // File an existing document as-is, instead of having ZAR draft one - the
  // same text-extraction pipeline chat/memory uploads use, filed straight
  // into ZAR's Files so it shows up next to drafted documents.
  app.post(
    "/api/research/documents/upload",
    isAuthenticated,
    upload.array("files"),
    async (req: any, res) => {
      const files = (req.files as Express.Multer.File[] | undefined) || [];
      if (files.length === 0) {
        return res.status(400).json({ error: "Attach at least one file." });
      }
      try {
        const userId = ownerUserIdFromAuthenticatedRequest(req);
        const documents = [];
        for (const file of files) {
          const processed = await processFile(file.path, file.mimetype, file.originalname).catch((err) => ({
            extractedContent: "",
            error: err?.message || "processing failed",
          } as any));
          await fs.unlink(file.path).catch(() => {});
          if (!processed?.extractedContent?.trim()) {
            return res.status(422).json({
              error: `Couldn't read ${file.originalname} as text (${processed?.error || "unsupported file type"}).`,
            });
          }
          documents.push(
            await saveResearchDocument({
              userId,
              title: file.originalname.replace(/\.[^.]+$/, ""),
              content: processed.extractedContent,
            }),
          );
        }
        res.json({ documents });
      } catch (err: any) {
        res.status(500).json({ error: err?.message || "Failed to file the document" });
      }
    },
  );

  app.delete("/api/research/documents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const documents = await deleteResearchDocument(
        ownerUserIdFromAuthenticatedRequest(req),
        String(req.params.id),
      );
      res.json({ documents });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to delete" });
    }
  });

  // Save this for later.
  app.get("/api/research/saved", isAuthenticated, async (req: any, res) => {
    try {
      const items = await listSavedResearch(ownerUserIdFromAuthenticatedRequest(req));
      res.json({ items });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load saved items" });
    }
  });

  app.post("/api/research/saved", isAuthenticated, async (req: any, res) => {
    try {
      const item = await saveResearchItem({
        userId: ownerUserIdFromAuthenticatedRequest(req),
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
      const items = await deleteSavedResearch(
        ownerUserIdFromAuthenticatedRequest(req),
        String(req.params.id),
      );
      res.json({ items });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to delete" });
    }
  });
}
