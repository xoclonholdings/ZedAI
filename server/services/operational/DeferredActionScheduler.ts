/**
 * DeferredActionScheduler
 *
 * Persists future-oriented operations: reminders, retries, status checks,
 * approval re-checks, manual reviews. Other services (especially
 * AutonomousFollowUpEngine) read from here and act on entries whose
 * scheduled_for time has elapsed.
 *
 * Constraints:
 *   - Storage only: this scheduler does not start its own timer loop.
 *     Callers (or a small ticker added at integration time) call
 *     `dueNow()` to retrieve and process due entries.
 *   - Integrates cleanly with TaskLifecycleManager and ApprovalWatchdog
 *     (it just records what to revisit; it does not itself act).
 */

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { HUB_SHARED_MEMORY_DIR } from "../../utils/repoPaths";

const SCHEDULER_PATH = path.resolve(
  HUB_SHARED_MEMORY_DIR,
  "operational/deferred-actions.json",
);

export type DeferredKind =
  | "reminder"
  | "retry"
  | "status_check"
  | "approval_check"
  | "manual_review";

export interface DeferredAction {
  id: string;
  task_id: string | null;
  kind: DeferredKind;
  scheduled_for: string;
  created_at: string;
  completed: boolean;
  cancelled: boolean;
  notes?: string;
  metadata?: Record<string, unknown>;
}

interface SchedulerFile {
  version: string;
  actions: DeferredAction[];
}

export interface ScheduleInput {
  task_id?: string | null;
  kind: DeferredKind;
  scheduled_for: string | Date | number; // ms-from-now also accepted via number
  notes?: string;
  metadata?: Record<string, unknown>;
}

export class DeferredActionScheduler {
  static async schedule(input: ScheduleInput): Promise<DeferredAction> {
    const file = await this.read();
    const action: DeferredAction = {
      id: `defer-${randomUUID()}`,
      task_id: input.task_id ?? null,
      kind: input.kind,
      scheduled_for: this.normalizeWhen(input.scheduled_for),
      created_at: new Date().toISOString(),
      completed: false,
      cancelled: false,
      notes: input.notes,
      metadata: input.metadata,
    };
    file.actions.push(action);
    await this.write(file);
    return action;
  }

  static async cancel(id: string): Promise<boolean> {
    const file = await this.read();
    const idx = file.actions.findIndex((a) => a.id === id);
    if (idx < 0) return false;
    file.actions[idx].cancelled = true;
    await this.write(file);
    return true;
  }

  static async reschedule(id: string, new_when: string | Date | number): Promise<DeferredAction | null> {
    const file = await this.read();
    const idx = file.actions.findIndex((a) => a.id === id);
    if (idx < 0) return null;
    file.actions[idx].scheduled_for = this.normalizeWhen(new_when);
    file.actions[idx].cancelled = false;
    file.actions[idx].completed = false;
    await this.write(file);
    return file.actions[idx];
  }

  static async markComplete(id: string, notes?: string): Promise<DeferredAction | null> {
    const file = await this.read();
    const idx = file.actions.findIndex((a) => a.id === id);
    if (idx < 0) return null;
    file.actions[idx].completed = true;
    if (notes) file.actions[idx].notes = notes;
    await this.write(file);
    return file.actions[idx];
  }

  static async dueNow(now: Date = new Date()): Promise<DeferredAction[]> {
    const file = await this.read();
    return file.actions.filter(
      (a) =>
        !a.completed &&
        !a.cancelled &&
        new Date(a.scheduled_for).getTime() <= now.getTime(),
    );
  }

  static async list(filter?: {
    task_id?: string;
    kind?: DeferredKind;
    include_completed?: boolean;
  }): Promise<DeferredAction[]> {
    const file = await this.read();
    let items = file.actions.slice();
    if (filter?.task_id) items = items.filter((a) => a.task_id === filter.task_id);
    if (filter?.kind) items = items.filter((a) => a.kind === filter.kind);
    if (!filter?.include_completed) items = items.filter((a) => !a.completed && !a.cancelled);
    return items.sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for));
  }

  private static normalizeWhen(when: string | Date | number): string {
    if (typeof when === "number") {
      return new Date(Date.now() + when).toISOString();
    }
    if (when instanceof Date) return when.toISOString();
    return new Date(when).toISOString();
  }

  private static async read(): Promise<SchedulerFile> {
    try {
      const raw = await fs.readFile(SCHEDULER_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.actions)) return parsed as SchedulerFile;
    } catch {}
    return { version: "1.0", actions: [] };
  }

  private static async write(file: SchedulerFile): Promise<void> {
    try {
      await fs.mkdir(path.dirname(SCHEDULER_PATH), { recursive: true });
      await fs.writeFile(SCHEDULER_PATH, JSON.stringify(file, null, 2), "utf-8");
    } catch (err) {
      console.warn("[DeferredActionScheduler] Persistence failed:", err);
    }
  }
}

export default DeferredActionScheduler;
