/**
 * Capability 4 — Adaptive Response Intelligence.
 *
 * The existing ZarResponsePolicy / Voice layer sets a good *default*
 * house style, but it is static: the same guidance regardless of what the
 * user actually asked for. Claude instead reshapes each response to the
 * situation — a checklist here, a tight table there, prose when prose is
 * right.
 *
 * This engine reads intent, complexity, urgency, task type, and the depth
 * / precision the answer needs, then emits a per-message directive that
 * picks the response *form* and verbosity. It deliberately does NOT force
 * robotic sections ("Research Brief", "Confidence Level"); it only adds
 * structure when the content genuinely benefits, staying aligned with the
 * repo's existing anti-template response policy.
 */

import { countAsks, detectTaskType, detectUrgency, words } from "./analysis";
import type {
  ComplexityBand,
  ResponseForm,
  ResponseOrchestrationResult,
  Verbosity,
} from "./types";

export interface ResponseOrchestrationInput {
  message: string;
  complexity: ComplexityBand;
  /** True when the current lane is a specialist/strategy lane. */
  strategic?: boolean;
}

const EXPLICIT_TABLE = /\b(table|matrix|grid|spreadsheet|side by side|columns?)\b/i;
const EXPLICIT_STEPS = /\b(steps?|step[- ]by[- ]step|in order|sequence)\b/i;
const EXPLICIT_LIST = /\b(list|bullet|checklist|enumerate|itemi[sz]e)\b/i;
const EXPLICIT_REPORT = /\b(report|write[- ]?up|brief|memo|full analysis|deep dive|document)\b/i;
const EXPLICIT_SUMMARY = /\b(summari[sz]e|tl;?dr|executive summary|short version|in brief|recap)\b/i;
const CODE_INTENT = /\b(code|function|script|snippet|regex|command|query|config|yaml|json|sql|implement|write a (?:function|class|method))\b/i;
const HOWTO_INTENT = /\b(how (?:do|can|should) i|how to|walk me through|guide me|set up|configure|install|deploy)\b/i;

function pickForm(input: ResponseOrchestrationInput, taskType: string): ResponseForm {
  const m = input.message;

  // Explicit user requests win — honor exactly what was asked for.
  if (EXPLICIT_TABLE.test(m)) return "table";
  if (EXPLICIT_SUMMARY.test(m)) return "executive_summary";
  if (EXPLICIT_REPORT.test(m)) return "report";
  if (CODE_INTENT.test(m)) return "code";
  if (EXPLICIT_STEPS.test(m) || HOWTO_INTENT.test(m)) return "steps";
  if (EXPLICIT_LIST.test(m)) return "checklist";

  // Otherwise infer from task shape.
  if (taskType === "comparison") return "table";
  if (taskType === "planning" || HOWTO_INTENT.test(m)) return "steps";
  if (taskType === "decision") return "direct";
  if (taskType === "calculation") return "direct";
  if (taskType === "summary") return "executive_summary";
  if ((taskType === "analysis" || input.strategic) && input.complexity === "deep") return "report";
  if (countAsks(m) >= 3) return "checklist";
  return "direct";
}

function pickVerbosity(input: ResponseOrchestrationInput): Verbosity {
  const wc = words(input.message).length;
  if (input.complexity === "trivial" && wc < 18) return "terse";
  if (input.complexity === "deep" || wc > 80) return "detailed";
  return "balanced";
}

const FORM_DIRECTIVES: Record<ResponseForm, string> = {
  direct: "Lead with the answer in one to three short paragraphs. Add a single concrete next step only if it helps. No headings, no table.",
  steps: "Give a short framing sentence, then numbered steps in the order they should be done. Keep each step to one action. Note prerequisites or gotchas inline.",
  checklist: "Answer the core point first, then a compact checklist ('- [ ] item') covering each distinct thing asked. One line per item.",
  table: "Open with the bottom-line takeaway, then a compact markdown table with consistent columns. Keep cells short; put nuance in one line under the table.",
  comparison: "State which option you'd pick and why in one line, then compare on the axes that actually differ. A small table is fine only if it earns its space.",
  report: "This warrants depth. Use a brief lead answer, then a few clearly-labeled sections that fit THIS question (not generic report labels). Close with the next move.",
  executive_summary: "Be brief and high-signal: the takeaway first, then at most a few supporting bullets. Cut anything that does not change a decision.",
  code: "Give the working code in a single fenced block with the right language tag, then one or two lines on how to use it or what to watch for. No ceremony.",
};

const VERBOSITY_DIRECTIVES: Record<Verbosity, string> = {
  terse: "Keep it short — the user asked something simple; do not pad it.",
  balanced: "Keep the first screen useful; expand only where the content needs it.",
  detailed: "Depth is warranted here, but stay dense — every line should carry weight, no filler.",
};

export class ResponseOrchestrationEngine {
  static plan(input: ResponseOrchestrationInput): ResponseOrchestrationResult {
    const taskType = detectTaskType(input.message);
    const urgency = detectUrgency(input.message);
    const form = pickForm(input, taskType);
    const verbosity = urgency === "high" ? "terse" : pickVerbosity(input);

    const requiredPrecision: "loose" | "standard" | "exact" =
      taskType === "calculation" || form === "code" || /\b(exact|precise|specific|accurac)\b/i.test(input.message)
        ? "exact"
        : input.complexity === "trivial"
          ? "loose"
          : "standard";

    const urgencyLine =
      urgency === "high"
        ? "The user signaled urgency: put the single most useful, actionable thing first and skip preamble."
        : "";

    const prompt = [
      "## Adaptive Response Directive",
      "Shape this specific reply to the request; do not fall back on a fixed template or reusable report headings.",
      `Chosen form: ${form}. ${FORM_DIRECTIVES[form]}`,
      `Verbosity: ${verbosity}. ${VERBOSITY_DIRECTIVES[verbosity]}`,
      `Required precision: ${requiredPrecision}.`,
      urgencyLine,
      "The response must still read naturally and in ZAR's voice — structure serves clarity, it is not decoration.",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      form,
      verbosity,
      urgency,
      requiredDepth: input.complexity,
      requiredPrecision,
      prompt,
    };
  }
}

export default ResponseOrchestrationEngine;
