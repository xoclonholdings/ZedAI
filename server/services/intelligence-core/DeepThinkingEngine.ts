/**
 * Capability 1 — Deep Thinking Mode.
 *
 * Claude's strength is that it does not immediately answer complex
 * requests; it reasons through them first. This engine gives ZED the
 * same behavior as a real, staged reasoning pipeline:
 *
 *   decomposition → hypothesis generation → solution evaluation →
 *   refinement → confidence estimation
 *
 * It is deterministic and internal. On a simple message it stays out of
 * the way (engaged=false, empty prompt). On a genuinely complex one it
 * emits a hidden reasoning scaffold that instructs the model to run the
 * stages privately before answering. The reasoning stays internal unless
 * the user explicitly asks to see it.
 *
 * This engine is available to every workspace/lane because it keys off
 * the message shape, not the workspace.
 */

import {
  countAsks,
  decompose,
  detectTaskType,
  keywords,
  userWantsReasoningShown,
  words,
} from "./analysis";
import type {
  ComplexityBand,
  ConfidenceBand,
  DeepThinkingResult,
  TaskType,
} from "./types";

export interface DeepThinkingInput {
  message: string;
  lane?: string;
  knowledgePresent?: boolean;
  /** Context Inquiry flagged material uncertainty for this turn. */
  materialUncertainty?: boolean;
}

const ANALYTICAL_TERMS =
  /\b(architecture|strategy|tradeoff|optimi[sz]e|design|evaluate|compare|why|root cause|implications?|risk|dependenc|constraint|scale|migrate|refactor|pipeline|framework|model|forecast|allocat|portfolio|hypoth|prove|derive|reconcile|integrat)\b/i;
const CONDITIONALS = /\b(if|when|unless|depending|assuming|given that|provided that|in case)\b/gi;
const CONSTRAINTS = /\b(without|under|within|budget|deadline|limit|constraint|must not|cannot|only|at most|no more than)\b/gi;

/** Approaches worth weighing internally, keyed by task type. */
const HYPOTHESIS_LIBRARY: Record<TaskType, string[]> = {
  analysis: [
    "Break the subject into its driving factors and analyze each independently, then recombine.",
    "Start from the observed outcome and reason backward to the most likely cause.",
  ],
  design: [
    "Extend the existing structure with the smallest change that satisfies the requirement.",
    "Introduce a new abstraction only if the existing one genuinely cannot carry the requirement.",
  ],
  debug: [
    "Reproduce the failure, isolate the smallest failing case, then bisect toward the cause.",
    "Enumerate the most probable failure classes for this stack and rule them out by evidence.",
  ],
  decision: [
    "Score each option on impact, reversibility, risk, and speed to a usable outcome.",
    "Identify the option that keeps the most future options open at acceptable cost.",
  ],
  research: [
    "Establish what is already known from context before treating anything as an open question.",
    "Separate settled facts from claims that need fresh verification.",
  ],
  planning: [
    "Sequence by dependency first, then by leverage, so early steps unblock later ones.",
    "Identify the single next buildable step and the critical path behind it.",
  ],
  comparison: [
    "Fix the comparison axes first, then evaluate each candidate on the same axes.",
    "Surface the one axis where the candidates most meaningfully diverge.",
  ],
  summary: [
    "Extract the load-bearing points and drop anything that does not change a decision.",
  ],
  calculation: [
    "State the formula and inputs explicitly, compute stepwise, then sanity-check magnitude.",
  ],
  generation: [
    "Clarify the target shape and constraints, draft, then tighten against the requirement.",
  ],
  question: [
    "Answer the literal question, then check whether the real underlying need differs.",
  ],
  conversation: [
    "Respond to what was actually asked without over-structuring.",
  ],
};

const CRITERIA_LIBRARY: Record<TaskType, string[]> = {
  analysis: ["correctness", "explanatory power", "evidence", "actionability"],
  design: ["fit with existing system", "simplicity", "reliability", "migration path"],
  debug: ["reproduces the symptom", "addresses root cause not symptom", "no regression"],
  decision: ["impact", "reversibility", "risk", "speed to outcome"],
  research: ["source quality", "recency", "coverage", "relevance"],
  planning: ["dependency order", "leverage", "feasibility", "clear next step"],
  comparison: ["consistent axes", "material differences", "fit to the user's situation"],
  summary: ["fidelity", "brevity", "decision relevance"],
  calculation: ["formula correctness", "unit consistency", "magnitude sanity"],
  generation: ["meets the requirement", "matches requested form", "quality"],
  question: ["directness", "correctness"],
  conversation: ["helpfulness", "naturalness"],
};

