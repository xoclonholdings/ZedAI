/**
 * EmailInboxWatchdog
 *
 * Watches connected inboxes for messages that need attention and pipes
 * them through the priority classifier. The watchdog itself does not
 * connect to a live mail provider; it accepts a "fetch" function so
 * callers can plug in IMAP/Gmail/etc. without changing this module.
 *
 * Constraints:
 *   - Does NOT send, delete, or modify messages.
 *   - Only inspects, classifies, and produces a list of recommended
 *     actions / tasks that downstream services may approve & execute.
 */

import {
  PriorityClassificationEngine,
  type ClassificationResult,
} from "./PriorityClassificationEngine";
import { logRuntimeEvent } from "../RuntimeLogger";

export interface InboxMessage {
  id: string;
  account_id: string;
  sender: string;
  subject: string;
  body: string;
  received_at: string;
  flags?: {
    starred?: boolean;
    important?: boolean;
    has_attachment?: boolean;
    thread_length?: number;
  };
}

export interface InboxFinding {
  message: InboxMessage;
  classification: ClassificationResult;
  needs_attention: boolean;
  follow_up_hint: string;
}

export type InboxFetcher = () => Promise<InboxMessage[]>;

const ATTENTION_PRIORITIES = new Set(["high", "urgent"]);
const ATTENTION_CATEGORIES = new Set([
  "reply_needed",
  "scheduling",
  "finance",
  "account",
  "opportunity",
]);

export class EmailInboxWatchdog {
  /**
   * Inspect a list of messages (provided by the caller) and return only
   * those that need attention. Stateless — safe to call repeatedly.
   */
  static async inspect(messages: InboxMessage[]): Promise<InboxFinding[]> {
    const findings: InboxFinding[] = [];
    for (const message of messages) {
      const classification = PriorityClassificationEngine.classify({
        subject: message.subject,
        body: message.body,
        sender: message.sender,
        received_at: message.received_at,
        flags: message.flags,
      });
      const needs_attention =
        ATTENTION_PRIORITIES.has(classification.priority) ||
        ATTENTION_CATEGORIES.has(classification.category);
      if (!needs_attention) continue;

      findings.push({
        message,
        classification,
        needs_attention,
        follow_up_hint: classification.recommended_action,
      });
    }

    if (findings.length > 0) {
      await logRuntimeEvent({
        level: "info",
        source: "server",
        event: "inbox.watchdog.findings",
        detail: `${findings.length} message(s) flagged for attention`,
        context: { count: findings.length },
      });
    }
    return findings;
  }

  /**
   * Fetch + inspect via a caller-supplied fetcher. This keeps live mail
   * provider details outside this module so we don't lock ZAR into one
   * implementation.
   */
  static async sweep(fetcher: InboxFetcher): Promise<InboxFinding[]> {
    let messages: InboxMessage[];
    try {
      messages = await fetcher();
    } catch (err: any) {
      await logRuntimeEvent({
        level: "warn",
        source: "server",
        event: "inbox.watchdog.fetch_failed",
        detail: err?.message || String(err),
      });
      return [];
    }
    return this.inspect(messages || []);
  }
}

export default EmailInboxWatchdog;
