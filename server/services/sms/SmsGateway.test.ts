import { beforeEach, describe, expect, it, vi } from "vitest";

import { SmsGateway } from "./SmsGateway";
import { hashVerificationCode } from "./phoneSecurity";
import { DEFAULT_SMS_PERMISSIONS, type SmsConnection, type SmsProvider } from "./types";

const secret = "test-secret-that-is-at-least-thirty-two-characters";

function connection(overrides: Partial<SmsConnection> = {}): SmsConnection {
  return {
    id: "connection-1",
    userId: "user-owner",
    phoneHash: "hash",
    phoneCiphertext: "ciphertext",
    phoneLastFour: "0100",
    status: "active",
    permissions: { ...DEFAULT_SMS_PERMISSIONS },
    conversationId: "conversation-1",
    consentedAt: new Date(),
    revokedAt: null,
    policyVersion: "zar-by-text-v1",
    ...overrides,
  };
}

describe("ZAR by Text gateway", () => {
  beforeEach(() => { process.env.SMS_ENCRYPTION_KEY = secret; });

  it("routes a linked number through the canonical executor and sends the ordered reply", async () => {
    const sent: any[] = [];
    const linked = connection();
    const store: any = {
      findConnectionByPhoneHash: vi.fn(async () => linked),
      claimInbound: vi.fn(async () => true),
      enqueueOutbound: vi.fn(async ({ segmentIndex }: any) => `envelope-${segmentIndex}`),
      markOutbound: vi.fn(async () => undefined),
      setConversation: vi.fn(async () => undefined),
      recordEvent: vi.fn(async () => undefined),
    };
    const provider: SmsProvider = {
      name: "mock",
      verifyWebhook: () => true,
      parseInbound: () => null,
      parseDeliveryUpdate: () => null,
      send: vi.fn(async (message) => { sent.push(message); return { providerMessageId: `provider-${sent.length}`, status: "sent" }; }),
    };
    const execute = vi.fn(async (input: any) => ({ reply: "ZAR remembers the same conversation.", input }));
    const gateway = new SmsGateway(provider, store, execute, async () => "conversation-1");
    const accepted = await gateway.acceptInbound({ providerMessageId: "in-1", from: "+19375550100", to: "+19375550199", text: "Continue our project conversation", receivedAt: new Date() });
    await accepted.processing;
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-owner", conversationId: "conversation-1", route: "sms" }));
    expect(execute.mock.calls[0][0].context).toMatchObject({ channel: "sms", galaxyId: "zar", channelPermissions: linked.permissions });
    expect(sent.map((item) => item.text)).toEqual(["ZAR remembers the same conversation."]);
  });

  it("is idempotent for duplicate inbound delivery", async () => {
    const store: any = { findConnectionByPhoneHash: vi.fn(async () => connection()), claimInbound: vi.fn(async () => false) };
    const provider: any = { name: "mock" };
    const execute = vi.fn();
    const gateway = new SmsGateway(provider, store, execute);
    await expect(gateway.acceptInbound({ providerMessageId: "same", from: "+19375550100", to: "+19375550199", text: "hello", receivedAt: new Date() })).resolves.toEqual({ duplicate: true });
    expect(execute).not.toHaveBeenCalled();
  });

  it("honors STOP without invoking ZAR", async () => {
    const linked = connection();
    const store: any = {
      findConnectionByPhoneHash: vi.fn(async () => linked), claimInbound: vi.fn(async () => true),
      setConnectionStatus: vi.fn(async () => undefined), enqueueOutbound: vi.fn(async () => "out"), markOutbound: vi.fn(async () => undefined),
    };
    const provider: any = { name: "mock", send: vi.fn(async () => ({ providerMessageId: "out-1", status: "sent" })) };
    const execute = vi.fn();
    const gateway = new SmsGateway(provider, store, execute);
    const accepted = await gateway.acceptInbound({ providerMessageId: "stop-1", from: "+19375550100", to: "+19375550199", text: "STOP", receivedAt: new Date() });
    await accepted.processing;
    expect(store.setConnectionStatus).toHaveBeenCalledWith("connection-1", "disabled");
    expect(execute).not.toHaveBeenCalled();
  });

  it("does not expose account data to an unknown number", async () => {
    const store: any = {
      findConnectionByPhoneHash: vi.fn(async () => null), claimInbound: vi.fn(async () => true),
      enqueueOutbound: vi.fn(async () => "out"), markOutbound: vi.fn(async () => undefined),
    };
    const provider: any = { name: "mock", send: vi.fn(async () => ({ providerMessageId: "out-1", status: "sent" })) };
    const gateway = new SmsGateway(provider, store, vi.fn());
    const accepted = await gateway.acceptInbound({ providerMessageId: "unknown-1", from: "+19375550100", to: "+19375550199", text: "What do you know about me?", receivedAt: new Date() });
    await accepted.processing;
    expect(provider.send.mock.calls[0][0].text).toMatch(/isn't connected/);
    expect(provider.send.mock.calls[0][0].text).not.toMatch(/user-owner|account/i);
  });

  it("verifies a code, consumes the challenge, and links the existing user", async () => {
    let savedChallenge: any;
    let sentCode = "";
    const linked = connection();
    const store: any = {
      createChallenge: vi.fn(async (challenge) => { savedChallenge = { ...challenge, attempts: 0, consumedAt: null }; }),
      enqueueOutbound: vi.fn(async () => "verify-out"), markOutbound: vi.fn(async () => undefined),
      recordEvent: vi.fn(async () => undefined),
      getChallenge: vi.fn(async () => savedChallenge),
      incrementChallengeAttempts: vi.fn(async () => 1),
      consumeChallengeAndLink: vi.fn(async () => linked),
    };
    const provider: any = {
      name: "mock",
      send: vi.fn(async ({ text }: any) => {
        sentCode = text.match(/\b\d{6}\b/)?.[0] || "";
        return { providerMessageId: "verify-provider", status: "sent" };
      }),
    };
    const gateway = new SmsGateway(provider, store, vi.fn());
    const started = await gateway.startVerification({ userId: "user-owner", phone: "937-555-0100" });
    await expect(gateway.verify({ userId: "user-owner", challengeId: started.challengeId, code: sentCode })).resolves.toMatchObject({ userId: "user-owner", status: "active" });
    expect(store.consumeChallengeAndLink).toHaveBeenCalledOnce();
  });

  it("rejects failed, expired, and exhausted verification challenges generically", async () => {
    const base = {
      id: "challenge-1", userId: "user-owner", phoneHash: "hash", phoneCiphertext: "cipher", phoneLastFour: "0100",
      codeHash: hashVerificationCode("challenge-1", "123456", secret), permissions: DEFAULT_SMS_PERMISSIONS,
      expiresAt: new Date(Date.now() + 60_000), attempts: 0, maxAttempts: 5, consumedAt: null,
    };
    const store: any = { getChallenge: vi.fn(async () => base), incrementChallengeAttempts: vi.fn(async () => 1), recordEvent: vi.fn(async () => undefined) };
    const gateway = new SmsGateway({ name: "mock" } as any, store, vi.fn());
    await expect(gateway.verify({ userId: "user-owner", challengeId: "challenge-1", code: "000000" })).rejects.toThrow("Verification could not be completed");
    expect(store.incrementChallengeAttempts).toHaveBeenCalledOnce();
    store.getChallenge.mockResolvedValueOnce({ ...base, expiresAt: new Date(Date.now() - 1) });
    await expect(gateway.verify({ userId: "user-owner", challengeId: "challenge-1", code: "123456" })).rejects.toThrow("Verification could not be completed");
    store.getChallenge.mockResolvedValueOnce({ ...base, attempts: 5 });
    await expect(gateway.verify({ userId: "user-owner", challengeId: "challenge-1", code: "123456" })).rejects.toThrow("Verification could not be completed");
  });

  it.each([
    ["START", "active"],
    ["HELP", null],
    ["STATUS", null],
    ["UNLINK", null],
  ])("handles %s without invoking the model", async (command, expectedStatus) => {
    const linked = connection({ status: command === "START" ? "disabled" : "active" });
    const store: any = {
      findConnectionByPhoneHash: vi.fn(async () => linked), claimInbound: vi.fn(async () => true),
      setConnectionStatus: vi.fn(async () => undefined), enqueueOutbound: vi.fn(async () => "out"), markOutbound: vi.fn(async () => undefined),
    };
    const provider: any = { name: "mock", send: vi.fn(async () => ({ providerMessageId: "out", status: "sent" })) };
    const execute = vi.fn();
    const gateway = new SmsGateway(provider, store, execute);
    const accepted = await gateway.acceptInbound({ providerMessageId: `control-${command}`, from: "+19375550100", to: "+19375550199", text: command, receivedAt: new Date() });
    await accepted.processing;
    if (expectedStatus) expect(store.setConnectionStatus).toHaveBeenCalledWith("connection-1", expectedStatus);
    expect(execute).not.toHaveBeenCalled();
  });

  it("blocks sensitive actions and ambiguous project writes before orchestration", async () => {
    const linked = connection();
    const store: any = {
      findConnectionByPhoneHash: vi.fn(async () => linked), claimInbound: vi.fn(async () => true),
      enqueueOutbound: vi.fn(async () => "out"), markOutbound: vi.fn(async () => undefined), recordEvent: vi.fn(async () => undefined),
    };
    const provider: any = { name: "mock", send: vi.fn(async () => ({ providerMessageId: "out", status: "sent" })) };
    const execute = vi.fn();
    const gateway = new SmsGateway(provider, store, execute);
    const sensitive = await gateway.acceptInbound({ providerMessageId: "sensitive", from: "+19375550100", to: "+19375550199", text: "Transfer $500 from my bank account", receivedAt: new Date() });
    await sensitive.processing;
    const ambiguous = await gateway.acceptInbound({ providerMessageId: "ambiguous", from: "+19375550100", to: "+19375550199", text: "Add this to my project", receivedAt: new Date() });
    await ambiguous.processing;
    expect(execute).not.toHaveBeenCalled();
    expect(provider.send.mock.calls[0][0].text).toMatch(/confirmation inside ZAR/);
    expect(provider.send.mock.calls[1][0].text).toMatch(/Which ZAR Galaxy/);
  });

  it("retries provider failures with the same idempotency key", async () => {
    const linked = connection();
    const store: any = {
      findConnectionByPhoneHash: vi.fn(async () => linked), claimInbound: vi.fn(async () => true),
      enqueueOutbound: vi.fn(async () => "out"), markOutbound: vi.fn(async () => undefined),
    };
    let attempts = 0;
    const provider: any = {
      name: "mock",
      send: vi.fn(async (message: any) => {
        attempts += 1;
        if (attempts < 3) throw new Error("temporary failure");
        return { providerMessageId: "out", status: "sent", key: message.idempotencyKey };
      }),
    };
    const gateway = new SmsGateway(provider, store, async () => ({ reply: "Recovered" }), async () => "conversation-1");
    const accepted = await gateway.acceptInbound({ providerMessageId: "retry", from: "+19375550100", to: "+19375550199", text: "hello", receivedAt: new Date() });
    await accepted.processing;
    expect(provider.send).toHaveBeenCalledTimes(3);
    expect(new Set(provider.send.mock.calls.map((call: any[]) => call[0].idempotencyKey)).size).toBe(1);
  });
});
