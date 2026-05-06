/**
 * ExecutionPipeline
 *
 * Thin facade that ties Phases 1-5 together so the rest of the codebase
 * can adopt the execution layer with a single import.
 *
 * Intentionally additive — does not change any existing module.
 *
 *   1. prepare()   -> TaskExecutionEngine.prepare + TaskLifecycleManager.create
 *   2. approve()   -> ExecutionApprovalHandler.record + lifecycle update
 *   3. dispatch()  -> route to DigitalExecutionService or HumanExecutionBridge
 *
 * No real-world side effects happen until dispatch() is called and only
 * after approve() returns approved === true.
 */

import {
  TaskExecutionEngine,
  type TaskExecutionInput,
  type TaskExecutionPlan,
} from "./TaskExecutionEngine";
import {
  ExecutionApprovalHandler,
  type ExecutionApprovalPresentation,
} from "./ExecutionApprovalHandler";
import {
  DigitalExecutionService,
  type DigitalActionType,
  type DigitalExecutionResult,
  type DigitalPayload,
} from "./DigitalExecutionService";
import { HumanExecutionBridge, type HumanExecutionRecord } from "./HumanExecutionBridge";
import {
  TaskLifecycleManager,
  type TaskRecord,
} from "./TaskLifecycleManager";

export interface PreparedExecution {
  task: TaskRecord;
  plan: TaskExecutionPlan;
  approval: ExecutionApprovalPresentation;
}

export interface ApproveExecutionInput {
  task_id: string;
  user_id: string;
  approved: boolean;
  approver_role?: "user" | "admin" | "system";
  notes?: string;
}

export interface DispatchInput {
  task_id: string;
  action_type?: DigitalActionType;
  payload?: DigitalPayload;
  notes?: string;
}

export interface DispatchResult {
  routed_to: "digital" | "human" | "manual";
  digital_result?: DigitalExecutionResult;
  human_record?: HumanExecutionRecord;
  task: TaskRecord | null;
}

export class ExecutionPipeline {
  static async prepare(
    user_id: string,
    input: TaskExecutionInput,
    conversation_id?: string | null,
  ): Promise<PreparedExecution> {
    const plan = TaskExecutionEngine.prepare(input);
    const task = await TaskLifecycleManager.create({
      user_id,
      conversation_id,
      plan,
    });
    const approval = ExecutionApprovalHandler.present(task.id, plan);
    return { task, plan, approval };
  }

  static async approve(input: ApproveExecutionInput): Promise<{
    approved: boolean;
    task: TaskRecord | null;
  }> {
    const task = await TaskLifecycleManager.get(input.task_id);
    if (!task) return { approved: false, task: null };

    const result = await ExecutionApprovalHandler.record({
      task_id: task.id,
      user_id: input.user_id,
      plan: task.plan,
      approved: input.approved,
      approver_role: input.approver_role,
      notes: input.notes,
    });

    const updated = await TaskLifecycleManager.update(
      task.id,
      {
        status: result.approved ? "approved" : "blocked",
        approval_status: result.approved ? "approved" : "rejected",
        approval_role: input.approver_role || "user",
        approval_reason: input.notes,
        approval_requested_at: task.approval_requested_at || new Date().toISOString(),
        approved_at: result.approved ? result.recorded_at : null,
        approved_by: input.user_id,
      },
      result.approved ? "Approval granted" : "Approval rejected",
    );

    return { approved: result.approved, task: updated };
  }

  static async dispatch(input: DispatchInput): Promise<DispatchResult> {
    const task = await TaskLifecycleManager.get(input.task_id);
    if (!task) return { routed_to: "manual", task: null };

    if (task.status !== "approved") {
      await TaskLifecycleManager.appendLog(
        task.id,
        "warn",
        `Dispatch refused: task status is ${task.status}, expected 'approved'.`,
      );
      return { routed_to: "manual", task };
    }

    if (task.plan.execution_mode === "digital") {
      if (!input.action_type || !input.payload) {
        await TaskLifecycleManager.appendLog(
          task.id,
          "warn",
          "Dispatch missing action_type or payload for digital execution.",
        );
        return { routed_to: "manual", task };
      }
      const digital_result = await DigitalExecutionService.execute({
        task_id: task.id,
        user_id: task.user_id,
        approved: true,
        execution_mode: task.plan.execution_mode,
        action_type: input.action_type,
        payload: input.payload,
        reason: input.notes,
      });

      const updated = await TaskLifecycleManager.update(
        task.id,
        {
          status: digital_result.status === "success" ? "complete" : "blocked",
          last_result: { ...digital_result },
        },
        `Digital dispatch ${digital_result.status}`,
      );

      return { routed_to: "digital", digital_result, task: updated };
    }

    if (task.plan.execution_mode === "future_human") {
      const human_record = await HumanExecutionBridge.store({
        task_id: task.id,
        user_id: task.user_id,
        conversation_id: task.conversation_id ?? null,
        plan: task.plan,
        notes: input.notes,
      });
      const updated = await TaskLifecycleManager.update(
        task.id,
        {
          status: "blocked",
          approval_status: "manual_handling_required",
          last_result: { stored_human_record_id: human_record.id },
        },
        "Stored for future human handling",
      );
      return { routed_to: "human", human_record, task: updated };
    }

    // Manual mode: nothing to dispatch — task remains for the user.
    await TaskLifecycleManager.appendLog(
      task.id,
      "info",
      "Manual execution mode; user must complete the task using the prepared script.",
    );
    return { routed_to: "manual", task };
  }
}

export default ExecutionPipeline;
