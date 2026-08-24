import { randomUUID } from "crypto";

import { generateChatFromProvider } from "../../services/ModelProviderService";
import { ZCOS_INTELLIGENCE_SCHEMA_VERSION, type ZcosResultEnvelope } from "../../../shared/zcos-intelligence";
import type {
  ExternalIntelligenceAdapter,
  ExternalIntelligenceRequest,
} from "./ExternalIntelligenceAdapter";

export class LightningExternalIntelligenceAdapter implements ExternalIntelligenceAdapter {
  readonly id = "lightning";
  readonly providerNeutralType = "model_aggregator" as const;

  supports(operation: ExternalIntelligenceRequest["operation"]): boolean {
    return operation === "model_synthesis";
  }

  async execute(input: ExternalIntelligenceRequest): Promise<ZcosResultEnvelope<{ text: string }>> {
    const retrievedAt = new Date().toISOString();
    const provenance = {
      provider: this.id,
      retrievedAt,
      independenceKey: `provider:${this.id}`,
      transformation: "Provider output returned to ZCOS as a non-authoritative candidate.",
      lineage: input.sources.map((source) => source.sourceId),
    };
    try {
      const text = await generateChatFromProvider(
        [{ role: "user", content: input.request.payload.message }],
        input.governedPrompt,
        {
          lane: "chat",
          reasoningEffort: input.reasoningEffort,
          attachments: input.attachments,
        },
      );
      return {
        schemaVersion: ZCOS_INTELLIGENCE_SCHEMA_VERSION,
        resultId: randomUUID(),
        requestId: input.request.requestId,
        type: "execution",
        status: text.trim() ? "success" : "failed",
        data: { text },
        sourceIds: input.sources.map((source) => source.sourceId),
        uncertainties: [],
        errors: text.trim()
          ? []
          : [{ code: "provider_empty_result", stage: "adapter", message: "Lightning returned an empty result.", retryable: true, provider: this.id }],
        provenance,
        writeDisposition: "candidate_only",
      };
    } catch (error) {
      return {
        schemaVersion: ZCOS_INTELLIGENCE_SCHEMA_VERSION,
        resultId: randomUUID(),
        requestId: input.request.requestId,
        type: "error",
        status: "failed",
        data: { text: "" },
        sourceIds: input.sources.map((source) => source.sourceId),
        uncertainties: [],
        errors: [{
          code: "provider_execution_failed",
          stage: "adapter",
          message: error instanceof Error ? error.message : String(error),
          retryable: true,
          provider: this.id,
        }],
        provenance,
        writeDisposition: "candidate_only",
      };
    }
  }
}
