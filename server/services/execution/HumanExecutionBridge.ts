/**
 * HumanExecutionBridge
 *
 * Phase 5 of Zed's Execution Layer.
 *
 * Catches tasks where execution_mode === "future_human" so they are
 * not silently dropped. Stores them in a queue file and exposes
 * full lifecycle operations: claim, complete, abandon, requeue.
 *
 * What's still out of scope:
 *   - workforce / agent pool selection (the queue itself is provider-
 *     agnostic — any caller can claim a task)
 *   - automatic dispatch / routing logic
 *
 * Each lifecycle change also emits a runtime event so the alerts /
 * logs surface picks it up.
 */

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { HUB_SHARED_MEMORY_DIR } from "../../utils/repoPaths";
import { logRuntimeEvent } from "../RuntimeLogger";
import type { TaskExecutionPlan } from "./TaskExecutionEngine";

const HUMAN_QUEUE_PATH = path.resolve(
  HUB_SHARED_MEMORY_DIR,
  "execution/human-bridge-queue.json",
);

export interface HumanExecutionRecord {
  id: string;
  task_id: string;
  user_id: string;
  conversation_id?: string | null;
  plan: TaskExecutionPlan;
  stored_at: string;
  status: "queued" | "claimed" | "completed" | "abandoned";
  claimed_by?: string | null;
  notes?: string;
}

interface HumanQueueFile {
  version: string;
  entries: HumanExecutionRecord[];
}

export class HumanExecutionBridge {
  static async store(input: {
    task_id: string;
    user_id: string;
    conversation_id?: string | null;
    plan: TaskExecutionPlan;
    notes?: string;
  }): Promise<HumanExecutionRecord> {
    if (input.plan.execution_mode !== "future_human") {
      throw new Error(
        `HumanExecutionBridge.store called with execution_mode=${input.plan.execution_mode}; expected 'future_human'.`,
      );
    }

    const record: HumanExecutionRecord = {
      id: `human-${randomUUID()}`,
      task_id: input.task_id,
      user_id: input.user_id,
      conversation_id: input.conversation_id ?? null,
      plan: input.plan,
      stored_at: new Date().toISOString(),
      status: "queued",
      claimed_by: null,
      notes: input.notes,
    };

    const queue = await this.read();
    queue.entries.push(record);
    await this.write(queue);

    await logRuntimeEvent({
      level: "info",
      source: "server",
      event: "human.bridge.queued",
      detail: `Stored task ${input.task_id} for future human handling`,
      context: { task_id: input.task_id, user_id: input.user_id },
    });

    return record;
  }

  static async list(filter?: {
    status?: HumanExecutionRecord["status"];
  }): Promise<HumanExecutionRecord[]> {
    const queue = await this.read();
    if (!filter?.status) return queue.entries.slice().reverse();
    return queue.entries.filter((e) => e.status === filter.status).reverse();
  }

  static async get(id: string): Promise<HumanExecutionRecord | null> {
    const queue = await this.read();
    return queue.entries.find((e) => e.id === id) || null;
  }

  /**
   * Mark a queued task as claimed. Refuses if it's already in another
   * state. Returns the updated record or null if the id is unknown.
   */
  static async claim(id: string, claimed_by: string, notes?: string): Promise<HumanExecutionRecord | null> {
    return this.transition(id, "claim", "claimed", claimed_by, notes);
  }

  static async complete(id: string, notes?: string): Promise<HumanExecutionRecord | null> {
    return this.transition(id, "complete", "completed", undefined, notes);
  }

  static async abandon(id: string, notes?: string): Promise<HumanExecutionRecord | null> {
    return this.transition(id, "abandon", "abandoned", undefined, notes);
  }

  /**
   * Move a previously claimed/abandoned task back to 'queued' so a
   * different operator can pick it up.
   */
  static async requeue(id: string, notes?: string): Promise<HumanExecutionRecord | null> {
    return this.transition(id, "requeue", "queued", null, notes);
  }

  private static async transition(
    id: string,
    operation: "claim" | "complete" | "abandon" | "requeue",
    nextStatus: HumanExecutionRecord["status"],
    claimed_by?: string | null,
    notes?: string,
  ): Promise<HumanExecutionRecord | null> {
    const queue = await this.read();
    const idx = queue.entries.findIndex((e) => e.id === id);
    if (idx < 0) return null;

    const current = queue.entries[idx];
    const allowed: Record<HumanExecutionRecord["status"], HumanExecutionRecord["status"][]> = {
      queued: ["claimed", "abandoned"],
      claimed: ["completed", "abandoned", "queued"],
      completed: [],
      abandoned: ["queued"],
    };
    if (!allowed[current.status].includes(nextStatus)) {
      throw new Error(
        `Cannot ${operation} a record currently in '${current.status}' state.`,
      );
    }

    const updated: HumanExecutionRecord = {
      ...current,
      status: nextStatus,
      claimed_by:
        nextStatus === "claimed"
          ? claimed_by ?? null
          : nextStatus === "queued"
            ? null
            : current.claimed_by ?? null,
      notes: notes ?? current.notes,
    };
    queue.entries[idx] = updated;
    await this.write(queue);

    await logRuntimeEvent({
      level: "info",
      source: "server",
      event: `human.bridge.${operation}`,
      detail: `Task ${current.task_id} -> ${nextStatus}`,
      context: { id: current.id, task_id: current.task_id, claimed_by: updated.claimed_by },
    });

    return updated;
  }

  private static async read(): Promise<HumanQueueFile> {
    try {
      const raw = await fs.readFile(HUMAN_QUEUE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.entries)) return parsed as HumanQueueFile;
    } catch {}
    return { version: "1.0", entries: [] };
  }

  private static async write(queue: HumanQueueFile): Promise<void> {
    try {
      await fs.mkdir(path.dirname(HUMAN_QUEUE_PATH), { recursive: true });
      await fs.writeFile(HUMAN_QUEUE_PATH, JSON.stringify(queue, null, 2), "utf-8");
    } catch (err) {
      console.warn("[HumanExecutionBridge] Failed to persist queue:", err);
    }
  }
}

export default HumanExecutionBridge;
