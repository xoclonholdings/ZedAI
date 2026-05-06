/**
 * ApprovalNotificationService
 *
 * Notify the correct person (user or admin) that an action requires
 * approval / manual handling / review.
 *
 * Constraints:
 *   - This service does NOT mutate UI.
 *   - It only persists notification records and logs them.
 *   - Frontend code can later read notifications via a clean function call.
 *   - Duplicate notifications for the same approval state are suppressed.
 */

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { HUB_SHARED_MEMORY_DIR } from "../../utils/repoPaths";
import { logRuntimeEvent } from "../RuntimeLogger";

const NOTIFICATION_STORE_PATH = path.resolve(
  HUB_SHARED_MEMORY_DIR,
  "execution/approval-notifications.json",
);

export type RecipientRole = "user" | "admin";
export type NotificationActionType =
  | "approve"
  | "reject"
  | "manual_handle"
  | "review_only";

export interface ApprovalNotification {
  id: string;
  recipient_role: RecipientRole;
  recipient_id: string | null;
  task_id: string;
  title: string;
  message: string;
  approval_required: boolean;
  action_type: NotificationActionType;
  created_at: string;
  read: boolean;
  /** Stable signature so duplicates can be suppressed. */
  dedupe_key: string;
}

interface NotificationStore {
  version: string;
  notifications: ApprovalNotification[];
}

export interface NotifyInput {
  recipient_role: RecipientRole;
  recipient_id: string | null;
  task_id: string;
  title: string;
  message: string;
  action_type: NotificationActionType;
  approval_required?: boolean;
  /** Override or augment the dedupe key. */
  dedupe_key?: string;
}

export class ApprovalNotificationService {
  static async notify(input: NotifyInput): Promise<ApprovalNotification | null> {
    const dedupe_key =
      input.dedupe_key ||
      `${input.task_id}:${input.recipient_role}:${input.action_type}`;

    const store = await this.read();
    const existing = store.notifications.find(
      (n) => n.dedupe_key === dedupe_key && !n.read,
    );
    if (existing) {
      // Same approval state already pending — skip duplicate.
      return null;
    }

    const notification: ApprovalNotification = {
      id: `notif-${randomUUID()}`,
      recipient_role: input.recipient_role,
      recipient_id: input.recipient_id,
      task_id: input.task_id,
      title: input.title,
      message: input.message,
      approval_required: input.approval_required ?? true,
      action_type: input.action_type,
      created_at: new Date().toISOString(),
      read: false,
      dedupe_key,
    };

    store.notifications.push(notification);
    await this.write(store);

    await logRuntimeEvent({
      level: "info",
      source: "server",
      event: "approval.notification.created",
      detail: `${notification.recipient_role} notified for task ${notification.task_id}`,
      context: {
        task_id: notification.task_id,
        action_type: notification.action_type,
      },
    });

    return notification;
  }

  static async list(filter?: {
    recipient_role?: RecipientRole;
    recipient_id?: string;
    unread_only?: boolean;
    task_id?: string;
  }): Promise<ApprovalNotification[]> {
    const store = await this.read();
    let items = store.notifications.slice().reverse();
    if (filter?.recipient_role) items = items.filter((n) => n.recipient_role === filter.recipient_role);
    if (filter?.recipient_id) items = items.filter((n) => n.recipient_id === filter.recipient_id);
    if (filter?.unread_only) items = items.filter((n) => !n.read);
    if (filter?.task_id) items = items.filter((n) => n.task_id === filter.task_id);
    return items;
  }

  static async markRead(id: string): Promise<boolean> {
    const store = await this.read();
    const idx = store.notifications.findIndex((n) => n.id === id);
    if (idx < 0) return false;
    store.notifications[idx].read = true;
    await this.write(store);
    return true;
  }

  static async markTaskNotificationsRead(task_id: string): Promise<number> {
    const store = await this.read();
    let count = 0;
    for (const n of store.notifications) {
      if (n.task_id === task_id && !n.read) {
        n.read = true;
        count++;
      }
    }
    if (count > 0) await this.write(store);
    return count;
  }

  private static async read(): Promise<NotificationStore> {
    try {
      const raw = await fs.readFile(NOTIFICATION_STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.notifications)) return parsed as NotificationStore;
    } catch {}
    return { version: "1.0", notifications: [] };
  }

  private static async write(store: NotificationStore): Promise<void> {
    try {
      await fs.mkdir(path.dirname(NOTIFICATION_STORE_PATH), { recursive: true });
      await fs.writeFile(NOTIFICATION_STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
    } catch (err) {
      console.warn("[ApprovalNotificationService] Failed to persist notifications:", err);
    }
  }
}

export default ApprovalNotificationService;
