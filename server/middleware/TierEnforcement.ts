import { Request, Response, NextFunction } from "express";
import { logSecurityEvent } from "../services/SecurityAudit";

const TIER_0_PATTERNS = [
  /\b(csam|child pornograph|minor.*sexual|loli.*sexual)\b/i,
  /\b(how to (make|build|create) (a bomb|explosives|nerve agent|bioweapon))\b/i,
  /\b(kill|murder|assault) .{0,30} (address|location|home|route)\b/i,
  /disable (authentication|auth|login|security|passphrase)/i,
  /bypass (auth|security|passphrase|login)/i,
];

const TIER_3_SYSTEM_PATTERNS = [
  /reveal.*(passphrase|password|secret|auth)/i,
  /what is (the|my|your) (passphrase|password|secret key)/i,
  /show me (the|your) (passphrase|password|credentials)/i,
];

export function tier0Block(message: string): string | null {
  for (const pattern of TIER_0_PATTERNS) {
    if (pattern.test(message)) {
      return "This request is blocked. It falls into a category that ZAR will not assist with under any circumstances.";
    }
  }
  return null;
}

export function tier3Block(message: string): string | null {
  for (const pattern of TIER_3_SYSTEM_PATTERNS) {
    if (pattern.test(message)) {
      return "ZAR will not expose system credentials or authentication details. This is a hardcoded security boundary.";
    }
  }
  return null;
}

export async function checkTiers(
  message: string,
  userId: string,
  ip: string
): Promise<{ blocked: boolean; reply: string; tier?: number }> {
  const t0 = tier0Block(message);
  if (t0) {
    await logSecurityEvent({
      type: "tier.block",
      userId,
      ip,
      tier: 0,
      detail: `Tier-0 block: ${message.slice(0, 80)}`,
    });
    return { blocked: true, reply: t0, tier: 0 };
  }

  const t3 = tier3Block(message);
  if (t3) {
    await logSecurityEvent({
      type: "tier.block",
      userId,
      ip,
      tier: 3,
      detail: `Tier-3 block: ${message.slice(0, 80)}`,
    });
    return { blocked: true, reply: t3, tier: 3 };
  }

  return { blocked: false, reply: "" };
}

export function filterOutputForTier3(output: string): string {
  const passphrasePattern = /XOCLON[-_]SECURE[-_]202\d/gi;
  return output.replace(passphrasePattern, "[REDACTED]");
}
