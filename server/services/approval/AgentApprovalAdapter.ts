/**
 * AgentApprovalAdapter
 *
 * One canonical path for agents and ZCOS-owned execution services to register
 * an action that needs approval. Replaces direct writes to scattered approval
 * files so admin sees a single, unified queue.
 *
 * Flow:
 *   1. Build a TaskExecutionPlan from the draft/proposal.
 *   2. Persist as a TaskRecord via TaskLifecycleManager.
 *   3. Run ApprovalWatchdog so the right approval_status / role is set
 *      and the admin notification (and email) is dispatched.
 *
 * Returns the task_id so callers can persist it as the approvalId.
 */

import {
  TaskExecutionEngine,
  type TaskType,
} from "../execution/TaskExecutionEngine";
import { TaskLifecycleManager } from "../execution/TaskLifecycleManager";
import { ApprovalWatchdog } from "./ApprovalWatchdog";
import { ApprovalNotificationService } from "./ApprovalNotificationService";
import { logSecurityEvent } from "../SecurityAudit";

export type AgentSource =
  | "OperationsAgent"
  | "BusinessManagerAgent"
  | "FinanceAgent"
  | "IntelligenceAgent"
  | "ZcosFlowEngine";

export interface AgentApprovalInput {
  user_id: string;
  conversation_id?: string | null;
  /** The user's original request or flow-stage approval reason. */
  message: string;
  /** The agent's draft / plan output / approval context. */
  draft: string;
  /** Which agent or ZCOS service produced the approval request. */
  agent: AgentSource;
  /** Hint for plan classification. Optional; auto-derived when omitted. */
  task_type_hint?: TaskType;
  /** Free-form capabilities the agent/service flagged for context. */
  capabilities?: string[];
  dispatch?: {
    action_type: "email" | "form_submit" | "api_call";
    payload: Record<string, unknown>;
  };
}

export interface AgentApprovalResult {
  task_id: string;
  approval_status: string | undefined;
  approval_role: "user" | "admin" | "system" | null | undefined;
}

export class AgentApprovalAdapter {
  static async register(input: AgentApprovalInput): Promise<AgentApprovalResult> {
    const plan = TaskExecutionEngine.prepare({
      user_request: input.message,
      context: {
        agent: input.agent,
        capabilities: input.capabilities,
        draft_preview: input.draft.slice(0, 600),
        dispatch: input.dispatch,
      },
    });

    plan.summary = `[${input.agent}] ${plan.summary}`;

    const task = await TaskLifecycleManager.create({
      user_id: input.user_id,
      conversation_id: input.conversation_id ?? null,
      plan,
      origin: "zar",
      assignee: "zar",
      acceptance_status: "proposed",
    });

    await TaskLifecycleManager.appendLog(
      task.id,
      "info",
      `Draft from ${input.agent}: ${input.draft.slice(0, 240)}${input.draft.length > 240 ? "..." : ""}`,
      input.dispatch ? { dispatch: input.dispatch } : undefined,
    );

    const verdict = await ApprovalWatchdog.evaluate(task);
    await ApprovalNotificationService.notify({
      recipient_role: "user",
      recipient_id: input.user_id,
      task_id: task.id,
      title: "ZAR suggested a task",
      message: task.plan.summary,
      action_type: "approve",
      approval_required: true,
      target_surface: "task",
      category: "suggestion",
      dedupe_key: `suggestion:${task.id}`,
    });

    await logSecurityEvent({
      type: "approval.queued",
      userId: input.user_id,
      detail: `[${input.agent}] task ${task.id} -> ${verdict.approval_status}`,
    });

    return {
      task_id: task.id,
      approval_status: verdict.approval_status,
      approval_role: verdict.approval_role,
    };
  }
}

export default AgentApprovalAdapter;
