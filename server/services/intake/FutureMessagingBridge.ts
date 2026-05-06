/**
 * FutureMessagingBridge
 *
 * PLACEHOLDER for future messaging integrations (WhatsApp, Telegram,
 * Discord, SMS, Slack, ...). Defines the adapter contract, the routing
 * interface, and the approval-notification compatibility surface so
 * downstream services can already depend on it today.
 *
 * NOT IMPLEMENTED:
 *   - real provider clients
 *   - delivery / receipt tracking
 *   - rich-media handling
 *
 * What IS implemented:
 *   - a registry of adapters keyed by target
 *   - a normalized routing function (`routeIncoming`) that pushes any
 *     incoming message into ExternalCommandGateway
 *   - an `approvalCompatibility` descriptor so ApprovalNotificationService
 *     knows which targets are eligible for outbound approval prompts
 */

import { ExternalCommandGateway, type GatewayResult } from "./ExternalCommandGateway";
import type { ChannelType } from "./ChannelContextManager";
import { logRuntimeEvent } from "../RuntimeLogger";

export type MessagingTarget =
  | "whatsapp"
  | "telegram"
  | "discord"
  | "sms"
  | "slack";

export interface MessagingAdapter {
  target: MessagingTarget;
  channel: ChannelType;
  /** Whether outbound messages are currently supported. */
  outbound_enabled: boolean;
  /** Whether this target may be used to deliver approval prompts. */
  approval_compatible: boolean;
  /** Provider client implementer fills this in when integration lands. */
  send?(input: { to: string; body: string; metadata?: Record<string, unknown> }): Promise<{ delivered: boolean; reason?: string }>;
}

export interface IncomingMessage {
  target: MessagingTarget;
  sender_id: string;
  body: string;
  metadata?: Record<string, unknown>;
  user_id?: string;
  timestamp?: string;
}

export interface OutboundRequest {
  target: MessagingTarget;
  to: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface OutboundResult {
  status: "delivered" | "queued" | "stubbed" | "rejected";
  reason: string;
}

const TARGET_TO_CHANNEL: Record<MessagingTarget, ChannelType> = {
  whatsapp: "whatsapp",
  telegram: "unknown",
  discord: "unknown",
  sms: "sms",
  slack: "unknown",
};

export class FutureMessagingBridge {
  private static adapters = new Map<MessagingTarget, MessagingAdapter>();

  static registerAdapter(adapter: MessagingAdapter): void {
    this.adapters.set(adapter.target, adapter);
  }

  static getAdapter(target: MessagingTarget): MessagingAdapter | null {
    return this.adapters.get(target) || this.defaultAdapter(target);
  }

  /**
   * Inbound — route an incoming messaging payload through the universal
   * gateway. Today this works as a pure pass-through; once a real
   * provider is wired in, the same call site keeps working.
   */
  static async routeIncoming(message: IncomingMessage): Promise<GatewayResult> {
    const channel: ChannelType = TARGET_TO_CHANNEL[message.target] || "unknown";
    const result = await ExternalCommandGateway.receive({
      channel,
      sender_id: message.sender_id,
      message: message.body,
      metadata: { messaging_target: message.target, ...(message.metadata || {}) },
      timestamp: message.timestamp,
      user_id: message.user_id,
    });
    await logRuntimeEvent({
      level: "info",
      source: "server",
      event: "intake.messaging.routed",
      detail: `[${message.target}] ${message.sender_id}: ${message.body.slice(0, 80)}`,
      context: { task_id: result.task.id },
    });
    return result;
  }

  /**
   * Outbound — placeholder. Calls the adapter's `send()` if implemented;
   * otherwise returns a "stubbed" status so callers know they must wire
   * in a real provider before relying on delivery.
   */
  static async sendOutbound(req: OutboundRequest): Promise<OutboundResult> {
    const adapter = this.getAdapter(req.target);
    if (!adapter || !adapter.outbound_enabled || !adapter.send) {
      await logRuntimeEvent({
        level: "info",
        source: "server",
        event: "intake.messaging.outbound_stub",
        detail: `Stubbed outbound to ${req.target}:${req.to}`,
      });
      return {
        status: "stubbed",
        reason: `No adapter wired for '${req.target}' yet. Outbound delivery is stubbed.`,
      };
    }
    try {
      const delivery = await adapter.send({
        to: req.to,
        body: req.body,
        metadata: req.metadata,
      });
      return {
        status: delivery.delivered ? "delivered" : "rejected",
        reason: delivery.reason || (delivery.delivered ? "ok" : "provider rejected"),
      };
    } catch (err: any) {
      return {
        status: "rejected",
        reason: err?.message || "send failed",
      };
    }
  }

  /**
   * Used by ApprovalNotificationService to decide whether a target
   * may be used to deliver approval prompts.
   */
  static approvalCompatibility(): Array<{
    target: MessagingTarget;
    channel: ChannelType;
    approval_compatible: boolean;
    outbound_enabled: boolean;
  }> {
    const out: Array<{
      target: MessagingTarget;
      channel: ChannelType;
      approval_compatible: boolean;
      outbound_enabled: boolean;
    }> = [];
    for (const target of Object.keys(TARGET_TO_CHANNEL) as MessagingTarget[]) {
      const adapter = this.getAdapter(target);
      if (!adapter) continue;
      out.push({
        target,
        channel: adapter.channel,
        approval_compatible: !!adapter.approval_compatible,
        outbound_enabled: !!adapter.outbound_enabled,
      });
    }
    return out;
  }

  private static defaultAdapter(target: MessagingTarget): MessagingAdapter {
    return {
      target,
      channel: TARGET_TO_CHANNEL[target] || "unknown",
      outbound_enabled: false,
      approval_compatible: false,
    };
  }
}

export default FutureMessagingBridge;
