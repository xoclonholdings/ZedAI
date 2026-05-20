import { randomUUID } from "crypto";

import type { TaskType } from "../../execution/TaskExecutionEngine";
import type { ChannelType } from "../ChannelContextManager";

import {
  ENTITY_PATTERNS,
  type NormalizedCommand,
} from "./types";

function extractEntities(message: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { key, regex } of ENTITY_PATTERNS) {
    const m = message.match(regex);
    if (m && m[0]) out[key] = m[0];
  }
  return out;
}

function summarizeIntent(message: string, task_type: TaskType): string {
  const trimmed = message.replace(/\s+/g, " ").trim().slice(0, 200);
  return `${task_type}: ${trimmed}`;
}

/**
 * Confidence is a rough heuristic, not a calibrated probability:
 *   - base 0.4
 *   - + 0.15 for a non-trivial message (>12 chars)
 *   - + 0.15 if we extracted any entities
 *   - + 0.15 for in-app chat (highest-signal channel)
 *   - + 0.10 for api/webhook (typed callers)
 *   - − 0.15 if we don't know the channel
 *   - clamped to [0, 1], rounded to 2 decimals
 */
function estimateConfidence(
  message: string,
  entities: Record<string, string>,
  channel: ChannelType,
): number {
  let score = 0.4;
  if (message.trim().length > 12) score += 0.15;
  if (Object.keys(entities).length > 0) score += 0.15;
  if (channel === "app_chat") score += 0.15;
  if (channel === "api" || channel === "webhook") score += 0.1;
  if (channel === "unknown") score -= 0.15;
  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

/**
 * Conservative approval gating — cancels and bookings always
 * require approval; sends, payments, and account mutations also
 * trip the gate. The ApprovalWatchdog gets the final call; this
 * is just the gateway's pre-flag.
 */
function estimateApproval(lower: string, task_type: TaskType): boolean {
  if (task_type === "cancel" || task_type === "book") return true;
  return /(send|reply|email|message|post|publish|pay|charge|refund|delete|update account)/.test(
    lower,
  );
}

/**
 * Stateless normalization — no persistence, no side effects. Pulls
 * the task_type from a small set of verb patterns, extracts known
 * entities, scores confidence, and decides whether the request is
 * sensitive enough that the gateway should mark it as
 * requires_approval up front.
 */
export function normalizeCommand(
  message: string,
  channel: ChannelType,
  command_id?: string,
): NormalizedCommand {
  const lower = message.toLowerCase();
  const task_type: TaskType = /(cancel|terminate|end\b|stop\b)/.test(lower)
    ? "cancel"
    : /(book|reserve|schedule|appointment|meeting)/.test(lower)
      ? "book"
      : "resolve";

  const extracted_entities = extractEntities(message);
  const confidence = estimateConfidence(message, extracted_entities, channel);
  const normalized_intent = summarizeIntent(message, task_type);
  const requires_approval = estimateApproval(lower, task_type);

  return {
    command_id: command_id || `cmd-${randomUUID()}`,
    normalized_intent,
    task_type,
    confidence,
    requires_approval,
    extracted_entities,
    source_channel: channel,
  };
}
