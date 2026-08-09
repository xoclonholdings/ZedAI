/**
 * ToolOrchestrationEngine
 *
 * Coordinates multiple internal/external tools across a single task
 * execution. Each step describes a tool the engine knows how to invoke
 * and whether it requires approval. Stops cleanly when approval is
 * required, allowing partial completion states.
 *
 * Constraints:
 *   - Logs every tool action.
 *   - Stops execution at the first step that requires approval (does
 *     NOT bypass the approval system).
 *   - Allows partial completion: returns what completed and what is
 *     pending so the caller can resume after approval.
 */

import { randomUUID } from "crypto";
import { logRuntimeEvent } from "../RuntimeLogger";
import { DigitalExecutionService, type DigitalActionType, type DigitalPayload } from "../execution/DigitalExecutionService";
import { TaskLifecycleManager } from "../execution/TaskLifecycleManager";
import { createOwnerContext } from "../auth/OwnerContext";

export type ToolType =
  | "email"
  | "calendar"
  | "notification"
  | "api"
  | "voice"
  | "messaging"
  | "finance";

export interface ToolStep {
  step_id?: string;
  tool: ToolType;
  description: string;
  requires_approval?: boolean;
  /** Optional concrete payload for tools that DigitalExecutionService can run. */
  digital?: {
    action_type: DigitalActionType;
    payload: DigitalPayload;
  };
}

export interface OrchestrationInput {
  task_id: string;
  user_id: string;
  steps: ToolStep[];
  /** True if the upstream caller has already secured approval. */
  approved: boolean;
}

export interface OrchestrationStepResult {
  step_id: string;
  tool: ToolType;
  description: string;
  status: "completed" | "skipped_pending_approval" | "stub" | "failed";
  detail: string;
}

export interface OrchestrationResult {
  orchestration_id: string;
  tools_used: ToolType[];
  execution_steps: OrchestrationStepResult[];
  approval_required: boolean;
  status: "complete" | "blocked_pending_approval" | "failed" | "partial";
}

export class ToolOrchestrationEngine {
  static async run(input: OrchestrationInput): Promise<OrchestrationResult> {
    const owner = createOwnerContext(input.user_id);
    const task = await TaskLifecycleManager.getForOwner(input.task_id, owner);
    if (!task) throw new Error("Task not found");
    const verifiedInput: OrchestrationInput = {
      ...input,
      approved: task.status === "approved" && task.approval_status === "approved",
    };
    const orchestration_id = `orch-${randomUUID()}`;
    const execution_steps: OrchestrationStepResult[] = [];
    const tools_used = new Set<ToolType>();
    let approval_required = false;
    let failed = false;

    for (const step of verifiedInput.steps) {
      const step_id = step.step_id || `step-${randomUUID()}`;
      tools_used.add(step.tool);

      if (step.requires_approval && !verifiedInput.approved) {
        execution_steps.push({
          step_id,
          tool: step.tool,
          description: step.description,
          status: "skipped_pending_approval",
          detail: "Step requires approval; orchestration paused.",
        });
        approval_required = true;
        await logRuntimeEvent({
          level: "info",
          source: "server",
          event: "orchestration.paused",
          detail: `Step ${step_id} requires approval`,
          context: { orchestration_id, task_id: input.task_id },
        });
        break;
      }

      try {
        const result = await this.runStep(verifiedInput, step);
        execution_steps.push({
          step_id,
          tool: step.tool,
          description: step.description,
          status: result.status,
          detail: result.detail,
        });
        if (result.status === "failed") {
          failed = true;
          break;
        }
      } catch (err: any) {
        execution_steps.push({
          step_id,
          tool: step.tool,
          description: step.description,
          status: "failed",
          detail: err?.message || "unknown failure",
        });
        failed = true;
        break;
      }
    }

    const status: OrchestrationResult["status"] = failed
      ? "failed"
      : approval_required
        ? "blocked_pending_approval"
        : execution_steps.length === verifiedInput.steps.length
          ? "complete"
          : "partial";

    await logRuntimeEvent({
      level: failed ? "warn" : "info",
      source: "server",
      event: "orchestration.run",
      detail: `Orchestration ${orchestration_id} -> ${status}`,
      context: {
        orchestration_id,
        task_id: input.task_id,
        tools: Array.from(tools_used),
      },
    });

    return {
      orchestration_id,
      tools_used: Array.from(tools_used),
      execution_steps,
      approval_required,
      status,
    };
  }

  private static async runStep(
    input: OrchestrationInput,
    step: ToolStep,
  ): Promise<{ status: OrchestrationStepResult["status"]; detail: string }> {
    if (step.tool === "email" || step.tool === "api") {
      if (!step.digital) {
        return { status: "stub", detail: "No digital payload supplied; treated as stub." };
      }
      const result = await DigitalExecutionService.execute({
        task_id: input.task_id,
        user_id: input.user_id,
        approved: input.approved,
        execution_mode: "digital",
        action_type: step.digital.action_type,
        payload: step.digital.payload,
      });
      return {
        status: result.status === "success" ? "completed" : "failed",
        detail: result.result,
      };
    }

    // Tools that are not yet wired return a stub so the orchestration can
    // still complete a "preview" run.
    return {
      status: "stub",
      detail: `Tool '${step.tool}' is not yet implemented; recorded as stub.`,
    };
  }
}

export default ToolOrchestrationEngine;
