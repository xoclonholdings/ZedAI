/**
 * ExecutionApprovalHandler
 *
 * Phase 2 of Zed's Execution Layer.
 *
 * Purpose:
 *   Take a TaskExecutionPlan from TaskExecutionEngine, present
 *   summary + steps + script to the caller, and require explicit user
 *   approval before any downstream service is allowed to act.
 *
 * Constraints:
 *   - This handler does NOT execute anything itself.
 *   - It only formats the plan, records the approval state, and
 *     returns the approval decision to the caller.
 */

import fs from "fs/promises";
import path from "path";
import { HUB_SHARED_MEMORY_DIR } from "../../utils/repoPaths";
import type { TaskExecutionPlan } from "./TaskExecutionEngine";
import { logRuntimeEvent } from "../RuntimeLogger";

const APPROVAL_LOG_PATH = path.resolve(
  HUB_SHARED_MEMORY_DIR,
  "execution/execution-approvals.json",
);

export interface ExecutionApprovalRequest {
  task_id: string;
  user_id: string;
  plan: TaskExecutionPlan;
  approved: boolean;
  approver_role?: "user" | "admin" | "system";
  notes?: string;
}

export interface ExecutionApprovalResult {
  approved: boolean;
  execution_mode: TaskExecutionPlan["execution_mode"];
  task_id: string;
  recorded_at: string;
}

export interface ExecutionApprovalPresentation {
  task_id: string;
  summary: string;
  steps: string[];
  script: string;
  required_info: string[];
  decision_points: TaskExecutionPlan["decision_points"];
  execution_mode: TaskExecutionPlan["execution_mode"];
  awaiting_approval: true;
}

interface ApprovalRecord {
  task_id: string;
  user_id: string;
  approved: boolean;
  approver_role?: string;
  notes?: string;
  execution_mode: TaskExecutionPlan["execution_mode"];
  recorded_at: string;
  plan_summary: string;
}

interface ApprovalLog {
  version: string;
  entries: ApprovalRecord[];
}

export class ExecutionApprovalHandler {
  /**
   * Build the user-facing presentation of the plan that callers should
   * surface in an approval dialog. This DOES NOT touch the UI directly.
   */
  static present(task_id: string, plan: TaskExecutionPlan): ExecutionApprovalPresentation {
    return {
      task_id,
      summary: plan.summary,
      steps: plan.steps,
      script: plan.script,
      required_info: plan.required_info,
      decision_points: plan.decision_points,
      execution_mode: plan.execution_mode,
      awaiting_approval: true,
    };
  }

  /**
   * Record an explicit approval decision (approve OR reject).
   * Returns a typed decision object the caller can act on.
   */
  static async record(request: ExecutionApprovalRequest): Promise<ExecutionApprovalResult> {
    const recorded_at = new Date().toISOString();

    const record: ApprovalRecord = {
      task_id: request.task_id,
      user_id: request.user_id,
      approved: !!request.approved,
      approver_role: request.approver_role || "user",
      notes: request.notes,
      execution_mode: request.plan.execution_mode,
      recorded_at,
      plan_summary: request.plan.summary,
    };

    await this.appendApproval(record);

    await logRuntimeEvent({
      level: "info",
      source: "server",
      event: "execution.approval.recorded",
      detail: `task ${record.task_id} approved=${record.approved}`,
      context: {
        task_id: record.task_id,
        approver_role: record.approver_role,
        execution_mode: record.execution_mode,
      },
    });

    return {
      approved: record.approved,
      execution_mode: record.execution_mode,
      task_id: record.task_id,
      recorded_at,
    };
  }

  static async listRecent(limit = 50): Promise<ApprovalRecord[]> {
    const log = await this.readLog();
    return log.entries.slice(-limit).reverse();
  }

  private static async appendApproval(record: ApprovalRecord): Promise<void> {
    const log = await this.readLog();
    log.entries.push(record);
    await this.writeLog(log);
  }

  private static async readLog(): Promise<ApprovalLog> {
    try {
      const raw = await fs.readFile(APPROVAL_LOG_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.entries)) return parsed as ApprovalLog;
    } catch {}
    return { version: "1.0", entries: [] };
  }

  private static async writeLog(log: ApprovalLog): Promise<void> {
    try {
      await fs.mkdir(path.dirname(APPROVAL_LOG_PATH), { recursive: true });
      await fs.writeFile(APPROVAL_LOG_PATH, JSON.stringify(log, null, 2), "utf-8");
    } catch (err) {
      console.warn("[ExecutionApprovalHandler] Failed to write approval log:", err);
    }
  }
}

export default ExecutionApprovalHandler;
