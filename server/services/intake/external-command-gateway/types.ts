import path from "path";

import { HUB_SHARED_MEMORY_DIR } from "../../../utils/repoPaths";
import type {
  TaskExecutionPlan,
  TaskType,
} from "../../execution/TaskExecutionEngine";
import type { TaskRecord } from "../../execution/TaskLifecycleManager";
import type { OrchestrationResult } from "../../operational/ToolOrchestrationEngine";
import type { ChannelType } from "../ChannelContextManager";

export const COMMAND_LOG_PATH = path.resolve(
  HUB_SHARED_MEMORY_DIR,
  "intake/external-commands.json",
);

export interface ExternalCommandInput {
  channel: ChannelType;
  sender_id: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
  /** Optional ZAR user_id resolved by the upstream caller. */
  user_id?: string;
  /** Optional related conversation in app_chat. */
  conversation_id?: string | null;
}

export interface NormalizedCommand {
  command_id: string;
  normalized_intent: string;
  task_type: TaskType;
  confidence: number;
  requires_approval: boolean;
  extracted_entities: Record<string, string>;
  source_channel: ChannelType;
}

export interface GatewayResult {
  command: NormalizedCommand;
  plan: TaskExecutionPlan;
  task: TaskRecord;
  orchestration_preview?: OrchestrationResult;
}

export interface CommandLogFile {
  version: string;
  entries: Array<{
    command_id: string;
    received_at: string;
    channel: ChannelType;
    sender_id: string;
    user_id: string | null;
    message_excerpt: string;
    metadata?: Record<string, unknown>;
    task_id?: string;
  }>;
}

export const SUPPORTED_CHANNELS: ChannelType[] = [
  "app_chat",
  "voice",
  "email",
  "sms",
  "whatsapp",
  "webhook",
  "api",
  "unknown",
];

/**
 * Entity sniffers used during normalization. First-match wins per
 * key; the order is roughly "most specific first" so e.g. an email
 * captures the @-pattern before a phone regex tries to interpret
 * the digits in a number-bearing email address.
 */
export const ENTITY_PATTERNS: Array<{ key: string; regex: RegExp }> = [
  { key: "email", regex: /[\w.+-]+@[\w-]+\.[\w.-]+/i },
  { key: "phone", regex: /(?:\+?\d[\d\s().-]{7,}\d)/ },
  { key: "url", regex: /https?:\/\/[^\s)]+/i },
  { key: "date", regex: /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/ },
  { key: "amount", regex: /\$\s?\d+(?:\.\d{2})?/ },
];
