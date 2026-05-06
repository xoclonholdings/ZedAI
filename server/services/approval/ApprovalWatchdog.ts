/**
 * ApprovalWatchdog
 *
 * Inspects pending / blocked / in_progress tasks on the lifecycle store
 * and decides whether each one requires approval, manual handling, or
 * is free to continue. Sets approval state on the task and dispatches
 * a notification through ApprovalNotificationService.
 *
 * Constraints (CRITICAL):
 *   - The watchdog NEVER executes a real-world action.
 *   - It only sets state and creates notifications.
 *   - It does not modify any existing UI surface.
 *
 * Integration:
 *   - Reads tasks via TaskLifecycleManager.list()
 *   - Mutates tasks via TaskLifecycleManager.update()
 *   - Notifies via ApprovalNotificationService.notify()
 */

import { TaskLifecycleManager, type TaskRecord } from "../execution/TaskLifecycleManager";
import {
  ApprovalNotificationService,
  type NotificationActionType,
  type RecipientRole,
} from "./ApprovalNotificationService";
import { logRuntimeEvent } from "../RuntimeLogger";

export type ApprovalRoleNeed = "user" | "admin" | "system" | null;
export type ApprovalDecisionStatus =
  | "not_required"
  | "user_required"
  | "admin_required"
  | "approved"
  | "rejected"
  | "manual_handling_required";

export interface WatchdogVerdict {
  task_id: string;
  approval_status: ApprovalDecisionStatus;
  approval_role: ApprovalRoleNeed;
  approval_reason: string;
  notified: boolean;
}

const ADMIN_TRIGGERS = [
  "payroll", "invoice", "refund", "charge", "purchase", "wire",
  "bank", "credit card", "ssn", "tax", "1099", "w-2",
  "system change", "permission", "admin",
  "dispute", "chargeback", "platform liability",
];

const USER_TRIGGERS = [
  "send email", "reply", "message",
  "book ", "cancel", "subscribe", "unsubscribe",
  "buy", "purchase", "checkout",
  "schedule meeting", "reschedule",
  "post on", "post to", "publish", "tweet",
  "update account", "change password",
];

const MANUAL_TRIGGERS = [
  "phone call", "voicemail", "negotiate", "in person", "in-person",
  "verify identity", "kyc", "dispute", "court", "legal",
  "complex finance", "sensitive personal",
];

export class ApprovalWatchdog {
  /**
   * Walk the task store and apply approval rules to anything that hasn't
   * already been resolved. Returns a list of verdicts so callers can log
   * or surface them.
   */
  static async sweep(): Promise<WatchdogVerdict[]> {
    const tasks = await TaskLifecycleManager.list({
      status: ["pending", "in_progress", "blocked"],
    });
    const verdicts: WatchdogVerdict[] = [];
    for (const task of tasks) {
      // Skip tasks that already have a terminal approval decision.
      if (
        task.approval_status === "approved" ||
        task.approval_status === "rejected"
      ) {
        continue;
      }
      const verdict = await this.evaluate(task);
      verdicts.push(verdict);
    }
    return verdicts;
  }

