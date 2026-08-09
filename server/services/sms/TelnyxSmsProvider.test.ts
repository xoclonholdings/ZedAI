import { generateKeyPairSync, sign } from "crypto";
import { describe, expect, it, vi } from "vitest";

import { TelnyxSmsProvider } from "./TelnyxSmsProvider";

describe("Telnyx SMS provider", () => {
  it("accepts a current valid webhook signature and rejects replayed timestamps", () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const rawBody = JSON.stringify({ data: { event_type: "message.received" } });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = sign(null, Buffer.from(`${timestamp}|${rawBody}`), privateKey).toString("base64");
    const provider = new TelnyxSmsProvider({
      apiKey: "key",
      publicKey: publicKey.export({ format: "pem", type: "spki" }).toString(),
      fromNumber: "+19375550199",
      apiBaseUrl: "https://api.telnyx.com/v2",
      maxWebhookAgeSeconds: 300,
    });
    expect(provider.verifyWebhook(rawBody, { "telnyx-signature-ed25519": signature, "telnyx-timestamp": timestamp })).toBe(true);
    expect(provider.verifyWebhook(rawBody, { "telnyx-signature-ed25519": signature, "telnyx-timestamp": "1" })).toBe(false);
  });

  it("uses the messages API and a transport idempotency key", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { id: "msg-1", to: [{ status: "queued" }] } }), { status: 200 }));
    const provider = new TelnyxSmsProvider({
      apiKey: "key",
      publicKey: "unused",
      fromNumber: "+19375550199",
      apiBaseUrl: "https://api.telnyx.com/v2",
      maxWebhookAgeSeconds: 300,
    }, fetchMock as any);
    await expect(provider.send({ to: "+19375550100", text: "Hello", idempotencyKey: "out-1" })).resolves.toEqual({ providerMessageId: "msg-1", status: "queued" });
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[1].headers).toMatchObject({ "Idempotency-Key": "out-1" });
  });

  it("parses inbound messages and delivery status events", () => {
    const provider = new TelnyxSmsProvider();
    expect(provider.parseInbound({ data: { event_type: "message.received", occurred_at: "2026-08-08T00:00:00Z", payload: { id: "in-1", from: { phone_number: "+19375550100" }, to: [{ phone_number: "+19375550199" }], text: "Hello" } } })).toMatchObject({ providerMessageId: "in-1", text: "Hello" });
    expect(provider.parseDeliveryUpdate({ data: { event_type: "message.delivered", payload: { id: "out-1", to: [{ status: "delivered" }] } } })).toEqual({ providerMessageId: "out-1", status: "delivered" });
  });
});
