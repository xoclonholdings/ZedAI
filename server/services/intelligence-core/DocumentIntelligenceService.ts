/**
 * Capability 3 — Document Intelligence.
 *
 * ZAR already has a powerful Knowledge Ingestion Engine (parsing,
 * semantic decomposition, object/entity extraction, relationship &
 * timeline mapping, decision & conflict detection, graph integration).
 * What was missing was the *connection*: files uploaded into a
 * conversation were read into the chat prompt as raw text and then
 * forgotten — they never became connected, queryable knowledge.
 *
 * This service closes that gap. Every uploaded document is pushed through
 * the existing ingestion pipeline into the same Knowledge Graph (no
 * duplicate store, no isolated document system) and can then be retrieved
 * across conversations with source attribution and citations, compared,
 * and reasoned over — with conflicts surfaced when the graph already
 * holds contradicting statements.
 */

import { KnowledgeIngestionService } from "../knowledge-ingestion/KnowledgeIngestionService";
import type {
  KnowledgeGraphSnapshot,
  KnowledgeObject,
} from "../knowledge-ingestion/types";
import { keywords, words } from "./analysis";

export interface UploadedDocumentInput {
  originalName: string;
  fileName?: string;
  mimeType?: string;
  content: string;
  conversationId?: string;
  userId?: string;
  createdAt?: string;
}

export interface DocumentIngestSummary {
  ingested: boolean;
  importId?: string;
  createdObjectIds: string[];
  updatedObjectIds: string[];
  topics: string[];
  conflictCount: number;
  executiveSummary?: string;
  skippedReason?: string;
}

export interface DocumentRetrievalResult {
  block: string;
  objectIds: string[];
  citations: string[];
  conflictCount: number;
}

const MIN_INGEST_CHARS = 120;
const MAX_INGEST_CHARS = 200_000;

function mimeToContentType(mime?: string): string {
  const m = (mime || "").toLowerCase();
  if (m.includes("pdf")) return "pdf";
  if (m.includes("word") || m.includes("officedocument")) return "docx";
  if (m.includes("csv")) return "csv";
  if (m.includes("json")) return "json";
  if (m.includes("markdown")) return "markdown";
  if (m.startsWith("text/")) return "text";
  return "document";
}

function objectRelevance(obj: KnowledgeObject, keys: string[]): number {
  if (keys.length === 0) return 0;
  const haystack = [
    obj.name,
    obj.description,
    obj.currentTruth || "",
    (obj.aliases || []).join(" "),
    (obj.tags || []).join(" "),
  ]
    .join(" ")
    .toLowerCase();
  let hits = 0;
  for (const k of keys) if (haystack.includes(k)) hits += 1;
  // Weight by confidence so shaky extractions don't outrank solid ones.
  return hits * (0.5 + obj.confidence / 2);
}

export class DocumentIntelligenceService {
  /**
   * Push an uploaded document through the Knowledge Ingestion pipeline so
   * it becomes connected graph knowledge. Best-effort and defensive — a
   * failure here must never break the upload itself.
   */
  static async ingestUploadedFile(input: UploadedDocumentInput): Promise<DocumentIngestSummary> {
    const content = String(input.content || "").slice(0, MAX_INGEST_CHARS);
    if (content.trim().length < MIN_INGEST_CHARS) {
      return {
        ingested: false,
        createdObjectIds: [],
        updatedObjectIds: [],
        topics: [],
        conflictCount: 0,
        skippedReason: "content_too_short",
      };
    }

    try {
      const report = await KnowledgeIngestionService.ingest({
        sourceName: input.originalName,
        sourceUri: input.conversationId ? `conversation:${input.conversationId}` : undefined,
        contentType: mimeToContentType(input.mimeType),
        content,
        createdAt: input.createdAt,
        metadata: {
          uploadedFile: true,
          conversationId: input.conversationId,
          userId: input.userId,
          fileName: input.fileName,
        },
      });

      return {
        ingested: true,
        importId: report.importId,
        createdObjectIds: report.knowledgeGraphChanges.createdObjectIds,
        updatedObjectIds: report.knowledgeGraphChanges.updatedObjectIds,
        topics: report.topics.slice(0, 8),
        conflictCount: report.detectedConflicts.length,
        executiveSummary: report.executiveSummary,
      };
    } catch (error: any) {
      return {
        ingested: false,
        createdObjectIds: [],
        updatedObjectIds: [],
        topics: [],
        conflictCount: 0,
        skippedReason: `ingest_failed:${error?.message || String(error)}`,
      };
    }
  }

  /**
   * Retrieve document-derived knowledge relevant to a query, with source
   * attribution and citations, and a note when the retrieved objects sit
   * on either side of a known conflict.
   */
  static async retrieveForQuery(query: string, limit = 5): Promise<DocumentRetrievalResult> {
    const keys = keywords(query);
    if (keys.length === 0) {
      return { block: "", objectIds: [], citations: [], conflictCount: 0 };
    }

    let graph: KnowledgeGraphSnapshot;
    try {
      graph = await KnowledgeIngestionService.getGraph();
    } catch {
      return { block: "", objectIds: [], citations: [], conflictCount: 0 };
    }

    const scored = graph.objects
      .map((obj) => ({ obj, score: objectRelevance(obj, keys) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    if (scored.length === 0) {
      return { block: "", objectIds: [], citations: [], conflictCount: 0 };
    }

    const objectIds = scored.map(({ obj }) => obj.id);
    const idSet = new Set(objectIds);
    const citations = Array.from(
      new Set(
        scored
          .map(({ obj }) => obj.source?.sourceName)
          .filter((name): name is string => Boolean(name)),
      ),
    );

    const relevantConflicts = graph.conflicts.filter(
      (c) => c.status === "unresolved" && c.objectIds.some((id) => idSet.has(id)),
    );

    const lines = scored.map(({ obj }) => {
      const truth = obj.currentTruth || obj.description || "";
      const attribution = obj.source?.sourceName ? ` [source: ${obj.source.sourceName}]` : "";
      const status =
        obj.temporalStatus && obj.temporalStatus !== "current" ? ` (${obj.temporalStatus})` : "";
      return `### ${obj.name} (${obj.type})${status}\n${truth}${attribution}`;
    });

    const conflictNote =
      relevantConflicts.length > 0
        ? [
            "",
            "Conflicts touching this knowledge (do not assert one side as settled):",
            ...relevantConflicts
              .slice(0, 3)
              .map((c) => `- ${c.field}: ${c.statements.slice(0, 2).join(" vs ")}`),
          ].join("\n")
        : "";

    const block = [
      "## Document Knowledge (from uploaded & ingested documents)",
      "Structured knowledge extracted from documents, connected in ZAR's knowledge graph. Prefer this over general knowledge for document-specific questions, and cite the source when you use it.",
      ...lines,
      conflictNote,
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      block,
      objectIds,
      citations,
      conflictCount: relevantConflicts.length,
    };
  }
}

export default DocumentIntelligenceService;
