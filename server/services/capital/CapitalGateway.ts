import { createHmac, randomUUID } from "crypto";

import { createOwnerContext } from "../auth/OwnerContext";

export type CapitalGrantKind = "launch" | "capability";

interface CapitalGrant {
  sub: string;
  iss: "zcos";
  aud: "zillion-prosper";
  kind: CapitalGrantKind;
  iat: number;
  exp: number;
  nonce: string;
}

function capitalSecret(): string {
  const secret = process.env.ZILLION_CAPABILITY_SECRET?.trim() || "";
  if (secret.length < 32) {
    throw new Error("ZILLION_CAPABILITY_SECRET must contain at least 32 characters.");
  }
  return secret;
}

function capitalApiUrl(): string {
  const base = process.env.ZILLION_PROSPER_API_URL?.trim().replace(/\/$/, "") || "";
  if (!base) throw new Error("ZILLION_PROSPER_API_URL is not configured.");
  return base;
}

export function issueCapitalGrant(
  ownerUserId: string,
  kind: CapitalGrantKind,
  ttlSeconds = 90,
): string {
  const owner = createOwnerContext(ownerUserId).ownerUserId;
  const now = Math.floor(Date.now() / 1000);
  const grant: CapitalGrant = {
    sub: owner,
    iss: "zcos",
    aud: "zillion-prosper",
    kind,
    iat: now,
    exp: now + ttlSeconds,
    nonce: randomUUID(),
  };
  const encoded = Buffer.from(JSON.stringify(grant)).toString("base64url");
  const signature = createHmac("sha256", capitalSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function buildCapitalLaunchUrl(ownerUserId: string, nextPath: string): string {
  const safePath = ["/", "/budget", "/trading"].includes(nextPath) ? nextPath : "/";
  const token = issueCapitalGrant(ownerUserId, "launch");
  const query = new URLSearchParams({ token, next: safePath });
  return `${capitalApiUrl()}/auth/zcos?${query.toString()}`;
}

export async function invokeCapital<T>(
  ownerUserId: string,
  body: Record<string, unknown>,
): Promise<T> {
  const token = issueCapitalGrant(ownerUserId, "capability");
  const response = await fetch(`${capitalApiUrl()}/api/capital/agent`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(payload?.error || `ZILLION Prosper failed with HTTP ${response.status}`));
  }
  return payload as T;
}
