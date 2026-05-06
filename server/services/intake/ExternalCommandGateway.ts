/**
 * ExternalCommandGateway
 *
 * Universal intake layer that normalizes external commands (app, voice,
 * SMS, WhatsApp, email, browser triggers, webhooks, future channels)
 * into Zed's unified task format and routes them through the existing
 * execution / approval / orchestration pipelines.
 *
 * It does NOT execute anything itself. It only:
 *   1. Logs every incoming command.
 *   2. Records cross-channel context.
 *   3. Builds an execution plan via TaskExecutionEngine.
 *   4. Persists a TaskRecord via TaskLifecycleManager.
 *   5. Lets ApprovalWatchdog set the correct approval state.
 *   6. Optionally runs a preview through ToolOrchestrationEngine
 *      (no execution; only recommended steps).
 *
 * No existing UI, route, or component is modified.
 */

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { HUB_SHARED_MEMORY_DIR } from "../../utils/repoPaths";
import { logRuntimeEvent } from "../RuntimeLogger";

import {
  TaskExecutionEngine,
  type TaskExecutionPlan,
  type TaskType,
} from "../execution/TaskExecutionEngine";
import {
  TaskLifecycleManager,
  type TaskRecord,
} from "../execution/TaskLifecycleManager";
import { ApprovalWatchdog } from "../approval/ApprovalWatchdog";
import {
  ToolOrchestrationEngine,
  type OrchestrationResult,
  type ToolStep,
  type ToolType,
} from "../operational/ToolOrchestrationEngine";
import {
  ChannelContextManager,
  type ChannelType,
} from "./ChannelContextManager";

const COMMAND_LOG_PATH = path.resolve(
  HUB_SHARED_MEMORY_DIR,
  "intake/external-commands.json",
);

export interface ExternalCommandInput {
  channel: ChannelType;
  sender_id: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
  /** Optional Zed user_id resolved by the upstream caller. */
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

interface CommandLogFile {
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

const SUPPORTED_CHANNELS: ChannelType[] = [
  "app_chat",
  "voice",
  "email",
  "sms",
  "whatsapp",
  "webhook",
  "api",
  "unknown",
];

const ENTITY_PATTERNS: Array<{ key: string; regex: RegExp }> = [
  { key: "email", regex: /[\w.+-]+@[\w-]+\.[\w.-]+/i },
  { key: "phone", regex: /(?:\+?\d[\d\s().-]{7,}\d)/ },
  { key: "url", regex: /https?:\/\/[^\s)]+/i },
  { key: "date", regex: /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/ },
  { key: "amount", regex: /\$\s?\d+(?:\.\d{2})?/ },
];

export class ExternalCommandGateway {
  /**
   * Receive a raw command from any external channel and route it
   * through Zed's existing pipelines. No external action is taken.
   */
  static async receive(input: ExternalCommandInput): Promise<GatewayResult> {
    const channel = SUPPORTED_CHANNELS.includes(input.channel)
      ? input.channel
      : ("unknown" as ChannelType);
    const command_id = `cmd-${randomUUID()}`;
    const received_at = input.timestamp || new Date().toISOString();
    const user_id = input.user_id || `external:${channel}:${input.sender_id}`;
    const message = (input.message || "").toString();

    // 1. Log the raw command (sanitized excerpt only).
    await this.logCommand({
      command_id,
      received_at,
      channel,
      sender_id: input.sender_id,
      user_id,
      message_excerpt: message.slice(0, 240),
      metadata: input.metadata,
    });

    // 2. Normalize.
    const normalized = this.normalize(message, channel, command_id);

    // 3. Build the execution plan (no side effects).
    const plan = TaskExecutionEngine.prepare({
      user_request: message,
      context: {
        channel,
        sender_id: input.sender_id,
        ...(input.metadata || {}),
        ...normalized.extracted_entities,
      },
    });

    // 4. Persist as a TaskRecord so the existing pipeline owns lifecycle.
    const task = await TaskLifecycleManager.create({
      user_id,
      conversation_id: input.conversation_id ?? null,
      plan,
    });

    // 5. Capture cross-channel context.
    await ChannelContextManager.record({
      user_id,
      channel,
      sender_id: input.sender_id,
      message_excerpt: message,
      command_id,
      task_id: task.id,
    });

    // 6. Let the watchdog decide on approval immediately so the caller
    //    sees the right approval_status when they read the task back.
    await ApprovalWatchdog.evaluate(task);
    const refreshed = (await TaskLifecycleManager.get(task.id)) || task;

    // 7. Build a non-executing orchestration preview so callers can
    //    show what would happen if the user/admin approves.
    const orchestration_preview = await this.buildOrchestrationPreview(
      refreshed,
      normalized,
    );

    await logRuntimeEvent({
      level: "info",
      source: "server",
      event: "intake.command.received",
      detail: `[${channel}] ${input.sender_id}: ${message.slice(0, 80)}`,
      context: {
        command_id,
        task_id: task.id,
        channel,
        requires_approval: normalized.requires_approval,
      },
    });

    return {
      command: { ...normalized, source_channel: channel },
      plan,
      task: refreshed,
      orchestration_preview,
    };
  }

