/**
 * TaskExecutionEngine
 *
 * Phase 1 of ZAR's Execution Layer.
 *
 * Purpose:
 *   Convert a user intent into a structured execution plan.
 *
 * Constraints (CRITICAL):
 *   - This module MUST NOT execute anything in the real world.
 *   - It MUST ONLY prepare an execution plan.
 *   - It generates human-usable scripts (calls / emails / etc.).
 *   - It identifies missing required info and lists it for the caller.
 *   - It does not change existing UI, flows, or architecture.
 */

export type TaskType = "cancel" | "book" | "resolve";
export type ExecutionMode = "manual" | "digital" | "future_human";

export interface DecisionPoint {
  condition: string;
  options: string[];
}

export interface TaskExecutionPlan {
  task_type: TaskType;
  summary: string;
  required_info: string[];
  steps: string[];
  script: string;
  decision_points: DecisionPoint[];
  execution_mode: ExecutionMode;
}

export interface TaskExecutionInput {
  user_request: string;
  context?: Record<string, unknown>;
}

export class TaskExecutionEngine {
  /**
   * Inspect a user's request and produce a structured plan.
   * Pure transformation. No side-effects, no network calls.
   */
  static prepare(input: TaskExecutionInput): TaskExecutionPlan {
    const request = (input.user_request || "").toString();
    const lower = request.toLowerCase();

    const task_type = this.classifyTaskType(lower);
    const execution_mode = this.classifyExecutionMode(lower);

    const required_info = this.collectRequiredInfo(lower, input.context);
    const steps = this.buildSteps(task_type, execution_mode, lower);
    const script = this.buildScript(task_type, lower, input.context);
    const decision_points = this.buildDecisionPoints(task_type, lower);
    const summary = this.buildSummary(task_type, request);

    return {
      task_type,
      summary,
      required_info,
      steps,
      script,
      decision_points,
      execution_mode,
    };
  }

  private static classifyTaskType(lower: string): TaskType {
    if (/(cancel|terminate|end\b|stop\b)/.test(lower)) return "cancel";
    if (/(book|reserve|schedule|appointment|meeting)/.test(lower)) return "book";
    return "resolve";
  }

  private static classifyExecutionMode(lower: string): ExecutionMode {
    if (/(call\b|phone|voicemail|negotiate|in person|in-person|verify identity)/.test(lower)) {
      return "future_human";
    }
    if (/(email|message|send|api|form|submit|click|website|portal|online)/.test(lower)) {
      return "digital";
    }
    return "manual";
  }

  private static collectRequiredInfo(
    lower: string,
    context?: Record<string, unknown>,
  ): string[] {
    const ctx = context || {};
    const missing: string[] = [];

    const has = (key: string) => ctx[key] != null && String(ctx[key]).length > 0;

    if (/(account|membership|subscription|service|plan)/.test(lower) && !has("accountId")) {
      missing.push("account_id_or_reference");
    }

    if (/(provider|company|vendor|carrier|merchant|bank)/.test(lower) && !has("provider")) {
      missing.push("provider_name");
    }

    if (/(email)/.test(lower) && !has("recipientEmail")) {
      missing.push("recipient_email");
    }

    if (/(call|phone|voicemail)/.test(lower) && !has("phoneNumber")) {
      missing.push("contact_phone_number");
    }

    if (/(book|schedule|meeting|appointment|reschedule)/.test(lower) && !has("availability")) {
      missing.push("user_availability_window");
    }

    if (/(cancel|terminate)/.test(lower) && !has("cancellationReason")) {
      missing.push("cancellation_reason");
    }

    if (/(verify|verification|identity|kyc)/.test(lower) && !has("identityProof")) {
      missing.push("identity_proof_documents");
    }

    return Array.from(new Set(missing));
  }

