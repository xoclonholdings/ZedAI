/**
 * AutonomousFollowUpEngine
 *
 * Lets ZAR continue revisiting tasks after the active conversation ends.
 *
 * Capabilities:
 *   - delayed follow-up
 *   - retry scheduling (within retry caps managed by TaskLifecycleManager)
 *   - reminder scheduling
 *   - blocked task monitoring
 *   - approval re-checking
 *   - task escalation
 *
 * Constraints (CRITICAL):
 *   - The engine MUST NOT execute unsafe actions automatically.
 *   - It always defers real-world execution to the approval pipeline.
 *   - It only schedules follow-ups, runs the watchdog, and notifies.
 */

import {
  DeferredActionScheduler,
  type DeferredKind,
  type DeferredAction,
} from "./DeferredActionScheduler";
import {
  TaskLifecycleManager,
  type TaskRecord,
} from "../execution/TaskLifecycleManager";
import { ApprovalWatchdog } from "../approval/ApprovalWatchdog";
import { ApprovalNotificationService } from "../approval/ApprovalNotificationService";
import { logRuntimeEvent } from "../RuntimeLogger";

export interface ScheduleFollowUpInput {
  task_id: string;
  follow_up_type: DeferredKind;
  scheduled_for: string | Date | number;
  notes?: string;
}

export interface FollowUpTickResult {
  processed: number;
  approved_to_resume: number;
  notifications_sent: number;
  details: Array<{
    deferred_id: string;
    task_id: string | null;
    outcome: string;
  }>;
}

export class AutonomousFollowUpEngine {
  /**
   * Schedule a single follow-up.
   */
  static async schedule(input: ScheduleFollowUpInput): Promise<DeferredAction> {
    return DeferredActionScheduler.schedule({
      task_id: input.task_id,
      kind: input.follow_up_type,
      scheduled_for: input.scheduled_for,
      notes: input.notes,
    });
  }

  /**
   * Sweep due follow-ups. For each one, take the safe action that
   * matches its kind (re-check approvals, log a reminder, ask the
   * watchdog for a fresh verdict, etc.). Never execute external work.
   */
  static async tick(now: Date = new Date()): Promise<FollowUpTickResult> {
    const due = await DeferredActionScheduler.dueNow(now);
    const result: FollowUpTickResult = {
      processed: 0,
      approved_to_resume: 0,
      notifications_sent: 0,
      details: [],
    };

    for (const action of due) {
      const task = action.task_id
        ? await TaskLifecycleManager.get(action.task_id)
        : null;

      let outcome = "noop";
      switch (action.kind) {
        case "approval_check":
          outcome = await this.handleApprovalCheck(task, result);
          break;
        case "status_check":
          outcome = await this.handleStatusCheck(task);
          break;
        case "retry":
          outcome = await this.handleRetry(task);
          break;
        case "reminder":
          outcome = await this.handleReminder(task, action, result);
          break;
        case "manual_review":
          outcome = await this.handleManualReview(task, result);
          break;
      }

      await DeferredActionScheduler.markComplete(action.id, outcome);
      result.processed++;
      result.details.push({
        deferred_id: action.id,
        task_id: action.task_id,
        outcome,
      });
    }

    if (result.processed > 0) {
      await logRuntimeEvent({
        level: "info",
        source: "server",
        event: "autonomous.followup.tick",
        detail: `Processed ${result.processed} due follow-ups`,
      });
    }
    return result;
  }

  private static async handleApprovalCheck(
    task: TaskRecord | null,
    result: FollowUpTickResult,
  ): Promise<string> {
    if (!task) return "task_not_found";
    if (task.approval_status === "approved") {
      result.approved_to_resume++;
      return "approval_already_granted";
    }
    const verdict = await ApprovalWatchdog.evaluate(task);
    if (verdict.notified) result.notifications_sent++;
    return `watchdog_verdict:${verdict.approval_status}`;
  }

  private static async handleStatusCheck(task: TaskRecord | null): Promise<string> {
    if (!task) return "task_not_found";
    return `status_${task.status}`;
  }

  private static async handleRetry(task: TaskRecord | null): Promise<string> {
    if (!task) return "task_not_found";
    if (task.approval_status !== "approved") {
      return "retry_skipped_no_approval";
    }
    if (task.status === "complete") return "retry_skipped_complete";
    const retried = await TaskLifecycleManager.retry(task.id);
    return retried ? `retry_attempt_${retried.retries}` : "retry_blocked_for_manual";
  }

  private static async handleReminder(
    task: TaskRecord | null,
    action: DeferredAction,
    result: FollowUpTickResult,
  ): Promise<string> {
    if (!task) return "reminder_task_not_found";
    const created = await ApprovalNotificationService.notify({
      recipient_role: "user",
      recipient_id: task.user_id,
      task_id: task.id,
      title: `Reminder: ${task.plan?.summary?.slice(0, 80) || task.id}`,
      message: action.notes || "Reminder from ZAR",
      action_type: "review_only",
      approval_required: false,
      dedupe_key: `reminder:${task.id}:${action.id}`,
    });
    if (created) result.notifications_sent++;
    return created ? "reminder_sent" : "reminder_duplicate_suppressed";
  }

  private static async handleManualReview(
    task: TaskRecord | null,
    result: FollowUpTickResult,
  ): Promise<string> {
    if (!task) return "task_not_found";
    const created = await ApprovalNotificationService.notify({
      recipient_role: "admin",
      recipient_id: null,
      task_id: task.id,
      title: `Manual review needed: ${task.plan?.summary?.slice(0, 80) || task.id}`,
      message:
        task.approval_reason ||
        "Task requires manual review based on its current state.",
      action_type: "manual_handle",
    });
    if (created) result.notifications_sent++;
    return created ? "manual_review_notified" : "manual_review_duplicate";
  }
}

export default AutonomousFollowUpEngine;