  /**
   * Stateless normalization — exposed publicly so other modules and
   * tests can inspect classification without persisting anything.
   */
  static normalize(
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

    const extracted_entities = this.extractEntities(message);
    const confidence = this.estimateConfidence(message, extracted_entities, channel);
    const normalized_intent = this.summarizeIntent(message, task_type);
    const requires_approval = this.estimateApproval(lower, task_type);

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

  private static extractEntities(message: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const { key, regex } of ENTITY_PATTERNS) {
      const m = message.match(regex);
      if (m && m[0]) out[key] = m[0];
    }
    return out;
  }

  private static summarizeIntent(message: string, task_type: TaskType): string {
    const trimmed = message.replace(/\s+/g, " ").trim().slice(0, 200);
    return `${task_type}: ${trimmed}`;
  }

  private static estimateConfidence(
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

  private static estimateApproval(lower: string, task_type: TaskType): boolean {
    if (task_type === "cancel" || task_type === "book") return true;
    return /(send|reply|email|message|post|publish|pay|charge|refund|delete|update account)/.test(
      lower,
    );
  }

  private static async buildOrchestrationPreview(
    task: TaskRecord,
    normalized: NormalizedCommand,
  ): Promise<OrchestrationResult> {
    const steps: ToolStep[] = [];

    if (task.plan.execution_mode === "digital") {
      const tool: ToolType = normalized.extracted_entities.email ? "email" : "api";
      steps.push({
        tool,
        description: `Prepare ${tool} action from prepared script`,
        requires_approval: true,
      });
    } else if (task.plan.execution_mode === "future_human") {
      steps.push({
        tool: "notification",
        description: "Notify admin queue that a future-human task is pending",
        requires_approval: true,
      });
    } else {
      steps.push({
        tool: "notification",
        description: "Surface the prepared script to the user for manual execution",
        requires_approval: false,
      });
    }

    if (
      task.approval_status === "admin_required" ||
      task.approval_status === "user_required" ||
      task.approval_status === "manual_handling_required"
    ) {
      // Approval not yet granted -> orchestration must pause.
      return ToolOrchestrationEngine.run({
        task_id: task.id,
        user_id: task.user_id,
        steps,
        approved: false,
      });
    }

    // Even when not flagged, never execute as part of intake — preview only.
    return ToolOrchestrationEngine.run({
      task_id: task.id,
      user_id: task.user_id,
      steps,
      approved: false,
    });
  }

  private static async logCommand(entry: CommandLogFile["entries"][number]): Promise<void> {
    try {
      let file: CommandLogFile = { version: "1.0", entries: [] };
      try {
        const raw = await fs.readFile(COMMAND_LOG_PATH, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.entries)) file = parsed;
      } catch {}
      file.entries.push(entry);
      await fs.mkdir(path.dirname(COMMAND_LOG_PATH), { recursive: true });
      await fs.writeFile(COMMAND_LOG_PATH, JSON.stringify(file, null, 2), "utf-8");
    } catch (err) {
      console.warn("[ExternalCommandGateway] Failed to write command log:", err);
    }
  }

  static async listRecent(limit = 100): Promise<CommandLogFile["entries"]> {
    try {
      const raw = await fs.readFile(COMMAND_LOG_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.entries)) {
        return (parsed.entries as CommandLogFile["entries"])
          .slice(-limit)
          .reverse();
      }
    } catch {}
    return [];
  }
}

export default ExternalCommandGateway;
