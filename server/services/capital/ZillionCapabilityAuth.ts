import { createHmac, timingSafeEqual } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { sql } from "drizzle-orm";

import { db, isDatabaseRequired } from "../../db";
import { logRuntimeEvent } from "../RuntimeLogger";
import { createOwnerContext } from "../auth/OwnerContext";

const MAX_CLOCK_SKEW_MS = 120_000;
const memoryReceipts = new Map<string, number>();

export interface CapabilitySignatureInput {
  timestamp: string;
  messageId: string;
  ownerUserId: string;
  method: string;
  path: string;
  body: string;
  secret: string;
}

function capabilitySecret(): string {
  const value = process.env.ZILLION_CAPABILITY_SECRET?.trim() || "";
  if (value.length < 32) {
    throw new Error("ZILLION_CAPABILITY_SECRET must contain at least 32 characters.");
  }
  return value;
}

export function signZillionCapability(input: CapabilitySignatureInput): string {
  const canonical = [
    input.timestamp,
    input.messageId,
    input.ownerUserId,
    input.method.toUpperCase(),
    input.path,
    input.body,
  ].join("\n");
  return `sha256=${createHmac("sha256", input.secret).update(canonical).digest("hex")}`;
}

export function verifyZillionSignature(input: Omit<CapabilitySignatureInput, "secret"> & {
  signature: string;
  now?: number;
}): string {
  const now = input.now ?? Date.now();
  const timestamp = Number(input.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > MAX_CLOCK_SKEW_MS) {
    throw new Error("Capital capability timestamp is expired or invalid.");
  }
  if (!input.messageId.trim()) throw new Error("Capital capability message ID is required.");
  const owner = createOwnerContext(input.ownerUserId).ownerUserId;
  const expected = signZillionCapability({ ...input, ownerUserId: owner, secret: capabilitySecret() });
  const suppliedBuffer = Buffer.from(input.signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    throw new Error("Capital capability signature is invalid.");
  }
  return owner;
}

async function claimMessage(messageId: string, ownerUserId: string, path: string, capability: string): Promise<void> {
  const expiresAt = new Date(Date.now() + MAX_CLOCK_SKEW_MS);
  if (db) {
    await db.execute(sql`DELETE FROM capability_message_receipts WHERE expires_at < now()`);
    const result: any = await db.execute(sql`
      INSERT INTO capability_message_receipts (
        message_id, owner_user_id, path, capability, received_at, expires_at
      )
      VALUES (${messageId}, ${ownerUserId}, ${path}, ${capability}, now(), ${expiresAt})
      ON CONFLICT (message_id) DO NOTHING
      RETURNING message_id
    `);
    const rows = result?.rows ?? (Array.isArray(result) ? result : []);
    if (rows.length === 0) throw new Error("Capital capability message was already consumed.");
    return;
  }
  if (isDatabaseRequired()) throw new Error("Capability replay protection requires PostgreSQL.");
  const now = Date.now();
  for (const [id, expiry] of memoryReceipts) {
    if (expiry <= now) memoryReceipts.delete(id);
  }
  if (memoryReceipts.has(messageId)) throw new Error("Capital capability message was already consumed.");
  memoryReceipts.set(messageId, expiresAt.getTime());
}

export async function authenticateZillionCapability(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const timestamp = String(req.headers["x-zcos-timestamp"] || "");
    const messageId = String(req.headers["x-zcos-message-id"] || "");
    const ownerUserId = String(req.headers["x-zcos-owner"] || "");
    const signature = String(req.headers["x-zcos-signature"] || "");
    const body = String((req as any).rawBody || "");
    const path = req.path;
    const owner = verifyZillionSignature({
      timestamp,
      messageId,
      ownerUserId,
      signature,
      method: req.method,
      path,
      body,
    });
    const capability = String(req.body?.capability || "");
    await claimMessage(messageId, owner, path, capability);
    (req as any).capitalOwnerUserId = owner;
    (req as any).capitalMessageId = messageId;
    await logRuntimeEvent({
      level: "info",
      source: "server",
      event: "capital.capability.accepted",
      detail: `${capability} for ${owner}`,
      context: { messageId, path },
    });
    next();
  } catch (error) {
    await logRuntimeEvent({
      level: "warn",
      source: "server",
      event: "capital.capability.denied",
      detail: error instanceof Error ? error.message : "Invalid Capital capability.",
      context: { path: req.path },
    });
    res.status(401).json({ error: error instanceof Error ? error.message : "Invalid Capital capability." });
  }
}

export function resetCapabilityReceiptsForTests(): void {
  memoryReceipts.clear();
}
