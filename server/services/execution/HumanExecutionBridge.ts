/**
 * HumanExecutionBridge
 *
 * Phase 5 of Zed's Execution Layer — STUB ONLY.
 *
 * Purpose:
 *   Catches tasks where execution_mode === "future_human" so they are not
 *   silently dropped. Persists them in a queue file that a future workforce
 *   / routing system can consume.
 *
 * INTENTIONALLY NOT IMPLEMENTED:
 *   - workforce / agent pool
 *   - routing / dispatch logic
 *   - any user interface
 *
 * Keep this file small and additive. It only writes to a file and reads
 * from it. Anything more is out of scope for Phase 5.
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
