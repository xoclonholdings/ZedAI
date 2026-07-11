/**
 * Shared types for the Research workspace — a working surface where you
 * give Zed a subject and it produces a structured, editable brief you can
 * act on, saved durably so the desk fills up over time.
 */

export interface ResearchBrief {
  id: string;
  createdAt: string;
  topic: string;
  /** A few-sentence orientation on the subject. */
  summary: string;
  /** The core things Zed found worth knowing. */
  keyFindings: string[];
  /** Risks, unknowns, or things to be careful about. */
  risks: string[];
  /** Questions still open — what to dig into next. */
  openQuestions: string[];
  /** Concrete next actions. */
  nextSteps: string[];
  /** Any sources the user pasted in for this brief. */
  sources: string[];
  /** True when built from Zed's own knowledge (no live web source). */
  draft: boolean;
  /** Plain note on what the brief is grounded in. */
  basis: string;
}
