import { createPublicKey, verify as verifySignature } from "crypto";

import type { InboundSms, OutboundSms, SmsProvider, SmsSendResult } from "./types";

function header(headers: Record<string, string | string[] | undefined>, name: string): string {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export class TelnyxSmsProvider implements SmsProvider {
  readonly name = "telnyx";

  constructor(
    private readonly config = {
      apiKey: process.env.TELNYX_API_KEY || "",
      publicKey: process.env.TELNYX_PUBLIC_KEY || "",
      fromNumber: process.env.TELNYX_PHONE_NUMBER || "",
      apiBaseUrl: process.env.TELNYX_API_BASE_URL || "https://api.telnyx.com/v2",
      maxWebhookAgeSeconds: Number(process.env.SMS_WEBHOOK_MAX_AGE_SECONDS || 300),
    },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  verifyWebhook(rawBody: string, headers: Record<string, string | string[] | undefined>): boolean {
    const signature = header(headers, "telnyx-signature-ed25519");
    const timestamp = header(headers, "telnyx-timestamp");
    if (!signature || !timestamp || !this.config.publicKey || !rawBody) return false;
    const timestampNumber = Number(timestamp);
    if (!Number.isFinite(timestampNumber)) return false;
    if (Math.abs(Date.now() / 1000 - timestampNumber) > this.config.maxWebhookAgeSeconds) return false;
    try {
      const publicKey = this.config.publicKey.includes("BEGIN PUBLIC KEY")
        ? createPublicKey(this.config.publicKey.replace(/\\n/g, "\n"))
        : createPublicKey({ key: Buffer.from(this.config.publicKey, "base64"), format: "der", type: "spki" });
      return verifySignature(
        null,
        Buffer.from(`${timestamp}|${rawBody}`, "utf8"),
        publicKey,
        Buffer.from(signature, "base64"),
      );
    } catch {
      return false;
    }
  }

  parseInbound(payload: any): InboundSms | null {
    const event = payload?.data;
    if (event?.event_type !== "message.received") return null;
    const message = event.payload;
    const from = message?.from?.phone_number;
    const to = message?.to?.[0]?.phone_number;
    const text = message?.text;
    const providerMessageId = message?.id;
    if (![from, to, text, providerMessageId].every((value) => typeof value === "string" && value.length > 0)) return null;
    return {
      providerMessageId,
      from,
      to,
      text,
      receivedAt: new Date(event.occurred_at || Date.now()),
    };
  }

  parseDeliveryUpdate(payload: any): { providerMessageId: string; status: string } | null {
    const event = payload?.data;
    if (!/^message\.(?:sent|delivered|finalized|failed)$/.test(String(event?.event_type || ""))) return null;
    const providerMessageId = event?.payload?.id;
    if (!providerMessageId) return null;
    const status = event.payload?.to?.[0]?.status || String(event.event_type).replace("message.", "");
    return { providerMessageId, status };
  }

  async send(message: OutboundSms): Promise<SmsSendResult> {
    if (!this.config.apiKey || !this.config.fromNumber) {
      throw new Error("Telnyx SMS is not configured");
    }
    const response = await this.fetchImpl(`${this.config.apiBaseUrl}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": message.idempotencyKey,
      },
      body: JSON.stringify({ from: this.config.fromNumber, to: message.to, text: message.text }),
    });
    const body = await response.json().catch(() => ({})) as any;
    if (!response.ok) throw new Error(`Telnyx send failed (${response.status})`);
    const providerMessageId = body?.data?.id;
    if (!providerMessageId) throw new Error("Telnyx response did not include a message ID");
    return { providerMessageId, status: body?.data?.to?.[0]?.status || "queued" };
  }
}
