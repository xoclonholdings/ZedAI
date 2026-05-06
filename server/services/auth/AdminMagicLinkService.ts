/**
 * AdminMagicLinkService
 *
 * Email + OTP login for the single admin account.
 *
 * - The admin email is hardcoded (admin@zed-ai.online).
 * - OTPs are 6-digit numeric, single-use, 10-minute TTL.
 * - Codes are persisted to hub/shared-memory/auth/admin-magic-links.json
 *   so a backend restart doesn't invalidate a code that just got mailed.
 * - At most 5 verify attempts per code; rate-limited to 1 request per 60s
 *   per IP, max 5 active codes per email.
 *
 * Sending is delegated to AdminEmailSender, which falls back to logging
 * the code to the runtime log + console when no SMTP provider is wired.
 */

import fs from "fs/promises";
import path from "path";
import { randomInt, timingSafeEqual } from "crypto";
import { HUB_SHARED_MEMORY_DIR } from "../../utils/repoPaths";
import { logRuntimeEvent } from "../RuntimeLogger";
import { logSecurityEvent } from "../SecurityAudit";
import { AdminEmailSender } from "./AdminEmailSender";

export const ADMIN_EMAIL = "admin@zed-ai.online";

const STORE_PATH = path.resolve(HUB_SHARED_MEMORY_DIR, "auth/admin-magic-links.json");
const TTL_MS = 10 * 60 * 1000;
const REQUEST_RATE_LIMIT_MS = 60 * 1000;
const MAX_ACTIVE_CODES_PER_EMAIL = 5;
const MAX_VERIFY_ATTEMPTS = 5;

interface PendingCode {
  code: string;
  email: string;
  created_at: string;
  expires_at: string;
  used: boolean;
  attempts: number;
  request_ip: string | null;
}

interface MagicLinkStore {
  version: string;
  codes: PendingCode[];
  /** Last request timestamp keyed by IP — for rate limiting. */
  rate: Record<string, string>;
}

export interface RequestCodeInput {
  email: string;
  ip?: string | null;
}

export interface RequestCodeResult {
  /** Always present so callers can return a generic message and avoid email enumeration. */
  ok: boolean;
  /** Whether a code was actually generated (only true for the admin email). */
  generated: boolean;
  /** True when SMTP succeeded. False when we fell back to logging the code. */
  emailed?: boolean;
  /** True if the IP was rate-limited. */
  rate_limited?: boolean;
  retry_after_seconds?: number;
}

export interface VerifyCodeInput {
  email: string;
  code: string;
  ip?: string | null;
}

export interface VerifyCodeResult {
  ok: boolean;
  reason?: "no_code" | "expired" | "wrong_code" | "too_many_attempts" | "wrong_email";
}

export class AdminMagicLinkService {
  static normalizeEmail(email: string): string {
    return (email || "").trim().toLowerCase();
  }

  static isAdminEmail(email: string): boolean {
    return this.normalizeEmail(email) === ADMIN_EMAIL.toLowerCase();
  }

  static async requestCode(input: RequestCodeInput): Promise<RequestCodeResult> {
    const email = this.normalizeEmail(input.email);
    const ip = input.ip || null;

    if (!this.isAdminEmail(email)) {
      // Generic OK so attackers can't enumerate the admin email.
      await logSecurityEvent({
        type: "auth.magic_link.request",
        ip: ip || undefined,
        detail: `Request for non-admin email ignored: ${email.slice(0, 64)}`,
      });
      return { ok: true, generated: false };
    }

    const store = await this.read();

    if (ip) {
      const last = store.rate[ip];
      if (last) {
        const elapsed = Date.now() - new Date(last).getTime();
        if (elapsed < REQUEST_RATE_LIMIT_MS) {
          return {
            ok: true,
            generated: false,
            rate_limited: true,
            retry_after_seconds: Math.ceil((REQUEST_RATE_LIMIT_MS - elapsed) / 1000),
          };
        }
      }
    }

    this.pruneExpired(store);

    const activeForEmail = store.codes.filter((c) => c.email === email && !c.used);
    if (activeForEmail.length >= MAX_ACTIVE_CODES_PER_EMAIL) {
      // Drop the oldest to make room.
      const sorted = activeForEmail.sort((a, b) => a.created_at.localeCompare(b.created_at));
      const drop = sorted[0];
      drop.used = true;
    }

    const code = this.generateCode();
    const now = new Date();
    const pending: PendingCode = {
      code,
      email,
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + TTL_MS).toISOString(),
      used: false,
      attempts: 0,
      request_ip: ip,
    };
    store.codes.push(pending);
    if (ip) store.rate[ip] = now.toISOString();
    await this.write(store);

