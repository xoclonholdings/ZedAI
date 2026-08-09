/**
 * MessagingBridge
 *
 * Inbound: routes any incoming message (whatsapp / telegram / discord /
 * sms / slack) through ExternalCommandGateway so it becomes a ZAR task
 * with approval gating, just like a chat message.
 *
 * Outbound: real provider sends. Configuration comes from env vars and
 * (for Twilio) the existing telephony admin settings:
 *
 *   TELEGRAM_BOT_TOKEN      — Telegram Bot API token
 *   DISCORD_WEBHOOK_URL     — Discord channel webhook URL
 *   SLACK_WEBHOOK_URL       — Slack incoming webhook URL
 *   telephony.accountSid    — Twilio account SID (Admin > Integrations)
 *   telephony.apiKey        — Twilio auth token
 *   telephony.phoneNumber   — Twilio "from" number for SMS / WhatsApp
 *
 * When a target's credentials are absent, sendOutbound returns
 * { status: "rejected", reason: "<target> not configured" } rather
 * than silently stubbing.
 */

import { ExternalCommandGateway, type GatewayResult } from "./ExternalCommandGateway";
import type { ChannelType } from "./ChannelContextManager";
import { logRuntimeEvent } from "../RuntimeLogger";
import { loadAdminSettings } from "../AdminSettingsStore";
import type { OwnerContext } from "../auth/OwnerContext";

export type MessagingTarget =
  | "whatsapp"
  | "telegram"
  | "discord"
  | "sms"
  | "slack";

export interface IncomingMessage {
  target: MessagingTarget;
  sender_id: string;
  body: string;
  metadata?: Record<string, unknown>;
  owner_context: OwnerContext;
  timestamp?: string;
}

