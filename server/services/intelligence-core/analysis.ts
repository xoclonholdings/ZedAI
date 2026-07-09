/**
 * Shared deterministic text analysis for the Intelligence Core engines.
 *
 * These are intentionally lightweight, dependency-free heuristics — the
 * same style as ZedStrategicReasoningEngine's trigger patterns — so the
 * whole Intelligence Core runs synchronously in-process with no model
 * call and no added latency on the hot path.
 */

import type { TaskType, Urgency } from "./types";

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "have", "from", "your",
  "what", "when", "which", "into", "about", "would", "could", "should",
  "there", "their", "them", "then", "than", "will", "shall", "been",
  "being", "does", "just", "like", "make", "want", "need", "know",
]);

export function words(text: string): string[] {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function keywords(text: string, min = 3): string[] {
  return Array.from(
    new Set(words(text).filter((w) => w.length >= min && !STOP_WORDS.has(w))),
  );
}

const TASK_PATTERNS: Array<[TaskType, RegExp]> = [
  ["debug", /\b(debug|error|bug|broken|failing|fails|not working|stack ?trace|exception|crash|fix)\b/i],
  ["design", /\b(design|architect|architecture|structure|schema|model|build|implement|refactor)\b/i],
  ["comparison", /\b(compare|versus|vs\.?|difference|better|which (?:one|is)|pros and cons|tradeoff)\b/i],
  ["decision", /\b(should i|should we|decide|decision|recommend|best (?:option|move|choice|approach)|worth it|go with)\b/i],
  ["planning", /\b(plan|roadmap|steps|milestone|schedule|timeline|sequence|prioriti[sz]e|how do i (?:get|start)|next step)\b/i],
  ["research", /\b(research|investigate|find out|look up|latest|news|market|study|survey|deep dive|sources?)\b/i],
  ["analysis", /\b(analy[sz]e|analysis|evaluate|assess|why|root cause|implications?|impact|breakdown|examine)\b/i],
  ["calculation", /\b(calculate|compute|how much|how many|total|sum|average|percentage|ratio|convert)\b/i],
  ["summary", /\b(summari[sz]e|summary|tl;?dr|recap|gist|overview|key points)\b/i],
  ["generation", /\b(write|draft|generate|create|compose|produce|make me|give me an?)\b/i],
];

export function detectTaskType(message: string): TaskType {
  for (const [type, pattern] of TASK_PATTERNS) {
    if (pattern.test(message)) return type;
  }
  // A trailing question mark with no other signal is a plain question.
  if (/\?\s*$/.test(message.trim())) return "question";
  return "conversation";
}

const URGENCY_HIGH = /\b(urgent|asap|immediately|right now|critical|emergency|blocker|blocking|deadline|today|can'?t wait|production (?:is )?down|breaking)\b/i;
const URGENCY_LOW = /\b(whenever|no rush|eventually|someday|when you (?:get|have) (?:a )?(?:chance|time)|low priority|just curious|idle)\b/i;

export function detectUrgency(message: string): Urgency {
  if (URGENCY_HIGH.test(message)) return "high";
  if (URGENCY_LOW.test(message)) return "low";
  return "normal";
}

/**
 * Split a request into candidate sub-problems. Splits on enumerations,
 * newlines, hard punctuation, and coordinating conjunctions that join
 * independent clauses — then keeps only substantive fragments.
 */
export function decompose(message: string, limit = 6): string[] {
  const normalized = String(message || "")
    // enumerations "1. ", "1) ", "- ", "* "
    .replace(/(^|\n)\s*(?:\d+[.)]|[-*•])\s+/g, "\n")
    .replace(/\b(?:and then|and also|as well as|then|also,|plus,)\b/gi, "\n");

  const fragments = normalized
    .split(/[\n?;]+|(?<=[.!])\s+(?=[A-Z])/)
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

  const substantive = fragments.filter((f) => words(f).length >= 3);
  const unique = Array.from(new Set(substantive.length > 0 ? substantive : fragments));
  return unique.slice(0, limit);
}

/** Count explicitly-asked things: question marks + enumerated list items. */
export function countAsks(message: string): number {
  const questionMarks = (message.match(/\?/g) || []).length;
  const enumerated = (message.match(/(^|\n)\s*(?:\d+[.)]|[-*•])\s+/g) || []).length;
  return Math.max(questionMarks, enumerated);
}

const REVEAL_REASONING = /\b(show (?:me )?(?:your )?(?:reasoning|thinking|work|steps)|think (?:out loud|step by step)|walk me through (?:your )?(?:reasoning|thinking|how)|explain your reasoning|reason(?:ing)? (?:it |this )?through|step by step)\b/i;

export function userWantsReasoningShown(message: string): boolean {
  return REVEAL_REASONING.test(message);
}
