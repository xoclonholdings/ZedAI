import type {
  ZcosRequestEnvelope,
  ZcosResultEnvelope,
  ZcosSourceEnvelope,
} from "../../../shared/zcos-intelligence";
import type { ImageBlock, ReasoningEffort } from "../../core/providers/provider-interface";

export interface ExternalIntelligenceRequest {
  request: ZcosRequestEnvelope;
  operation: "model_synthesis" | "source_retrieval";
  governedPrompt: string;
  sources: ZcosSourceEnvelope[];
  reasoningEffort: ReasoningEffort;
  attachments?: ImageBlock[];
}

export interface ExternalIntelligenceData {
  text: string;
  sources?: ZcosSourceEnvelope[];
  metadata?: Record<string, unknown>;
}

export interface ExternalIntelligenceAdapter {
  readonly id: string;
  readonly providerNeutralType: "model_aggregator" | "source_retriever";
  supports(operation: ExternalIntelligenceRequest["operation"]): boolean;
  execute(request: ExternalIntelligenceRequest): Promise<ZcosResultEnvelope<ExternalIntelligenceData>>;
}

export class ExternalIntelligenceAdapterRegistry {
  private readonly adapters = new Map<string, { adapter: ExternalIntelligenceAdapter; priority: number }>();

  register(adapter: ExternalIntelligenceAdapter, priority = 0): void {
    if (this.adapters.has(adapter.id)) throw new Error(`External adapter already registered: ${adapter.id}`);
    this.adapters.set(adapter.id, { adapter, priority });
  }

  get(id: string): ExternalIntelligenceAdapter | null {
    return this.adapters.get(id)?.adapter || null;
  }

  forOperation(operation: ExternalIntelligenceRequest["operation"]): ExternalIntelligenceAdapter[] {
    return [...this.adapters.values()]
      .filter(({ adapter }) => adapter.supports(operation))
      .sort((a, b) => b.priority - a.priority)
      .map(({ adapter }) => adapter);
  }
}
