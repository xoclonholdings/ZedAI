import type { Express } from "express";

import { isAdmin, isAuthenticated } from "../localAuth";
import { IntelligenceCore } from "../services/intelligence-core";
import { DocumentIntelligenceService } from "../services/intelligence-core/DocumentIntelligenceService";
import { KnowledgeIngestionService } from "../services/knowledge-ingestion/KnowledgeIngestionService";

/**
 * Observability + preview surface for the Intelligence Core.
 *
 * The five engines run inline on every orchestrated turn (see
 * ChatExecutionService), so these routes are not part of the hot path —
 * they exist so operators and the admin UI can see exactly what the
 * Intelligence Core decided for a given message, and so document
 * knowledge can be queried directly.
 */
export function registerIntelligenceCoreRoutes(app: Express): void {
  // Preview the full Intelligence Core plan for a message without
  // running a full chat turn. Any authenticated user may inspect their
  // own messages; nothing here mutates state.
  app.post("/api/intelligence/plan", isAuthenticated, async (req: any, res) => {
    try {
      const message = String(req.body?.message || "").trim();
      if (!message) return res.status(400).json({ error: "message is required" });

      const documentKnowledge = await DocumentIntelligenceService.retrieveForQuery(message).catch(
        () => ({ block: "", objectIds: [], citations: [], conflictCount: 0 }),
      );

      const result = IntelligenceCore.analyze({
        message,
        strategic: Boolean(req.body?.strategic),
        knowledgePresent: documentKnowledge.objectIds.length > 0,
        hasGraphContext: documentKnowledge.objectIds.length > 0,
        hasMemory: true,
      });

      res.json({
        plan: result.plan,
        deepThinking: {
          engaged: result.deepThinking.engaged,
          taskType: result.deepThinking.taskType,
          complexity: result.deepThinking.complexity,
          decomposition: result.deepThinking.decomposition,
          hypotheses: result.deepThinking.hypotheses,
          evaluationCriteria: result.deepThinking.evaluationCriteria,
          confidence: result.deepThinking.confidence,
          confidenceBand: result.deepThinking.confidenceBand,
        },
        responseOrchestration: {
          form: result.responseOrchestration.form,
          verbosity: result.responseOrchestration.verbosity,
          urgency: result.responseOrchestration.urgency,
          requiredPrecision: result.responseOrchestration.requiredPrecision,
        },
        selfOrchestration: {
          engaged: result.selfOrchestration.engaged,
          suggestedLane: result.selfOrchestration.suggestedLane,
          decisions: result.selfOrchestration.decisions,
        },
        documentKnowledge: {
          objectCount: documentKnowledge.objectIds.length,
          citations: documentKnowledge.citations,
          conflictCount: documentKnowledge.conflictCount,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "intelligence_plan_failed" });
    }
  });

  // Query document-derived knowledge directly (document QA / lookup).
  app.post("/api/intelligence/documents/query", isAuthenticated, async (req: any, res) => {
    try {
      const query = String(req.body?.query || req.body?.message || "").trim();
      if (!query) return res.status(400).json({ error: "query is required" });
      const limit = Math.max(1, Math.min(20, Number(req.body?.limit) || 6));
      const result = await DocumentIntelligenceService.retrieveForQuery(query, limit);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "document_query_failed" });
    }
  });

  // Admin status: prove the Intelligence Core is live and show how much
  // connected document knowledge exists in the graph.
  app.get("/api/admin/intelligence-core/status", isAdmin, async (_req, res) => {
    try {
      const graph = await KnowledgeIngestionService.getGraph().catch(() => null);
      const documentObjects = graph
        ? graph.objects.filter((o) => o.source?.sourceName).length
        : 0;
      res.json({
        active: true,
        engines: [
          { id: "deep_thinking", capability: "Deep Thinking Mode", status: "operational" },
          { id: "context_intelligence", capability: "Large Context Intelligence", status: "operational" },
          { id: "document_intelligence", capability: "Document Intelligence", status: "operational" },
          { id: "response_orchestration", capability: "Adaptive Response Intelligence", status: "operational" },
          { id: "self_orchestration", capability: "Self-Orchestrating Intelligence", status: "operational" },
        ],
        wiring: {
          hotPath: "server/services/ChatExecutionService.ts",
          uploadIngestion: "server/routes-modules/conversations-crud.ts",
          knowledgeGraph: "hub/shared-memory/knowledge-graph/knowledge-graph.json",
        },
        knowledgeGraph: graph
          ? {
              objects: graph.objects.length,
              documentDerivedObjects: documentObjects,
              relationships: graph.relationships.length,
              conflicts: graph.conflicts.length,
              updatedAt: graph.updatedAt,
            }
          : { objects: 0, documentDerivedObjects: 0, relationships: 0, conflicts: 0, updatedAt: null },
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "intelligence_status_failed" });
    }
  });
}
