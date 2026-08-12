/**
 * TaskLifecycleManager
 *
 * Phase 4 of ZAR's Execution Layer.
 *
 * Tracks the full life of an execution task:
 *
 *   pending -> approved -> in_progress -> complete
 *                |             |
 *                +-> blocked   +-> blocked (retryable)
 *
 * The store is a JSON file under hub/shared-memory/execution/tasks.json.
 * That intentionally mirrors how the existing approval queue is persisted,
 * so this service slots into the running architecture without a new DB.
 *
 * The manager NEVER executes external work itself. It is the source of
 * truth for task state, retries, ownership, and logs.
 */

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { HUB_SHARED_MEMORY_DIR } from "../../utils/repoPaths";
import { logRuntimeEvent } from "../RuntimeLogger";
import type { TaskExecutionPlan } from "./TaskExecutionEngine";
import { assertOwnerContext, type OwnerContext } from "../auth/OwnerContext";

const TASK_STORE_PATH = path.resolve(
  HUB_SHARED_MEMORY_DIR,
  "execution/tasks.json",
);

export type TaskStatus =
  | "pending"
  | "approved"
  | "in_progress"
  | "blocked"
  | "complete";

export interface TaskLogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  context?: Record<string, unknown>;
}

export interface TaskRecord {
  id: string;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  retries: number;
  logs: TaskLogEntry[];

  user_id: string;
  conversation_id?: string | null;
  plan: TaskExecutionPlan;

  /** Approval bookkeeping written by ApprovalWatchdog / ApprovalDecisionHandler */
  approval_status?:
    | "not_required"
    | "user_required"
    | "admin_required"
    | "approved"
    | "rejected"
    | "manual_handling_required";
  approval_role?: "user" | "admin" | "system" | null;
  approval_reason?: string;
  approval_requested_at?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;

  /** Any final or intermediate result data the executor returned. */
  last_result?: Record<string, unknown> | null;

  /** User-facing shared to-do metadata. */
  origin?: "user" | "zar";
  assignee?: "user" | "zar" | "both";
  scheduled_for?: string | null;
  acceptance_status?: "proposed" | "accepted" | "denied";
}

export interface CreateTaskInput {
  user_id: string;
  conversation_id?: string | null;
  plan: TaskExecutionPlan;
  initial_status?: TaskStatus;
  origin?: TaskRecord["origin"];
  assignee?: TaskRecord["assignee"];
  scheduled_for?: string | null;
  acceptance_status?: TaskRecord["acceptance_status"];
}

export interface TaskUpdateInput {
  status?: TaskStatus;
  approval_status?: TaskRecord["approval_status"];
  approval_role?: TaskRecord["approval_role"];
  approval_reason?: string;
  approval_requested_at?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  last_result?: Record<string, unknown> | null;
  acceptance_status?: TaskRecord["acceptance_status"];
}

interface TaskStoreFile {
  version: string;
  tasks: TaskRecord[];
}

export class TaskLifecycleManager {
  static async create(input: CreateTaskInput): Promise<TaskRecord> {
    const now = new Date().toISOString();
    const record: TaskRecord = {
      id: `task-${randomUUID()}`,
      status: input.initial_status || "pending",
      created_at: now,
      updated_at: now,
      retries: 0,
      logs: [
        {
          timestamp: now,
          level: "info",
          message: "Task created from execution plan",
          context: { execution_mode: input.plan.execution_mode, task_type: input.plan.task_type },
        },
      ],
      user_id: input.user_id,
      conversation_id: input.conversation_id ?? null,
      plan: input.plan,
      approval_status: "not_required",
      approval_role: null,
      approval_reason: undefined,
      approval_requested_at: null,
      approved_at: null,
      approved_by: null,
      last_result: null,
      origin: input.origin ?? "user",
      assignee: input.assignee ?? "user",
      scheduled_for: input.scheduled_for ?? null,
      acceptance_status: input.acceptance_status ?? "accepted",
    };

    const store = await this.read();
    store.tasks.push(record);
    await this.write(store);

    await logRuntimeEvent({
      level: "info",
      source: "server",
      event: "task.lifecycle.created",
      detail: `Task ${record.id} created`,
      context: { task_id: record.id, user_id: record.user_id },
    });

    return record;
  }

  static async get(task_id: string): Promise<TaskRecord | null> {
    const store = await this.read();
    return store.tasks.find((t) => t.id === task_id) || null;
  }

  static belongsToOwner(task: TaskRecord, owner: OwnerContext): boolean {
    assertOwnerContext(owner);
    return task.user_id === owner.ownerUserId;
  }

  static async getForOwner(
    task_id: string,
    owner: OwnerContext,
  ): Promise<TaskRecord | null> {
    const task = await this.get(task_id);
    return task && this.belongsToOwner(task, owner) ? task : null;
  }