  private static buildSteps(
    task_type: TaskType,
    execution_mode: ExecutionMode,
    lower: string,
  ): string[] {
    const steps: string[] = [];

    steps.push("Confirm the user's intent and required information.");
    steps.push("Verify all preconditions (account access, contact details, eligibility).");

    if (task_type === "cancel") {
      steps.push("Locate the active service / agreement to be cancelled.");
      steps.push("Prepare cancellation script or email referencing the correct account.");
      steps.push("Capture any cancellation confirmation number returned by the provider.");
    } else if (task_type === "book") {
      steps.push("Identify available time windows or inventory.");
      steps.push("Prepare booking request with the user's preferred slot.");
      steps.push("Save confirmation details to the task lifecycle record.");
    } else {
      steps.push("Determine the resolution path and required follow-up.");
      steps.push("Prepare the outbound message / action that will resolve the issue.");
    }

    if (execution_mode === "digital") {
      steps.push("Route the prepared action to the DigitalExecutionService for execution.");
    } else if (execution_mode === "future_human") {
      steps.push("Route the task to the HumanExecutionBridge for future human handling.");
    } else {
      steps.push("Provide the script / instructions to the user for manual execution.");
    }

    if (/finance|payment|charge|refund|payroll|invoice|bank|card/.test(lower)) {
      steps.push("Flag financial action for admin approval before any execution.");
    }

    steps.push("Wait for explicit approval before any real-world action is performed.");
    steps.push("Update the TaskLifecycleManager with the final outcome.");

    return steps;
  }

  private static buildScript(
    task_type: TaskType,
    lower: string,
    context?: Record<string, unknown>,
  ): string {
    const ctx = context || {};
    const userName = (ctx.userName as string) || "[your full name]";
    const accountRef = (ctx.accountId as string) || "[account reference]";
    const provider = (ctx.provider as string) || "[provider name]";

    if (task_type === "cancel") {
      if (/email/.test(lower)) {
        return [
          `Subject: Cancellation request for account ${accountRef}`,
          ``,
          `Hello ${provider} team,`,
          ``,
          `I am writing to formally request the cancellation of my account / service `,
          `referenced as ${accountRef}. Please process this cancellation effective`,
          `immediately and confirm in writing once it has been completed.`,
          ``,
          `If any final balances are owed, please send a written breakdown.`,
          ``,
          `Thank you,`,
          `${userName}`,
        ].join("\n");
      }
      return [
        `Hello, my name is ${userName}.`,
        `I'd like to cancel my account or service referenced as ${accountRef} with ${provider}.`,
        `Please confirm the effective date of cancellation and provide a confirmation number.`,
        `If there are any retention offers, please note them but proceed with cancellation unless I explicitly accept one.`,
      ].join(" ");
    }

    if (task_type === "book") {
      return [
        `Hello ${provider},`,
        ``,
        `I would like to book / schedule a session.`,
        `My preferred windows are: [insert availability].`,
        `Please confirm the booking with a calendar invite or confirmation number.`,
        ``,
        `Thank you,`,
        `${userName}`,
      ].join("\n");
    }

    return [
      `Hello ${provider},`,
      ``,
      `I am following up regarding: [describe issue or request].`,
      `Account reference: ${accountRef}.`,
      `Please advise on next steps and confirm any actions taken on my account.`,
      ``,
      `Thank you,`,
      `${userName}`,
    ].join("\n");
  }

  private static buildDecisionPoints(task_type: TaskType, lower: string): DecisionPoint[] {
    const points: DecisionPoint[] = [];

    if (task_type === "cancel") {
      points.push({
        condition: "Provider offers a retention discount or downgrade",
        options: ["accept_offer", "decline_and_proceed_with_cancellation"],
      });
      points.push({
        condition: "Provider requires identity verification before cancellation",
        options: ["provide_verification", "abort_and_request_user_handling"],
      });
    }

    if (task_type === "book") {
      points.push({
        condition: "Preferred time window is unavailable",
        options: ["accept_alternate_window", "request_user_to_pick_new_window"],
      });
    }

    if (task_type === "resolve") {
      points.push({
        condition: "Provider asks for additional information not in context",
        options: ["request_more_info_from_user", "abort_action"],
      });
    }

    if (/finance|payment|charge|refund|invoice/.test(lower)) {
      points.push({
        condition: "Financial impact above safe-execution threshold",
        options: ["require_admin_approval", "manual_handle"],
      });
    }

    return points;
  }

  private static buildSummary(task_type: TaskType, request: string): string {
    const trimmed = request.trim().slice(0, 240);
    return `Prepared ${task_type} plan for: ${trimmed}`;
  }
}

export default TaskExecutionEngine;
