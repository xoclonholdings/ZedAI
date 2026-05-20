import type { TaskRecord } from "../../execution/TaskLifecycleManager";
import {
  ToolOrchestrationEngine,
  type OrchestrationResult,
  type ToolStep,
  type ToolType,
} from "../../operational/ToolOrchestrationEngine";

import type { NormalizedCommand } from "./types";

/**
 * Build a non-executing orchestration preview so the caller can
 * render "here's what would happen if you approve". The steps are
 * derived from the task's execution_mode:
 *
 *   digital       → email if an email entity was found, otherwise api
 *   future_human  → notification queued for admin review
 *   default       → notification surfaced to the user for manual run
 *
 * Even when no approval is pending, this never executes — we always
 * pass `approved: false` so the orchestration engine returns the
 * preview shape without touching any external system.
 */
export async function buildOrchestrationPreview(
  task: TaskRecord,
  normalized: NormalizedCommand,
): Promise<OrchestrationResult> {
  const steps: ToolStep[] = [];

  if (task.plan.execution_mode === "digital") {
    const tool: ToolType = normalized.extracted_entities.email ? "email" : "api";
    steps.push({
      tool,
      description: `Prepare ${tool} action from prepared script`,
      requires_approval: true,
    });
  } else if (task.plan.execution_mode === "future_human") {
    steps.push({
      tool: "notification",
      description: "Notify admin queue that a future-human task is pending",
      requires_approval: true,
    });
  } else {
    steps.push({
      tool: "notification",
      description: "Surface the prepared script to the user for manual execution",
      requires_approval: false,
    });
  }

  // Approval not yet granted → orchestration must pause. (The
  // non-approval branch below also passes approved: false because
  // intake should NEVER execute as a side effect — only the
  // /api/operational/orchestrate endpoint does that, gated by an
  // explicit caller-supplied `approved` flag.)
  if (
    task.approval_status === "admin_required" ||
    task.approval_status === "user_required" ||
    task.approval_status === "manual_handling_required"
  ) {
    return ToolOrchestrationEngine.run({
      task_id: task.id,
      user_id: task.user_id,
      steps,
      approved: false,
    });
  }

  return ToolOrchestrationEngine.run({
    task_id: task.id,
    user_id: task.user_id,
    steps,
    approved: false,
  });
}
