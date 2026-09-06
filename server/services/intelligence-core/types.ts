/**
 * Intelligence Core — shared types.
 *
 * The Intelligence Core is the layer that brings Claude-class reasoning,
 * context management, document understanding, adaptive responses, and
 * autonomous orchestration into ZAR. It does not replace the existing
 * Cognitive Core (Context Inquiry → Principle → Strategic → Knowledge →
 * Voice → Reflection); it sits inside it, adding five deterministic
 * engines whose outputs slot into the existing prompt-assembly order in
 * `ChatExecutionService` and `ManagerAgent`.
 *
 * Every engine here is deterministic and service-owned so it can migrate
 * into ZCOS later without changing the ZAR interface, exactly like the
 * Strategic Reasoning and Context Inquiry engines already do.
 */

export type TaskType =
  | "question"
  | "analysis"
  | "design"
  | "debug"
  | "decision"
  | "research"
  | "planning"
  | "comparison"
  | "summary"
  | "calculation"
  | "generation"
  | "conversation";

export type ComplexityBand = "trivial" | "moderate" | "complex" | "deep";

export type ConfidenceBand = "low" | "medium" | "high";

export type ResponseForm =
  | "direct"
  | "steps"
  | "checklist"
  | "table"
  | "comparison"
  | "report"
  | "executive_summary"
  | "code"
  | "research_result"
  | "concise_rationale"
  | "writing_artifact"
  | "visual_explanation"
  | "file"
  | "approval_request"
  | "implementation_task";

export type Verbosity = "terse" | "balanced" | "detailed";

export type Urgency = "low" | "normal" | "high";

/** Capabilities the Self-Orchestration engine can decide to engage. */
export type Capability =
  | "search_memory"
  | "search_knowledge_graph"
  | "search_documents"
  | "launch_research"
  | "call_agent"
  | "schedule_work"
  | "request_approval"
  | "generate_report"
  | "perform_calculation"
  | "run_workflow"
  | "update_project_state"
  | "notify_user";

export interface DeepThinkingResult {
  engaged: boolean;
  taskType: TaskType;
  complexity: ComplexityBand;
  complexityScore: number;
  /** Sub-problems the request decomposes into. */
  decomposition: string[];
  /** Candidate approaches / hypotheses to weigh internally. */
  hypotheses: string[];
  /** Criteria the model should evaluate candidate solutions against. */
  evaluationCriteria: string[];
  confidence: number;
  confidenceBand: ConfidenceBand;
  /** Whether the user explicitly asked to see the reasoning. */
  revealReasoning: boolean;
  /** Hidden reasoning scaffold injected into the prompt (may be empty). */
  prompt: string;
}

export interface ContextIntelligenceResult {
  /** Ranked, compressed, merged knowledge prompt. */
  prompt: string;
  keptSources: string[];
  droppedSources: string[];
  originalChars: number;
  compressedChars: number;
  compressionRatio: number;
}

export interface ResponseOrchestrationResult {
  form: ResponseForm;
  verbosity: Verbosity;
  urgency: Urgency;
  /** Depth of reasoning the answer should reflect. */
  requiredDepth: ComplexityBand;
  requiredPrecision: "loose" | "standard" | "exact";
  prompt: string;
}

export interface CapabilityDecision {
  capability: Capability;
  reason: string;
  confidence: number;
  /** True when the engine believes this should fire without asking. */
  autonomous: boolean;
}

export interface SelfOrchestrationResult {
  engaged: boolean;
  decisions: CapabilityDecision[];
  /** Suggested primary agent lane, if the message clearly points at one. */
  suggestedLane: "operations" | "research" | "business" | "finance" | null;
  prompt: string;
}

/** Combined, observable plan produced by the Intelligence Core per turn. */
export interface IntelligenceCorePlan {
  taskType: TaskType;
  complexity: ComplexityBand;
  confidence: number;
  responseForm: ResponseForm;
  verbosity: Verbosity;
  urgency: Urgency;
  capabilities: Capability[];
  deepThinkingEngaged: boolean;
}

export interface IntelligenceCoreResult {
  deepThinking: DeepThinkingResult;
  responseOrchestration: ResponseOrchestrationResult;
  selfOrchestration: SelfOrchestrationResult;
  /** Prompt fragments in Cognitive-Core order, ready to slot into the stack. */
  reasoningPrompt: string;
  responsePrompt: string;
  plan: IntelligenceCorePlan;
}