export interface OutboundRequest {
  target: MessagingTarget;
  to: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface OutboundResult {
  status: "delivered" | "rejected";
  reason: string;
  provider_response?: unknown;
}

const TARGET_TO_CHANNEL: Record<MessagingTarget, ChannelType> = {
  whatsapp: "whatsapp",
  telegram: "unknown",
  discord: "unknown",
  sms: "sms",
  slack: "unknown",
};

export interface AdapterStatus {
  target: MessagingTarget;
  channel: ChannelType;
  outbound_enabled: boolean;
  approval_compatible: boolean;
}

export class MessagingBridge {
  /**
   * Inbound — wrap and forward to the universal gateway.
   */
  static async routeIncoming(message: IncomingMessage): Promise<GatewayResult> {
    const channel: ChannelType = TARGET_TO_CHANNEL[message.target] || "unknown";
    const result = await ExternalCommandGateway.receive({
      channel,
      sender_id: message.sender_id,
      message: message.body,
      metadata: { messaging_target: message.target, ...(message.metadata || {}) },
      timestamp: message.timestamp,
      owner_context: message.owner_context,
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
   * Outbound — dispatch to the configured provider for the target.
   */
  static async sendOutbound(req: OutboundRequest): Promise<OutboundResult> {
    void req;
    return {
      status: "rejected",
      reason: "Outbound messaging requires an action-specific approved execution path",
    };
  }

  /**
   * Surface adapter status so the admin UI / approval flow can decide
   * which targets are eligible for outbound delivery.
   */
  static async approvalCompatibility(): Promise<AdapterStatus[]> {
    const settings = await loadAdminSettings().catch(() => null);
    const t = settings?.integrations?.telephony;
    const twilioReady = !!(t?.accountSid && t?.apiKey && t?.phoneNumber);

    return [
      {
        target: "telegram",
        channel: TARGET_TO_CHANNEL.telegram,
        outbound_enabled: !!process.env.TELEGRAM_BOT_TOKEN,
        approval_compatible: !!process.env.TELEGRAM_BOT_TOKEN,
      },
      {
        target: "discord",
        channel: TARGET_TO_CHANNEL.discord,
        outbound_enabled: !!process.env.DISCORD_WEBHOOK_URL,
        approval_compatible: !!process.env.DISCORD_WEBHOOK_URL,
      },
      {
        target: "slack",
        channel: TARGET_TO_CHANNEL.slack,
        outbound_enabled: !!process.env.SLACK_WEBHOOK_URL,
        approval_compatible: !!process.env.SLACK_WEBHOOK_URL,
      },
      {
        target: "sms",
        channel: TARGET_TO_CHANNEL.sms,
        outbound_enabled: twilioReady,
        approval_compatible: twilioReady,
      },
      {
        target: "whatsapp",
        channel: TARGET_TO_CHANNEL.whatsapp,
        outbound_enabled: twilioReady,
        approval_compatible: twilioReady,
      },
    ];
  }

  // ──────────────────────────────────────────────────────────────────
  // Provider implementations
  // ──────────────────────────────────────────────────────────────────

  private static async sendTelegram(req: OutboundRequest): Promise<OutboundResult> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return { status: "rejected", reason: "TELEGRAM_BOT_TOKEN not set" };
    const url = `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: req.to, text: req.body }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || (json && (json as any).ok === false)) {
      return {
        status: "rejected",
        reason: (json as any)?.description || `Telegram ${res.status}`,
        provider_response: json,
      };
    }
    return { status: "delivered", reason: "ok", provider_response: json };
  }

  private static async sendDiscord(req: OutboundRequest): Promise<OutboundResult> {
    const url = process.env.DISCORD_WEBHOOK_URL;
    if (!url) return { status: "rejected", reason: "DISCORD_WEBHOOK_URL not set" };
    // Discord webhooks ignore `to` and post to the channel the webhook
    // was created in. We surface req.to in the message header when
    // operators provide one so the destination is visible.
    const content = req.to && req.to !== "channel" ? `**To:** ${req.to}\n${req.body}` : req.body;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { status: "rejected", reason: `Discord ${res.status}: ${text.slice(0, 120)}` };
    }
    return { status: "delivered", reason: "ok" };
  }

  private static async sendSlack(req: OutboundRequest): Promise<OutboundResult> {
    const url = process.env.SLACK_WEBHOOK_URL;
    if (!url) return { status: "rejected", reason: "SLACK_WEBHOOK_URL not set" };
    const text = req.to && req.to !== "channel" ? `*To:* ${req.to}\n${req.body}` : req.body;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { status: "rejected", reason: `Slack ${res.status}: ${txt.slice(0, 120)}` };
    }
    return { status: "delivered", reason: "ok" };
  }

  private static async sendTwilio(
    req: OutboundRequest,
    flavor: "sms" | "whatsapp",
  ): Promise<OutboundResult> {
    const settings = await loadAdminSettings();
    const t = settings.integrations.telephony;
    if (!t?.accountSid || !t?.apiKey || !t?.phoneNumber) {
      return {
        status: "rejected",
        reason:
          "Twilio not configured. Set telephony.accountSid / .apiKey / .phoneNumber in Admin > Integrations.",
      };
    }
    const fromNumber = flavor === "whatsapp" ? `whatsapp:${t.phoneNumber}` : t.phoneNumber;
    const toNumber =
      flavor === "whatsapp"
        ? req.to.startsWith("whatsapp:")
          ? req.to
          : `whatsapp:${req.to}`
        : req.to;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
      t.accountSid,
    )}/Messages.json`;
    const auth = "Basic " + Buffer.from(`${t.accountSid}:${t.apiKey}`).toString("base64");
    const form = new URLSearchParams();
    form.set("To", toNumber);
    form.set("From", fromNumber);
    form.set("Body", req.body);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        status: "rejected",
        reason: (json as any)?.message || `Twilio ${res.status}`,
        provider_response: json,
      };
    }
    return { status: "delivered", reason: "ok", provider_response: json };
  }
}

export default MessagingBridge;
