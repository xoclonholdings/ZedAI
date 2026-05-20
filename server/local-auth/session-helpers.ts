import type { Request } from "express";

import type { LocalUser } from "./types";

/**
 * Tracks failed login attempts per `${context}:${ip}` key so the
 * login and admin-OTP endpoints can share the same lockout policy.
 * In-memory only — restarts wipe the counters, which is fine because
 * an attacker also loses connection state on restart.
 */
export const VERIFICATION_ATTEMPTS = new Map<
  string,
  { count: number; lastAttempt: number }
>();

export function getClientIp(req: Request): string {
  return req.ip || req.connection.remoteAddress || "unknown";
}

/** Drop every attempt counter for an IP (used after a challenge unlock). */
export function clearAttemptsForIp(ip: string): void {
  const keys = Array.from(VERIFICATION_ATTEMPTS.keys()).filter((key) =>
    key.endsWith(`:${ip}`),
  );
  for (const key of keys) {
    VERIFICATION_ATTEMPTS.delete(key);
  }
}

export function sessionUser(req: Request): LocalUser | undefined {
  return (req.session as any)?.user as LocalUser | undefined;
}

/**
 * Writes the user into the session in the shape the rest of the app
 * expects: `session.userId` for FK lookups, `session.user` for the
 * /api/me payload, `session.lastActivity` for the idle-timeout check.
 */
export function attachUser(req: Request, user: LocalUser): void {
  const sessionData = req.session as any;
  sessionData.userId = user.id;
  sessionData.lastActivity = Date.now();
  sessionData.user = {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
    isAdmin: user.isAdmin,
  };
}
