import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  authenticateZillionCapability,
  resetCapabilityReceiptsForTests,
  signZillionCapability,
  verifyZillionSignature,
} from "./ZillionCapabilityAuth";

const secret = "test-capability-secret-with-at-least-32-characters";
const original = process.env.ZILLION_CAPABILITY_SECRET;

beforeEach(() => {
  process.env.ZILLION_CAPABILITY_SECRET = secret;
  resetCapabilityReceiptsForTests();
});

afterEach(() => {
  if (original === undefined) delete process.env.ZILLION_CAPABILITY_SECRET;
  else process.env.ZILLION_CAPABILITY_SECRET = original;
});

function signed(overrides: Partial<Parameters<typeof signZillionCapability>[0]> = {}) {
  const input = {
    timestamp: String(Date.now()),
    messageId: "message-1",
    ownerUserId: "user_privy_123",
    method: "POST",
    path: "/api/capabilities/model/chat",
    body: '{"capability":"zillion.capital.analysis"}',
    secret,
    ...overrides,
  };
  return { ...input, signature: signZillionCapability(input) };
}

describe("ZILLION capability authentication", () => {
  it("verifies the canonical signed owner envelope", () => {
    const { secret: _secret, ...input } = signed();
    expect(verifyZillionSignature(input)).toBe("user_privy_123");
  });

  it("rejects body tampering", () => {
    const { secret: _secret, ...input } = signed();
    expect(() => verifyZillionSignature({ ...input, body: "{}" })).toThrow(/signature/i);
  });

  it("rejects expired requests", () => {
    const { secret: _secret, ...input } = signed({ timestamp: "1" });
    expect(() => verifyZillionSignature(input)).toThrow(/timestamp/i);
  });

  it("rejects fallback owners", () => {
    const { secret: _secret, ...input } = signed({ ownerUserId: "anonymous" });
    expect(() => verifyZillionSignature(input)).toThrow(/owner/i);
  });

  it("consumes a signed message ID only once", async () => {
    const body = '{"capability":"zillion.capital.analysis"}';
    const envelope = signed({ body, messageId: "single-use-message" });
    const req: any = {
      headers: {
        "x-zcos-timestamp": envelope.timestamp,
        "x-zcos-message-id": envelope.messageId,
        "x-zcos-owner": envelope.ownerUserId,
        "x-zcos-signature": envelope.signature,
      },
      method: envelope.method,
      path: envelope.path,
      rawBody: body,
      body: { capability: "zillion.capital.analysis" },
    };
    const statuses: number[] = [];
    const res: any = {
      status(code: number) {
        statuses.push(code);
        return this;
      },
      json() {},
    };
    let accepted = 0;
    await authenticateZillionCapability(req, res, () => { accepted += 1; });
    await authenticateZillionCapability(req, res, () => { accepted += 1; });
    expect(accepted).toBe(1);
    expect(statuses).toEqual([401]);
  });
});