function scoreComplexity(message: string): number {
  const wc = words(message).length;
  let score = 0;
  if (wc > 30) score += 1;
  if (wc > 60) score += 1;
  if (wc > 110) score += 1;

  const asks = countAsks(message);
  if (asks >= 2) score += 1;
  if (asks >= 4) score += 1;

  if (ANALYTICAL_TERMS.test(message)) score += 2;
  const conditionals = (message.match(CONDITIONALS) || []).length;
  if (conditionals >= 1) score += 1;
  if (conditionals >= 3) score += 1;
  const constraints = (message.match(CONSTRAINTS) || []).length;
  if (constraints >= 1) score += 1;
  if (constraints >= 3) score += 1;

  // Multi-domain breadth: a wide spread of distinct content keywords.
  if (keywords(message).length >= 12) score += 1;

  return score;
}

function bandForScore(score: number): ComplexityBand {
  if (score >= 6) return "deep";
  if (score >= 4) return "complex";
  if (score >= 2) return "moderate";
  return "trivial";
}

function bandForConfidence(confidence: number): ConfidenceBand {
  if (confidence >= 0.72) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

/**
 * Confidence that ZED can answer this well right now, before generation.
 * High when context is present and the ask is well-scoped; lower when
 * uncertainty was flagged, the ask sprawls, or the request is highly
 * analytical without supporting knowledge.
 */
function estimateConfidence(
  message: string,
  band: ComplexityBand,
  input: DeepThinkingInput,
  subProblems: number,
): number {
  let c = 0.7;
  if (input.knowledgePresent) c += 0.12;
  if (input.materialUncertainty) c -= 0.22;
  if (band === "deep") c -= 0.14;
  else if (band === "complex") c -= 0.08;
  if (subProblems >= 4) c -= 0.06;
  if (ANALYTICAL_TERMS.test(message) && !input.knowledgePresent) c -= 0.08;
  if (/\b(maybe|not sure|unclear|ambiguous|vague|somehow|i think|guess)\b/i.test(message)) c -= 0.06;
  return Math.max(0.15, Math.min(0.95, Number(c.toFixed(2))));
}

export class DeepThinkingEngine {
  /** Complexity at/above which the staged reasoning scaffold engages. */
  static readonly ENGAGE_BAND: ComplexityBand = "complex";

  static analyze(input: DeepThinkingInput): DeepThinkingResult {
    const message = String(input.message || "");
    const taskType = detectTaskType(message);
    const score = scoreComplexity(message);
    const complexity = bandForScore(score);
    const revealReasoning = userWantsReasoningShown(message);

    const engaged =
      score >= 4 || // complex or deeper
      (score >= 2 && ["analysis", "design", "decision", "planning", "debug", "comparison"].includes(taskType));

    const decomposition = engaged ? decompose(message) : [];
    const subProblems = decomposition.length || countAsks(message) || 1;
    const confidence = estimateConfidence(message, complexity, input, subProblems);

    if (!engaged) {
      return {
        engaged: false,
        taskType,
        complexity,
        complexityScore: score,
        decomposition: [],
        hypotheses: [],
        evaluationCriteria: [],
        confidence,
        confidenceBand: bandForConfidence(confidence),
        revealReasoning,
        prompt: "",
      };
    }

    const hypotheses = HYPOTHESIS_LIBRARY[taskType] || HYPOTHESIS_LIBRARY.analysis;
    const evaluationCriteria = CRITERIA_LIBRARY[taskType] || CRITERIA_LIBRARY.analysis;

    const decompositionBlock =
      decomposition.length > 1
        ? decomposition.map((d, i) => `  ${i + 1}. ${d}`).join("\n")
        : "  1. Identify the single core problem and what a correct answer must satisfy.";

    const revealLine = revealReasoning
      ? "The user explicitly asked to see your reasoning: after the answer, include a brief, clean walkthrough of the stages — decomposition, the approach you chose and why, and how confident you are. Do not dump raw notes; summarize."
      : "Keep this entire reasoning process internal. Do not narrate the stages, the decomposition, the alternatives you rejected, or the confidence math. Only the refined answer reaches the user.";

    const prompt = [
      "## Deep Thinking Mode (internal reasoning pipeline)",
      `This request is ${complexity} (${taskType}). Do not answer immediately. Reason through it privately in stages first:`,
      "",
      "1. DECOMPOSE — the sub-problems to solve:",
      decompositionBlock,
      "",
      "2. HYPOTHESIZE — weigh at least two candidate approaches, for example:",
      ...hypotheses.map((h) => `   - ${h}`),
      "",
      `3. EVALUATE — judge candidate solutions against: ${evaluationCriteria.join(", ")}. Discard approaches that fail a criterion.`,
      "",
      "4. REFINE — compose the answer from the surviving approach; resolve gaps and contradictions before responding.",
      "",
      `5. CONFIDENCE — your pre-answer confidence is ${bandForConfidence(confidence)} (${confidence}). If confidence is low because a specific fact is missing, ask one precise question instead of guessing; otherwise answer and state assumptions plainly.`,
      "",
      revealLine,
    ].join("\n");

    return {
      engaged: true,
      taskType,
      complexity,
      complexityScore: score,
      decomposition,
      hypotheses,
      evaluationCriteria,
      confidence,
      confidenceBand: bandForConfidence(confidence),
      revealReasoning,
      prompt,
    };
  }
}

export default DeepThinkingEngine;
