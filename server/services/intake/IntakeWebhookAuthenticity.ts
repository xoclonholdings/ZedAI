import { createHmac, timingSafeEqual } from "crypto";
import type { NextFunction, Request, Response } from "express";

import { logRuntimeEvent } from "../RuntimeLogger";

const DEFAULT_TOLERANCE_MS = 5 * 60 * 1000;
const replayCache = new Map<string, number>();

export interface IntakeSignatureInput {
  body: unknown;
  messageId: string;
  secret: string;
  timestamp: string;
}

export type IntakeSignatureResult =
  | { ok: true }
  | {
      ok: false;
      code: "expired" | "forged" | "invalid_headers" | "misconfigured" | "replay";
      status: number;
    };

function signedPayload(input: Omit<IntakeSignatureInput, "secret">): string {
  return `${input.timestamp}.${input.messageId}.${JSON.stringify(input.body ?? {})}`;
}

export function createIntakeSignature(input: IntakeSignatureInput): string {
  return `sha256=${createHmac("sha256", input.secret)
    .update(signedPayload(input))
    .digest("hex")}`;
}

function signaturesMatch(expected: string, provided: string): boolean {
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return (
    expectedBytes.length === providedBytes.length &&
    timingSafeEqual(expectedBytes, providedBytes)
  );
}

function pruneReplayCache(now: number): void {
  for (const [messageId, expiresAt] of replayCache) {
    if (expiresAt <= now) replayCache.delete(messageId);
  }
}

export function verifyIntakeSignature(input: {
  body: unknown;
  messageId?: string;
  now?: number;
  providedSignature?: string;
  secret?: string;
  timestamp?: string;
  toleranceMs?: number;
}): IntakeSignatureResult {
  const secret = input.secret?.trim();
  if (!secret) return { ok: false, code: "misconfigured", status: 503 };
  if (!input.messageId || !input.timestamp || !input.providedSignature) {
    return { ok: false, code: "invalid_headers", status: 401 };
  }

  const timestampMs = Date.parse(input.timestamp);
  const now = input.now ?? Date.now();
  const toleranceMs = input.toleranceMs ?? DEFAULT_TOLERANCE_MS;
  if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > toleranceMs) {
    return { ok: false, code: "expired", status: 401 };
  }

  const expected = createIntakeSignature({
    body: input.body,
    messageId: input.messageId,
    secret,
    timestamp: input.timestamp,
  });
  if (!signaturesMatch(expected, input.providedSignature)) {
    return { ok: false, code: "forged", status: 401 };
  }

  pruneReplayCache(now);
  if (replayCache.has(input.messageId)) {
    return { ok: false, code: "replay", status: 409 };
  }
  replayCache.set(input.messageId, timestampMs + toleranceMs);
  return { ok: true };
}

function header(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

export function verifySignedIntakeRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const result = verifyIntakeSignature({
    body: req.body,
    messageId: header(req, "x-zar-message-id"),
    providedSignature: header(req, "x-zar-signature"),
    secret: process.env.INTAKE_WEBHOOK_SECRET,
    timestamp: header(req, "x-zar-timestamp"),
  });
  if (!("code" in result)) {
    next();
    return;
  }

  void logRuntimeEvent({
    level: "warn",
    source: "server",
    event: "intake.webhook.rejected",
    detail: `External intake rejected: ${result.code}`,
    context: { method: req.method, path: req.path, reason: result.code },
  });
  res.status(result.status).json({ error: "External intake could not be authenticated" });
}

export function clearIntakeReplayCacheForTests(): void {
  replayCache.clear();
}
