import { randomUUID } from "crypto";

import {
  ZCOS_INTELLIGENCE_SCHEMA_VERSION,
  type ZcosSourceEnvelope,
} from "../../../shared/zcos-intelligence";
import { IntelligenceAgent } from "../../agents/intelligence/IntelligenceAgent";
import type {
  ExternalIntelligenceAdapter,
  ExternalIntelligenceRequest,
} from "./ExternalIntelligenceAdapter";

function sourceEnvelopes(
  requestId: string,
  brief: Awaited<ReturnType<typeof IntelligenceAgent.research>>,
): ZcosSourceEnvelope[] {
  const retrievedAt = new Date().toISOString();
  const pages = (brief.web?.pages || []).map((page) => ({
    sourceId: randomUUID(),
    type: "external_url" as const,
    authority: "source" as const,
    originGalaxy: "ZCOS" as const,
    originClass: "external_primary" as const,
    title: page.title || page.url,
    content: page.extractedTextPreview || page.url,
    confidence: page.status >= 200 && page.status < 400 ? 0.85 : 0.4,
    currency: "current" as const,
    provenance: {
      provider: "direct_web",
      sourceUri: page.url,
      retrievedAt: page.fetchedAt || retrievedAt,
      independenceKey: page.url,
      lineage: [requestId, page.url],
    },
  }));
  if (pages.length > 0) return pages;

  return brief.sources.map((source) => {
    const url = source.match(/https?:\/\/\S+/)?.[0] || source;
    return {
      sourceId: randomUUID(),
      type: "external_search" as const,
      authority: "source" as const,
      originGalaxy: "ZCOS" as const,
      originClass: "external_secondary" as const,
      title: source.replace(/:\s*https?:\/\/\S+$/, ""),
      content: source,
      confidence: 0.65,
      currency: "current" as const,
      provenance: {
        provider: "search",
        sourceUri: url,
        retrievedAt,
        independenceKey: url,
        lineage: [requestId, url],
      },
    };
  });
}

export class WebSourceExternalIntelligenceAdapter implements ExternalIntelligenceAdapter {
  readonly id = "zcos_web_sources";
  readonly providerNeutralType = "source_retriever" as const;

  supports(operation: ExternalIntelligenceRequest["operation"]): boolean {
    return operation === "source_retrieval";
  }

  async execute(input: ExternalIntelligenceRequest) {
    const retrievedAt = new Date().toISOString();
    try {
      const brief = await IntelligenceAgent.research({
        userId: input.request.owner.ownerUserId,
        query: input.request.payload.message,
        conversationId: input.request.payload.conversationId,
        memoryContext: input.governedPrompt,
        attachments: input.attachments,
        reasoningEffort: input.reasoningEffort,
        persistArtifacts: false,
      });
      const sources = sourceEnvelopes(input.request.requestId, brief);
      const text = [
        brief.keyFindings.join("\n\n"),
        brief.implications,
        brief.recommendedAction,
        brief.sources.length ? `\nSources:\n${brief.sources.map((source) => `- ${source}`).join("\n")}` : "",
      ].filter(Boolean).join("\n\n");
      return {
        schemaVersion: ZCOS_INTELLIGENCE_SCHEMA_VERSION,
        resultId: randomUUID(),
        requestId: input.request.requestId,
        type: "source_set" as const,
        status: text.trim() ? "success" as const : "partial" as const,
        data: { text, sources, metadata: { web: brief.web, sourceLabels: brief.sources } },
        sourceIds: sources.map((source) => source.sourceId),
        uncertainties: sources.length > 0 ? [] : [{
          code: "external_sources_empty",
          statement: "Current-source retrieval returned no attributable sources.",
          material: input.request.intent.stakes === "high",
          confidence: 1,
          sourceIds: [],
          resolution: input.request.intent.stakes === "high" ? "block_action" as const : "preserve" as const,
        }],
        errors: [],
        provenance: {
          provider: this.id,
          retrievedAt,
          independenceKey: `adapter:${this.id}`,
          transformation: "External pages and search results normalized into typed ZCOS source envelopes.",
          lineage: sources.map((source) => source.sourceId),
        },
        writeDisposition: "candidate_only" as const,
      };
    } catch (error) {
      return {
        schemaVersion: ZCOS_INTELLIGENCE_SCHEMA_VERSION,
        resultId: randomUUID(),
        requestId: input.request.requestId,
        type: "error" as const,
        status: "failed" as const,
        data: { text: "", sources: [] },
        sourceIds: [],
        uncertainties: [],
        errors: [{
          code: "source_retrieval_failed",
          stage: "adapter" as const,
          message: error instanceof Error ? error.message : String(error),
          retryable: true,
          provider: this.id,
        }],
        provenance: {
          provider: this.id,
          retrievedAt,
          independenceKey: `adapter:${this.id}`,
          lineage: [],
        },
        writeDisposition: "candidate_only" as const,
      };
    }
  }
}
