/**
 * ExternalCommandGateway
 *
 * Universal intake layer that normalizes external commands (app,
 * voice, SMS, WhatsApp, email, browser triggers, webhooks, future
 * channels) into Zed's unified task format and routes them through
 * the existing execution / approval / orchestration pipelines.
 *
 * It does NOT execute anything itself. It only:
 *   1. Logs every incoming command.
 *   2. Records cross-channel context.
 *   3. Builds an execution plan via TaskExecutionEngine.
 *   4. Persists a TaskRecord via TaskLifecycleManager.
 *   5. Lets ApprovalWatchdog set the correct approval state.
 *   6. Runs a *preview* through ToolOrchestrationEngine (no
 *      execution; only recommended steps).
 *
 * The helpers live under ./external-command-gateway/:
 *   types.ts      shared shapes, COMMAND_LOG_PATH, channel +
 *                 entity-pattern lists
 *   normalize.ts  message → NormalizedCommand (entity extraction,
 *                 confidence, approval pre-flag)
 *   preview.ts    buildOrchestrationPreview (always non-executing)
 *   log.ts        logCommand + listRecentCommands (file IO)
 *
 * No existing UI, route, or component is modified.
 */

import { randomUUID } from "crypto";

import { TaskExecutionEngine } from "../execution/TaskExecutionEngine";
import { TaskLifecycleManager } from "../execution/TaskLifecycleManager";
import { ApprovalWatchdog } from "../approval/ApprovalWatchdog";
import { logRuntimeEvent } from "../RuntimeLogger";

import { ChannelContextManager, type ChannelType } from "./ChannelContextManager";
import { logCommand, listRecentCommands } from "./external-command-gateway/log";
import { normalizeCommand } from "./external-command-gateway/normalize";
import { buildOrchestrationPreview } from "./external-command-gateway/preview";
import {
  SUPPORTED_CHANNELS,
  type CommandLogFile,
  type ExternalCommandInput,
  type GatewayResult,
  type NormalizedCommand,
} from "./external-command-gateway/types";

export type {
  ExternalCommandInput,
  GatewayResult,
  NormalizedCommand,
} from "./external-command-gateway/types";

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

    // 1. Log the raw command (sanitized excerpt only — never the full
    //    body, which may contain secrets passed from a poorly-built
    //    upstream client).
    await logCommand({
      command_id,
      received_at,
      channel,
      sender_id: input.sender_id,
      user_id,
      message_excerpt: message.slice(0, 240),
      metadata: input.metadata,
    });

    // 2. Normalize (stateless — see normalize.ts for the heuristics).
    const normalized = normalizeCommand(message, channel, command_id);

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

    // 4. Persist as a TaskRecord so the existing pipeline owns
    //    lifecycle from here on.
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

    // 6. Let the watchdog decide on approval immediately so the
    //    caller sees the right approval_status when they read the
    //    task back.
    await ApprovalWatchdog.evaluate(task);
    const refreshed = (await TaskLifecycleManager.get(task.id)) || task;

    // 7. Non-executing orchestration preview so callers can show
    //    what would happen if the user/admin approves.
    const orchestration_preview = await buildOrchestrationPreview(refreshed, normalized);

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
   * Stateless normalization — re-exposed on the class so callers
   * can inspect classification without persisting anything. The
   * real implementation lives in normalize.ts.
   */
  static normalize(
    message: string,
    channel: ChannelType,
    command_id?: string,
  ): NormalizedCommand {
    return normalizeCommand(message, channel, command_id);
  }

  /** Read the most recent commands, newest first. */
  static async listRecent(limit = 100): Promise<CommandLogFile["entries"]> {
    return listRecentCommands(limit);
  }
}

export default ExternalCommandGateway;
