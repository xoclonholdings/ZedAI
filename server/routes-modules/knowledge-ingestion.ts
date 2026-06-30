import type { Express, Request, Response } from "express";

import { isAdmin, isAuthenticated } from "../localAuth";
import { ContextInquiryEngine } from "../services/knowledge-ingestion/ContextInquiryEngine";
import { KnowledgeIngestionService } from "../services/knowledge-ingestion/KnowledgeIngestionService";
import type { RawKnowledgeInput } from "../services/knowledge-ingestion/types";

function userLabel(req: any): string {
  return req?.user?.claims?.sub || req?.session?.userId || "user";
}

function normalizeImportBody(body: any): RawKnowledgeInput {
  const content = body?.content ?? body?.text ?? body?.raw ?? body?.data;
  if (content === undefined || content === null || content === "") {
    throw new Error("content, text, raw, or data is required");
  }
  return {
    sourceName: body?.sourceName || body?.name || body?.filename || "Direct Import",
    sourceUri: body?.sourceUri || body?.url || undefined,
    contentType: body?.contentType || body?.mimeType || undefined,
    content,
    author: body?.author || undefined,
    createdAt: body?.createdAt || body?.date || undefined,
    version: body?.version || undefined,
    metadata: body?.metadata && typeof body.metadata === "object" ? body.metadata : {},
  };
}

export function registerKnowledgeIngestionRoutes(app: Express): void {
  app.post("/api/knowledge-ingestion/import", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const report = await KnowledgeIngestionService.ingest(normalizeImportBody(req.body || {}));
      res.json(report);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Knowledge ingestion failed" });
    }
  });

  app.get("/api/knowledge-ingestion/graph", isAuthenticated, async (_req: Request, res: Response) => {
    try {
      res.json({ graph: await KnowledgeIngestionService.getGraph() });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Knowledge graph fetch failed" });
    }
  });

  app.get("/api/knowledge-ingestion/indexes", isAuthenticated, async (_req: Request, res: Response) => {
    try {
      res.json({ indexes: await KnowledgeIngestionService.getReasoningIndexes() });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Reasoning index fetch failed" });
    }
  });

  app.post("/api/knowledge-ingestion/promote", isAdmin, async (req: any, res: Response) => {
    try {
      const objectIds = Array.isArray(req.body?.objectIds) ? req.body.objectIds.map(String) : [];
      if (!objectIds.length) return res.status(400).json({ error: "objectIds is required" });
      const graph = await KnowledgeIngestionService.promoteObjects(objectIds, userLabel(req));
      res.json({ graph });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Knowledge promotion failed" });
    }
  });

  app.post("/api/knowledge-ingestion/conflicts/:id/resolve", isAdmin, async (req: any, res: Response) => {
    try {
      const resolution = String(req.body?.resolution || "").trim();
      if (!resolution) return res.status(400).json({ error: "resolution is required" });
      const graph = await KnowledgeIngestionService.resolveConflict(req.params.id, resolution, userLabel(req));
      res.json({ graph });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Conflict resolution failed" });
    }
  });

  app.post("/api/context/assess", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userInput = String(req.body?.userInput || req.body?.message || "").trim();
      if (!userInput) return res.status(400).json({ error: "userInput or message is required" });
      const result = await ContextInquiryEngine.assess({
        userInput,
        candidateObjectIds: Array.isArray(req.body?.candidateObjectIds)
          ? req.body.candidateObjectIds.map(String)
          : undefined,
        includeGraph: req.body?.includeGraph === true,
        clarification:
          req.body?.clarification && typeof req.body.clarification === "object"
            ? req.body.clarification
            : undefined,
      });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Context assessment failed" });
    }
  });
}

export default registerKnowledgeIngestionRoutes;
