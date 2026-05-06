/**
 * OmnichannelMemoryService
 *
 * Maintains a unified, append-only memory log across channels (chat,
 * email, SMS, future voice and external messaging). Each interaction
 * is stored with a structured payload and is task-linked when known.
 *
 * Persistence mirrors the project's existing JSON-on-disk approach
 * under hub/shared-memory/operational/omnichannel-memory.json so this
 * service drops in without requiring DB migrations.
 */

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { HUB_SHARED_MEMORY_DIR } from "../../utils/repoPaths";

const MEMORY_PATH = path.resolve(
  HUB_SHARED_MEMORY_DIR,
  "operational/omnichannel-memory.json",
);

export type Channel =
  | "chat"
  | "email"
  | "sms"
  | "voice"
  | "external"
  | "system";

export interface MemoryParticipant {
  id?: string;
  display_name: string;
  role?: "user" | "agent" | "third_party";
}

export interface OmnichannelMemoryEntry {
  interaction_id: string;
  channel: Channel;
  timestamp: string;
  summary: string;
  related_task_id?: string | null;
  participants: MemoryParticipant[];
  action_taken?: string | null;
  user_id?: string | null;
}

interface MemoryFile {
  version: string;
  entries: OmnichannelMemoryEntry[];
}

export interface AppendInput {
  channel: Channel;
  summary: string;
  participants: MemoryParticipant[];
  related_task_id?: string | null;
  action_taken?: string | null;
  user_id?: string | null;
}

export class OmnichannelMemoryService {
  static async append(input: AppendInput): Promise<OmnichannelMemoryEntry> {
    const entry: OmnichannelMemoryEntry = {
      interaction_id: `mem-${randomUUID()}`,
      channel: input.channel,
      timestamp: new Date().toISOString(),
      summary: input.summary,
      related_task_id: input.related_task_id ?? null,
      participants: input.participants,
      action_taken: input.action_taken ?? null,
      user_id: input.user_id ?? null,
    };
    const file = await this.read();
    file.entries.push(entry);
    await this.write(file);
    return entry;
  }

  /**
   * Search memory by free-text query, channel, related task, or user.
   * Returns most-recent-first.
   */
  static async search(query: {
    text?: string;
    channel?: Channel;
    related_task_id?: string;
    user_id?: string;
    limit?: number;
  }): Promise<OmnichannelMemoryEntry[]> {
    const file = await this.read();
    const limit = query.limit || 100;
    const lower = query.text?.toLowerCase();

    const matched = file.entries.filter((e) => {
      if (query.channel && e.channel !== query.channel) return false;
      if (query.related_task_id && e.related_task_id !== query.related_task_id) return false;
      if (query.user_id && e.user_id !== query.user_id) return false;
      if (lower) {
        const hay =
          `${e.summary} ${e.action_taken || ""} ${e.participants.map((p) => p.display_name).join(" ")}`.toLowerCase();
        if (!hay.includes(lower)) return false;
      }
      return true;
    });

    return matched.slice(-limit).reverse();
  }

  static async forTask(task_id: string, limit = 50): Promise<OmnichannelMemoryEntry[]> {
    return this.search({ related_task_id: task_id, limit });
  }

  private static async read(): Promise<MemoryFile> {
    try {
      const raw = await fs.readFile(MEMORY_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.entries)) return parsed as MemoryFile;
    } catch {}
    return { version: "1.0", entries: [] };
  }

  private static async write(file: MemoryFile): Promise<void> {
    try {
      await fs.mkdir(path.dirname(MEMORY_PATH), { recursive: true });
      await fs.writeFile(MEMORY_PATH, JSON.stringify(file, null, 2), "utf-8");
    } catch (err) {
      console.warn("[OmnichannelMemoryService] Persistence failed:", err);
    }
  }
}

export default OmnichannelMemoryService;
