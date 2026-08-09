/**
 * ApprovalDecisionHandler
 *
 * Handles approve / reject / manual_handle decisions made by a user or
 * admin. Updates the task's lifecycle and records the decision.
 *
 * Constraints:
 *   - Does NOT directly execute the task. Whether execution may resume
 *     is determined by the existing pipeline (ExecutionPipeline.dispatch).
 *   - Logs all decisions and reasons.
 */

import {
  TaskLifecycleManager,
  type TaskRecord,
} from "../execution/TaskLifecycleManager";
import { ExecutionApprovalHandler } from "../execution/ExecutionApprovalHandler";
import { ApprovalNotificationService } from "./ApprovalNotificationService";
import { logRuntimeEvent } from "../RuntimeLogger";
import { createOwnerContext } from "../auth/OwnerContext";

export type ApprovalAction = "approve" | "reject" | "manual_handle";

export interface DecisionInput {
  task_id: string;
  decided_by: string;
  decider_role: "user" | "admin" | "system";
  action: ApprovalAction;
  reason?: string;
  manual_handling_notes?: string;
}

export interface DecisionResult {
  ok: boolean;
  task: TaskRecord | null;
  message: string;
}

export class ApprovalDecisionHandler {
  static async decide(input: DecisionInput): Promise<DecisionResult> {
    const actor = createOwnerContext(input.decided_by);
    const task = await TaskLifecycleManager.get(input.task_id);
    if (!task) {
      return { ok: false, task: null, message: `Task ${input.task_id} not found.` };
    }
    if (input.decider_role !== "admin" && task.user_id !== actor.ownerUserId) {
      return { ok: false, task: null, message: `Task ${input.task_id} not found.` };
    }

    switch (input.action) {
      case "approve":
        return this.approve(task, input);
      case "reject":
        return this.reject(task, input);
      case "manual_handle":
        return this.manualHandle(task, input);
      default:
        return {
          ok: false,
          task,
          message: `Unsupported action: ${String(input.action)}`,
        };
    }
  }

  private static async approve(task: TaskRecord, input: DecisionInput): Promise<DecisionResult> {
    const recordedAt = new Date().toISOString();
    await ExecutionApprovalHandler.record({
      task_id: task.id,
      user_id: input.decided_by,
      plan: task.plan,
      approved: true,
      approver_role: input.decider_role,
      notes: input.reason,
    });

    const updated = await TaskLifecycleManager.update(
      task.id,
      {
        status: "approved",
        approval_status: "approved",
        approval_role: input.decider_role,
        approval_reason: input.reason,
        approved_at: recordedAt,
        approved_by: input.decided_by,
      },
      `Approved by ${input.decider_role}`,
    );

    await ApprovalNotificationService.markTaskNotificationsRead(task.id);
    await logRuntimeEvent({
      level: "info",
      source: "server",
      event: "approval.decision.approve",
      detail: `Task ${task.id} approved`,
      context: { task_id: task.id, role: input.decider_role },
    });

    return {
      ok: true,
      task: updated,
      message: "Task approved. The execution pipeline may now dispatch it.",
    };
  }

  private static async reject(task: TaskRecord, input: DecisionInput): Promise<DecisionResult> {
    const reason = input.reason || "Rejected without reason provided";
    await ExecutionApprovalHandler.record({
      task_id: task.id,
      user_id: input.decided_by,
      plan: task.plan,
      approved: false,
      approver_role: input.decider_role,
      notes: reason,
    });

    // Existing approval queue stores cancelled state implicitly via 'blocked'
    // because TaskRecord doesn't define a 'cancelled' status. Use 'blocked'
    // to stay compatible with the existing task model.
    const updated = await TaskLifecycleManager.update(
      task.id,
      {
        status: "blocked",
        approval_status: "rejected",
        approval_role: input.decider_role,
        approval_reason: reason,
        approved_at: null,
        approved_by: input.decided_by,
      },
      `Rejected by ${input.decider_role}: ${reason}`,
    );

    await ApprovalNotificationService.markTaskNotificationsRead(task.id);
    await logRuntimeEvent({
      level: "info",
      source: "server",
      event: "approval.decision.reject",
      detail: `Task ${task.id} rejected`,
      context: { task_id: task.id, role: input.decider_role, reason },
    });

    return { ok: true, task: updated, message: "Task rejected and blocked." };
  }

  private static async manualHandle(task: TaskRecord, input: DecisionInput): Promise<DecisionResult> {
    const notes = input.manual_handling_notes || input.reason;
    const updated = await TaskLifecycleManager.update(
      task.id,
      {
        status: "blocked",
        approval_status: "manual_handling_required",
        approval_role: input.decider_role,
        approval_reason: notes,
      },
      `Marked for manual handling by ${input.decider_role}`,
    );

    await logRuntimeEvent({
      level: "info",
      source: "server",
      event: "approval.decision.manual_handle",
      detail: `Task ${task.id} marked for manual handling`,
      context: { task_id: task.id, role: input.decider_role, notes },
    });

    return {
      ok: true,
      task: updated,
      message: "Task left for manual handling. Automatic execution is disabled.",
    };
  }
}

export default ApprovalDecisionHandler;
