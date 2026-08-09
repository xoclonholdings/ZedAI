import { beforeEach, describe, expect, it } from "vitest";

import {
  clearIntakeReplayCacheForTests,
  createIntakeSignature,
  verifyIntakeSignature,
} from "./IntakeWebhookAuthenticity";

const secret = "test-intake-secret";
const now = Date.parse("2026-08-08T20:00:00.000Z");
const timestamp = new Date(now).toISOString();
const body = { from: "+15555550123", message: "hello" };

function signed(messageId = "message-1") {
  return {
    body,
    messageId,
    now,
    providedSignature: createIntakeSignature({ body, messageId, secret, timestamp }),
    secret,
    timestamp,
  };
}

describe("external intake authenticity", () => {
  beforeEach(() => clearIntakeReplayCacheForTests());

  it("accepts a valid HMAC with timestamp and message id", () => {
    expect(verifyIntakeSignature(signed())).toEqual({ ok: true });
  });

  it("fails closed when the server secret is missing", () => {
    expect(verifyIntakeSignature({ ...signed(), secret: undefined })).toMatchObject({
      ok: false,
      code: "misconfigured",
      status: 503,
    });
  });

  it("rejects a forged signature", () => {
    expect(
      verifyIntakeSignature({ ...signed(), providedSignature: "sha256=forged" }),
    ).toMatchObject({ ok: false, code: "forged", status: 401 });
  });

  it("rejects an expired timestamp", () => {
    expect(verifyIntakeSignature({ ...signed(), now: now + 6 * 60 * 1000 })).toMatchObject({
      ok: false,
      code: "expired",
      status: 401,
    });
  });

  it("rejects replay of an already accepted message id", () => {
    expect(verifyIntakeSignature(signed())).toEqual({ ok: true });
    expect(verifyIntakeSignature(signed())).toMatchObject({
      ok: false,
      code: "replay",
      status: 409,
    });
  });
});