    const send = await AdminEmailSender.sendOtp({ to: email, code, ttl_minutes: TTL_MS / 60_000 });

    await logSecurityEvent({
      type: "auth.magic_link.issued",
      ip: ip || undefined,
      detail: `Issued OTP for ${email} (delivered=${send.delivered}, channel=${send.channel})`,
    });

    return {
      ok: true,
      generated: true,
      emailed: send.delivered,
    };
  }

  static async verifyCode(input: VerifyCodeInput): Promise<VerifyCodeResult> {
    const email = this.normalizeEmail(input.email);
    const code = (input.code || "").trim();

    if (!this.isAdminEmail(email)) {
      return { ok: false, reason: "wrong_email" };
    }

    const store = await this.read();
    this.pruneExpired(store);

    const candidate = store.codes
      .filter((c) => c.email === email && !c.used)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

    if (!candidate) {
      await this.write(store);
      return { ok: false, reason: "no_code" };
    }

    if (new Date(candidate.expires_at).getTime() < Date.now()) {
      candidate.used = true;
      await this.write(store);
      return { ok: false, reason: "expired" };
    }

    candidate.attempts += 1;

    if (candidate.attempts > MAX_VERIFY_ATTEMPTS) {
      candidate.used = true;
      await this.write(store);
      await logSecurityEvent({
        type: "auth.magic_link.locked",
        ip: input.ip || undefined,
        detail: `OTP for ${email} locked after ${candidate.attempts} attempts`,
      });
      return { ok: false, reason: "too_many_attempts" };
    }

    if (!this.constantTimeEqual(code, candidate.code)) {
      await this.write(store);
      return { ok: false, reason: "wrong_code" };
    }

    candidate.used = true;
    await this.write(store);

    await logSecurityEvent({
      type: "auth.magic_link.verified",
      ip: input.ip || undefined,
      detail: `OTP verified for ${email}`,
    });

    return { ok: true };
  }

  private static generateCode(): string {
    const n = randomInt(0, 1_000_000);
    return n.toString().padStart(6, "0");
  }

  private static constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  private static pruneExpired(store: MagicLinkStore): void {
    const now = Date.now();
    store.codes = store.codes.filter(
      (c) => !c.used && new Date(c.expires_at).getTime() > now,
    );
    // Trim rate map to recent entries only.
    for (const [ip, ts] of Object.entries(store.rate)) {
      if (now - new Date(ts).getTime() > 24 * 60 * 60 * 1000) delete store.rate[ip];
    }
  }

  private static async read(): Promise<MagicLinkStore> {
    try {
      const raw = await fs.readFile(STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.codes) && parsed.rate) {
        return parsed as MagicLinkStore;
      }
    } catch {}
    return { version: "1.0", codes: [], rate: {} };
  }

  private static async write(store: MagicLinkStore): Promise<void> {
    try {
      await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
      await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
    } catch (err) {
      console.warn("[AdminMagicLinkService] Persistence failed:", err);
      await logRuntimeEvent({
        level: "warn",
        source: "server",
        event: "auth.magic_link.persist_failed",
        detail: String(err),
      });
    }
  }
}

export default AdminMagicLinkService;
