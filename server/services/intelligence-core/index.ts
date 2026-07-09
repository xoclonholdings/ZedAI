/**
 * Intelligence Core — facade.
 *
 * Runs the deterministic reasoning engines for a single turn and returns
 * prompt fragments already ordered for the Cognitive Core stack, plus an
 * observable plan for the execution trace and admin surfaces.
 *
 * The two retrieval-shaped engines are intentionally NOT run here:
 *   - ContextIntelligenceEngine needs the assembled knowledge sections,
 *     so ChatExecutionService applies it after retrieval.
 *   - DocumentIntelligenceService needs the query to hit the graph, and
 *     is invoked where retrieval happens.
 * This keeps the facade pure and synchronous with no I/O.
 */

import { DeepThinkingEngine } from "./DeepThinkingEngine";
import { ResponseOrchestrationEngine } from "./ResponseOrchestrationEngine";
import { SelfOrchestrationEngine } from "./SelfOrchestrationEngine";
import type { IntelligenceCoreResult } from "./types";

export interface IntelligenceCoreInput {
  message: string;
  lane?: string;
  strategic?: boolean;
  knowledgePresent?: boolean;
  materialUncertainty?: boolean;
  hasFiles?: boolean;
  hasGraphContext?: boolean;
  hasMemory?: boolean;
}

export class IntelligenceCore {
  static analyze(input: IntelligenceCoreInput): IntelligenceCoreResult {
    const deepThinking = DeepThinkingEngine.analyze({
      message: input.message,
      lane: input.lane,
      knowledgePresent: input.knowledgePresent,
      materialUncertainty: input.materialUncertainty,
    });

    const responseOrchestration = ResponseOrchestrationEngine.plan({
      message: input.message,
      complexity: deepThinking.complexity,
      strategic: input.strategic,
    });

    const selfOrchestration = SelfOrchestrationEngine.plan({
      message: input.message,
      hasFiles: input.hasFiles,
      hasGraphContext: input.hasGraphContext,
      hasMemory: input.hasMemory,
    });

    // Reasoning-stage fragments (slot after Strategic Reasoning, before
    // knowledge); response-shape fragment slots next to Voice/Policy.
    const reasoningPrompt = [deepThinking.prompt, selfOrchestration.prompt]
      .filter(Boolean)
      .join("\n\n");

    return {
      deepThinking,
      responseOrchestration,
      selfOrchestration,
      reasoningPrompt,
      responsePrompt: responseOrchestration.prompt,
      plan: {
        taskType: deepThinking.taskType,
        complexity: deepThinking.complexity,
        confidence: deepThinking.confidence,
        responseForm: responseOrchestration.form,
        verbosity: responseOrchestration.verbosity,
        urgency: responseOrchestration.urgency,
        capabilities: selfOrchestration.decisions.map((d) => d.capability),
        deepThinkingEngaged: deepThinking.engaged,
      },
    };
  }
}

export { DeepThinkingEngine } from "./DeepThinkingEngine";
export { ContextIntelligenceEngine } from "./ContextIntelligenceEngine";
export { DocumentIntelligenceService } from "./DocumentIntelligenceService";
export { ResponseOrchestrationEngine } from "./ResponseOrchestrationEngine";
export { SelfOrchestrationEngine } from "./SelfOrchestrationEngine";
export * from "./types";

export default IntelligenceCore;
