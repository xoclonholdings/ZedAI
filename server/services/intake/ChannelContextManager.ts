/**
 * ChannelContextManager
 *
 * Tracks interaction history and state for a user across channels so a
 * task that starts in app_chat, continues by email, gets approved on
 * WhatsApp and completes in-app remains a single conversation thread.
 *
 * Persistence:
 *   hub/shared-memory/intake/channel-contexts.json
 *
 * Constraints:
 *   - Append-only history; the active_channel pointer can move.
 *   - Service-level only; no UI is created or modified.
 *   - Mobile-first: every record is plain JSON suitable for any client.
 */

import fs from "fs/promises";
import path from "path";
import { HUB_SHARED_MEMORY_DIR } from "../../utils/repoPaths";

const CHANNEL_CONTEXT_PATH = path.resolve(
  HUB_SHARED_MEMORY_DIR,
  "intake/channel-contexts.json",
);

export type ChannelType =
  | "app_chat"
  | "voice"
  | "email"
  | "sms"
  | "whatsapp"
  | "webhook"
  | "api"
  | "unknown";

export interface ChannelInteraction {
  timestamp: string;
  channel: ChannelType;
  sender_id: string;
  message_excerpt: string;
  command_id?: string;
  task_id?: string;
  notes?: string;
}

export interface ChannelContext {
  user_id: string;
  active_channel: ChannelType;
  related_channels: ChannelType[];
  interaction_history: ChannelInteraction[];
  linked_task_ids: string[];
  updated_at: string;
}

interface ChannelContextFile {
  version: string;
  contexts: ChannelContext[];
}

export interface RecordInteractionInput {
  user_id: string;
  channel: ChannelType;
  sender_id: string;
  message_excerpt: string;
  command_id?: string;
  task_id?: string;
  notes?: string;
}

export class ChannelContextManager {
  static async record(input: RecordInteractionInput): Promise<ChannelContext> {
    const file = await this.read();
    const now = new Date().toISOString();
    const idx = file.contexts.findIndex((c) => c.user_id === input.user_id);

    const interaction: ChannelInteraction = {
      timestamp: now,
      channel: input.channel,
      sender_id: input.sender_id,
      message_excerpt: input.message_excerpt.slice(0, 240),
      command_id: input.command_id,
      task_id: input.task_id,
      notes: input.notes,
    };

    let context: ChannelContext;
    if (idx < 0) {
      context = {
        user_id: input.user_id,
        active_channel: input.channel,
        related_channels: [input.channel],
        interaction_history: [interaction],
        linked_task_ids: input.task_id ? [input.task_id] : [],
        updated_at: now,
      };
      file.contexts.push(context);
    } else {
      const existing = file.contexts[idx];
      const related = new Set<ChannelType>(existing.related_channels);
      related.add(input.channel);
      const linked = new Set<string>(existing.linked_task_ids);
      if (input.task_id) linked.add(input.task_id);
      context = {
        ...existing,
        active_channel: input.channel,
        related_channels: Array.from(related),
        interaction_history: existing.interaction_history.concat(interaction),
        linked_task_ids: Array.from(linked),
        updated_at: now,
      };
      file.contexts[idx] = context;
    }

    await this.write(file);
    return context;
  }

  static async get(user_id: string): Promise<ChannelContext | null> {
    const file = await this.read();
    return file.contexts.find((c) => c.user_id === user_id) || null;
  }

  static async list(filter?: {
    channel?: ChannelType;
    has_task_id?: string;
  }): Promise<ChannelContext[]> {
    const file = await this.read();
    let items = file.contexts.slice();
    if (filter?.channel) {
      items = items.filter((c) => c.related_channels.includes(filter.channel!));
    }
    if (filter?.has_task_id) {
      items = items.filter((c) => c.linked_task_ids.includes(filter.has_task_id!));
    }
    return items
      .slice()
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  static async linkTask(user_id: string, task_id: string): Promise<ChannelContext | null> {
    const file = await this.read();
    const idx = file.contexts.findIndex((c) => c.user_id === user_id);
    if (idx < 0) return null;
    const linked = new Set<string>(file.contexts[idx].linked_task_ids);
    linked.add(task_id);
    file.contexts[idx].linked_task_ids = Array.from(linked);
    file.contexts[idx].updated_at = new Date().toISOString();
    await this.write(file);
    return file.contexts[idx];
  }

  static async setActiveChannel(
    user_id: string,
    channel: ChannelType,
  ): Promise<ChannelContext | null> {
    const file = await this.read();
    const idx = file.contexts.findIndex((c) => c.user_id === user_id);
    if (idx < 0) return null;
    const related = new Set<ChannelType>(file.contexts[idx].related_channels);
    related.add(channel);
    file.contexts[idx].active_channel = channel;
    file.contexts[idx].related_channels = Array.from(related);
    file.contexts[idx].updated_at = new Date().toISOString();
    await this.write(file);
    return file.contexts[idx];
  }

  private static async read(): Promise<ChannelContextFile> {
    try {
      const raw = await fs.readFile(CHANNEL_CONTEXT_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.contexts)) return parsed as ChannelContextFile;
    } catch {}
    return { version: "1.0", contexts: [] };
  }

  private static async write(file: ChannelContextFile): Promise<void> {
    try {
      await fs.mkdir(path.dirname(CHANNEL_CONTEXT_PATH), { recursive: true });
      await fs.writeFile(CHANNEL_CONTEXT_PATH, JSON.stringify(file, null, 2), "utf-8");
    } catch (err) {
      console.warn("[ChannelContextManager] Persistence failed:", err);
    }
  }
}

export default ChannelContextManager;