  /**
   * Evaluate a single task and apply state + notification.
   */
  static async evaluate(task: TaskRecord): Promise<WatchdogVerdict> {
    const decision = this.decide(task);

    let notified = false;
    if (
      decision.approval_status !== "not_required" &&
      decision.approval_status !== "approved"
    ) {
      const action_type = this.actionTypeFor(decision.approval_status);
      const recipient_role: RecipientRole | null =
        decision.approval_role === "admin"
          ? "admin"
          : decision.approval_role === "user"
            ? "user"
            : null;

      if (recipient_role) {
        const created = await ApprovalNotificationService.notify({
          recipient_role,
          recipient_id: recipient_role === "user" ? task.user_id : null,
          task_id: task.id,
          title: this.titleFor(task, decision.approval_status),
          message: decision.approval_reason,
          action_type,
          approval_required:
            decision.approval_status === "user_required" ||
            decision.approval_status === "admin_required",
        });
        notified = !!created;
      }
    }

    // Reflect the verdict on the task record.
    const newStatus =
      decision.approval_status === "approved" ||
      decision.approval_status === "not_required"
        ? task.status
        : "blocked";

    await TaskLifecycleManager.update(
      task.id,
      {
        status: newStatus,
        approval_status: decision.approval_status,
        approval_role: decision.approval_role,
        approval_reason: decision.approval_reason,
        approval_requested_at: task.approval_requested_at || new Date().toISOString(),
      },
      `Watchdog verdict: ${decision.approval_status}`,
    );

    await logRuntimeEvent({
      level: "info",
      source: "server",
      event: "approval.watchdog.verdict",
      detail: `${task.id} -> ${decision.approval_status}`,
      context: {
        task_id: task.id,
        role: decision.approval_role,
        notified,
      },
    });

    return {
      task_id: task.id,
      approval_status: decision.approval_status,
      approval_role: decision.approval_role,
      approval_reason: decision.approval_reason,
      notified,
    };
  }

  /**
   * Pure decision function — useful for tests and for callers that want
   * to evaluate a task without mutating storage.
   */
  static decide(task: TaskRecord): {
    approval_status: ApprovalDecisionStatus;
    approval_role: ApprovalRoleNeed;
    approval_reason: string;
  } {
    const text = [
      task.plan?.summary || "",
      ...(task.plan?.steps || []),
      task.plan?.script || "",
    ]
      .join(" ")
      .toLowerCase();

    const matchesAny = (haystack: string, needles: string[]) =>
      needles.some((n) => haystack.includes(n));

    // Failed/retried tasks should be reviewed by an admin.
    if (task.retries > 0 && task.status === "blocked") {
      return {
        approval_status: "admin_required",
        approval_role: "admin",
        approval_reason:
          "Task is blocked after one or more retries. Admin review is required before further attempts.",
      };
    }

    if (task.plan?.execution_mode === "future_human") {
      return {
        approval_status: "admin_required",
        approval_role: "admin",
        approval_reason:
          "Future-human execution mode requires admin sign-off before the task is queued for human handling.",
      };
    }

    if (matchesAny(text, MANUAL_TRIGGERS)) {
      const role: ApprovalRoleNeed =
        text.includes("complex finance") ||
        text.includes("dispute") ||
        text.includes("legal")
          ? "admin"
          : "user";
      return {
        approval_status: "manual_handling_required",
        approval_role: role,
        approval_reason:
          "This task requires judgment outside of Zed's allowed automated tools and must be handled manually.",
      };
    }

    if (matchesAny(text, ADMIN_TRIGGERS)) {
      return {
        approval_status: "admin_required",
        approval_role: "admin",
        approval_reason:
          "Admin approval is required because the task touches finance, accounts, or platform-level concerns.",
      };
    }

    if (
      matchesAny(text, USER_TRIGGERS) ||
      task.plan?.execution_mode === "digital"
    ) {
      return {
        approval_status: "user_required",
        approval_role: "user",
        approval_reason:
          "User approval is required before any real-world action is performed on the user's behalf.",
      };
    }

    return {
      approval_status: "not_required",
      approval_role: null,
      approval_reason:
        "No approval triggers matched; task may proceed through the normal execution pipeline.",
    };
  }

  private static actionTypeFor(status: ApprovalDecisionStatus): NotificationActionType {
    if (status === "manual_handling_required") return "manual_handle";
    if (status === "rejected") return "review_only";
    if (status === "approved") return "review_only";
    return "approve";
  }

  private static titleFor(task: TaskRecord, status: ApprovalDecisionStatus): string {
    const summary = task.plan?.summary?.slice(0, 80) || "Pending task";
    switch (status) {
      case "manual_handling_required":
        return `Manual handling needed: ${summary}`;
      case "admin_required":
        return `Admin approval needed: ${summary}`;
      case "user_required":
        return `Approval needed: ${summary}`;
      default:
        return summary;
    }
  }
}

export default ApprovalWatchdog;
