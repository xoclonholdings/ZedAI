/**
 * PriorityClassificationEngine
 *
 * Classifies inbox/task items by urgency and stage. Pure transformation —
 * no I/O, no provider calls. Callers feed in subject/body/metadata and
 * receive a structured priority verdict.
 */

export type Priority = "low" | "normal" | "high" | "urgent";
export type WorkflowCategory =
  | "reply_needed"
  | "scheduling"
  | "finance"
  | "account"
  | "support"
  | "opportunity"
  | "unknown";

export interface ClassificationInput {
  subject?: string;
  body?: string;
  sender?: string;
  received_at?: string;
  /** Optional metadata flags from the source system. */
  flags?: {
    starred?: boolean;
    important?: boolean;
    has_attachment?: boolean;
    thread_length?: number;
  };
  priority_signals?: {
    deadline?: string;
    dependency_count?: number;
    blocks_others?: boolean;
    commitment?: boolean;
    goal_alignment?: "none" | "supporting" | "direct";
    user_priority?: Priority;
  };
}

export interface ClassificationResult {
  priority: Priority;
  category: WorkflowCategory;
  reason: string;
  recommended_action: string;
}

const URGENT_TOKENS = [
  "urgent", "asap", "immediately", "right now", "today only",
  "deadline", "final notice", "overdue", "past due",
  "lockout", "shutoff", "shut off", "cancellation", "expiring",
];

const HIGH_TOKENS = [
  "follow up", "follow-up", "by tomorrow", "this week", "respond",
  "action required", "needs response", "please confirm",
];

const SCHEDULING_TOKENS = [
  "meeting", "schedule", "calendar", "availability",
  "reschedule", "appointment", "invite", "zoom", "google meet",
];

const FINANCE_TOKENS = [
  "invoice", "payment", "payroll", "refund", "charge", "fee",
  "subscription", "renewal", "tax", "wire", "ach", "deposit",
];

const ACCOUNT_TOKENS = [
  "account", "password", "login", "verify", "verification",
  "2fa", "two-factor", "security alert", "suspicious",
];

const SUPPORT_TOKENS = [
  "issue", "problem", "broken", "not working", "error",
  "bug", "complaint", "ticket",
];

const OPPORTUNITY_TOKENS = [
  "opportunity", "offer", "proposal", "lead", "intro",
  "interested", "demo", "partnership",
];

export class PriorityClassificationEngine {
  static classify(input: ClassificationInput): ClassificationResult {
    const subject = (input.subject || "").toLowerCase();
    const body = (input.body || "").toLowerCase();
    const corpus = `${subject}\n${body}`;

    const category = this.pickCategory(corpus);
    const priority = this.pickPriority(corpus, input);
    const reason = this.buildReason(category, priority, input);
    const recommended_action = this.recommendedAction(category, priority);

    return { priority, category, reason, recommended_action };
  }

  private static includesAny(corpus: string, tokens: string[]): boolean {
    return tokens.some((t) => corpus.includes(t));
  }

  private static pickCategory(corpus: string): WorkflowCategory {
    if (this.includesAny(corpus, SCHEDULING_TOKENS)) return "scheduling";
    if (this.includesAny(corpus, FINANCE_TOKENS)) return "finance";
    if (this.includesAny(corpus, ACCOUNT_TOKENS)) return "account";
    if (this.includesAny(corpus, OPPORTUNITY_TOKENS)) return "opportunity";
    if (this.includesAny(corpus, SUPPORT_TOKENS)) return "support";
    if (corpus.includes("?") || this.includesAny(corpus, ["please reply", "let me know"])) {
      return "reply_needed";
    }
    return "unknown";
  }

  private static pickPriority(
    corpus: string,
    input: ClassificationInput,
  ): Priority {
    const signals = input.priority_signals;
    if (signals?.user_priority) return signals.user_priority;

    if (signals?.deadline) {
      const deadline = new Date(signals.deadline).getTime();
      if (Number.isFinite(deadline)) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) return "urgent";
        if (remaining <= 24 * 60 * 60_000) return "urgent";
        if (remaining <= 3 * 24 * 60 * 60_000) return "high";
      }
    }

    if (signals?.blocks_others && signals.commitment) return "urgent";
    if (signals?.blocks_others || signals?.commitment) return "high";
    if ((signals?.dependency_count || 0) > 0 && signals?.goal_alignment === "direct") {
      return "high";
    }

    if (input.flags?.starred || input.flags?.important) {
      if (this.includesAny(corpus, URGENT_TOKENS)) return "urgent";
      return "high";
    }
    if (this.includesAny(corpus, URGENT_TOKENS)) return "urgent";
    if (this.includesAny(corpus, HIGH_TOKENS)) return "high";

    if ((input.flags?.thread_length || 0) >= 4) return "high";
    if (corpus.includes("?")) return "normal";
    return "low";
  }

  private static buildReason(
    category: WorkflowCategory,
    priority: Priority,
    input: ClassificationInput,
  ): string {
    const sender = input.sender ? ` from ${input.sender}` : "";
    const structuredSignals = input.priority_signals
      ? " plus explicit deadline, dependency, commitment, goal, or user-priority signals"
      : "";
    return `Classified as ${category} with ${priority} priority based on subject/body signals${structuredSignals}${sender}.`;
  }

  private static recommendedAction(
    category: WorkflowCategory,
    priority: Priority,
  ): string {
    if (category === "scheduling") return "Run SchedulingAssistant to draft availability options.";
    if (category === "finance") return "Route via ApprovalWatchdog (admin) before any action.";
    if (category === "account") return "Confirm with user before changing account state.";
    if (category === "opportunity") return "Draft a reply via VoiceMatchedDraftingEngine.";
    if (category === "support") return "Draft a support reply and queue for user approval.";
    if (category === "reply_needed") return "Draft a reply via VoiceMatchedDraftingEngine.";
    if (priority === "urgent") return "Surface to user immediately for triage.";
    return "Hold for batch review.";
  }
}

export default PriorityClassificationEngine;