  static async list(filter?: {
    status?: TaskStatus | TaskStatus[];
    user_id?: string;
  }): Promise<TaskRecord[]> {
    const store = await this.read();
    let tasks = store.tasks;
    if (filter?.user_id) tasks = tasks.filter((t) => t.user_id === filter.user_id);
    if (filter?.status) {
      const wanted = Array.isArray(filter.status) ? filter.status : [filter.status];
      tasks = tasks.filter((t) => wanted.includes(t.status));
    }
    return tasks.slice().reverse();
  }

  static async listForOwner(
    owner: OwnerContext,
    filter?: { status?: TaskStatus | TaskStatus[] },
  ): Promise<TaskRecord[]> {
    assertOwnerContext(owner);
    return this.list({ ...filter, user_id: owner.ownerUserId });
  }

  static async update(task_id: string, patch: TaskUpdateInput, log_message?: string): Promise<TaskRecord | null> {
    const store = await this.read();
    const idx = store.tasks.findIndex((t) => t.id === task_id);
    if (idx < 0) return null;

    const now = new Date().toISOString();
    const existing = store.tasks[idx];
    const updated: TaskRecord = {
      ...existing,
      ...patch,
      updated_at: now,
      logs: existing.logs.concat([
        {
          timestamp: now,
          level: "info",
          message: log_message || `Task updated: ${Object.keys(patch).join(", ")}`,
          context: { patch },
        },
      ]),
    };
    store.tasks[idx] = updated;
    await this.write(store);

    await logRuntimeEvent({
      level: "info",
      source: "server",
      event: "task.lifecycle.updated",
      detail: log_message || `Task ${task_id} updated`,
      context: { task_id, patch },
    });

    // Fire admin alerts on terminal/blocking transitions.
    if (existing.status !== "complete" && updated.status === "complete") {
      void this.alertCompleted(updated);
    }
    if (existing.status !== "blocked" && updated.status === "blocked") {
      void this.alertBlocked(updated, log_message || patch.approval_reason || "Task moved to blocked");
    }

    return updated;
  }

  private static async alertCompleted(task: TaskRecord): Promise<void> {
    try {
      const { AdminAlertSender } = await import("../auth/AdminAlertSender");
      await AdminAlertSender.sendTaskCompleted({ task, result: task.last_result });
    } catch (err) {
      console.warn("[TaskLifecycleManager] Completion alert failed:", err);
    }
  }

  private static async alertBlocked(task: TaskRecord, reason: string): Promise<void> {
    try {
      const { AdminAlertSender } = await import("../auth/AdminAlertSender");
      await AdminAlertSender.sendTaskBlocked({ task, reason });
    } catch (err) {
      console.warn("[TaskLifecycleManager] Blocked alert failed:", err);
    }
  }

  static async appendLog(
    task_id: string,
    level: TaskLogEntry["level"],
    message: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const store = await this.read();
    const idx = store.tasks.findIndex((t) => t.id === task_id);
    if (idx < 0) return;
    const now = new Date().toISOString();
    store.tasks[idx].logs.push({ timestamp: now, level, message, context });
    store.tasks[idx].updated_at = now;
    await this.write(store);
  }

  /**
   * Increment retry counter. Returns the updated record or null if the task
   * has already exceeded the soft retry ceiling and should be left blocked
   * for manual handling.
   */
  static async retry(task_id: string, max_retries = 3): Promise<TaskRecord | null> {
    const record = await this.get(task_id);
    if (!record) return null;

    const next = record.retries + 1;
    if (next > max_retries) {
      await this.update(
        task_id,
        { status: "blocked", approval_status: "manual_handling_required" },
        `Retry limit (${max_retries}) reached; marking blocked for manual handling`,
      );
      return null;
    }

    const store = await this.read();
    const idx = store.tasks.findIndex((t) => t.id === task_id);
    if (idx < 0) return null;

    const now = new Date().toISOString();
    store.tasks[idx].retries = next;
    store.tasks[idx].updated_at = now;
    store.tasks[idx].status = "in_progress";
    store.tasks[idx].logs.push({
      timestamp: now,
      level: "info",
      message: `Retry attempt ${next}/${max_retries}`,
    });
    await this.write(store);
    return store.tasks[idx];
  }

  private static async read(): Promise<TaskStoreFile> {
    try {
      const raw = await fs.readFile(TASK_STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.tasks)) return parsed as TaskStoreFile;
    } catch {}
    return { version: "1.0", tasks: [] };
  }

  private static async write(store: TaskStoreFile): Promise<void> {
    try {
      await fs.mkdir(path.dirname(TASK_STORE_PATH), { recursive: true });
      await fs.writeFile(TASK_STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
    } catch (err) {
      console.warn("[TaskLifecycleManager] Failed to persist task store:", err);
    }
  }
}

export default TaskLifecycleManager;
