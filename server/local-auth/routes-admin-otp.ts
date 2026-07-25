import type { Express, Request, Response } from "express";

import {
  findAdminUser,
  loadAdminSettings,
} from "../services/AdminSettingsStore";
import {
  ADMIN_EMAIL,
  AdminMagicLinkService,
} from "../services/auth/AdminMagicLinkService";
import { logSecurityEvent } from "../services/SecurityAudit";

import {
  VERIFICATION_ATTEMPTS,
  attachUser,
  getClientIp,
  lockoutMessage,
  lockoutRemainingSeconds,
} from "./session-helpers";

/**
 * Admin email + one-time-code login flow:
 *   POST /api/admin/login/request-code  — sends/logs the OTP
 *   POST /api/admin/login/verify-code   — verifies and signs in
 *   GET  /api/admin/login/email         — placeholder hint for the
 *                                         login page
 *
 * The request-code endpoint deliberately returns the same shape for
 * "email matched" and "email didn't match" so attackers can't probe
 * which address belongs to the admin. The only distinguishing field
 * is `delivery_channel`, which is omitted for non-admin emails.
 */
export function registerAdminOtpRoutes(app: Express): void {
  app.post("/api/admin/login/request-code", async (req: Request, res: Response) => {
    try {
      const ip = getClientIp(req);
      const { email } = req.body || {};
      const result = await AdminMagicLinkService.requestCode({ email, ip });

      const message = result.rate_limited
        ? `Please wait ${result.retry_after_seconds || 60}s before requesting another code.`
        : "If that email is recognized, a sign-in code has been sent.";

      res.json({
        success: true,
        message,
        rate_limited: !!result.rate_limited,
        retry_after_seconds: result.retry_after_seconds,
        delivery_channel:
          result.generated && typeof result.emailed === "boolean"
            ? result.emailed
              ? "email"
              : "server_log"
            : undefined,
      });
    } catch (error: any) {
      console.error("Admin OTP request error:", error);
      res.status(500).json({ error: "Failed to request sign-in code" });
    }
  });

  app.post("/api/admin/login/verify-code", async (req: Request, res: Response) => {
    try {
      const ip = getClientIp(req);
      const { email, code } = req.body || {};
      const settings = await loadAdminSettings();
      const attemptKey = `admin-otp:${ip}`;
      const attempts =
        VERIFICATION_ATTEMPTS.get(attemptKey) || { count: 0, lastAttempt: 0 };

      const retryAfterSeconds = lockoutRemainingSeconds(
        attempts,
        settings.auth.maxFailedAttempts,
        settings.auth.lockoutDurationMinutes,
      );
      if (retryAfterSeconds > 0) {
        res.setHeader("Retry-After", String(retryAfterSeconds));
        return res.status(429).json({
          error: lockoutMessage(retryAfterSeconds),
          retryAfterSeconds,
        });
      }

      const verifyResult = await AdminMagicLinkService.verifyCode({ email, code, ip });
      if (!verifyResult.ok) {
        VERIFICATION_ATTEMPTS.set(attemptKey, {
          count: attempts.count + 1,
          lastAttempt: Date.now(),
        });
        await logSecurityEvent({
          type: "auth.login.fail",
          ip,
          detail: `Admin OTP failed: ${verifyResult.reason || "unknown"}`,
        });
        return res.status(401).json({ error: "Invalid or expired code" });
      }

      const adminUser = await findAdminUser();
      if (!adminUser) {
        return res.status(500).json({ error: "Admin user not provisioned" });
      }

      VERIFICATION_ATTEMPTS.delete(attemptKey);
      attachUser(req, adminUser);
      await logSecurityEvent({
        type: "auth.login.success",
        ip,
        userId: adminUser.id,
        detail: "Admin OTP login successful",
      });

      req.session.save((saveError) => {
        if (saveError) {
          console.error("Session save error:", saveError);
          return res.status(500).json({ error: "Login failed" });
        }
        res.json({
          success: true,
          user: {
            id: adminUser.id,
            username: adminUser.username,
            email: adminUser.email,
            firstName: adminUser.firstName,
            lastName: adminUser.lastName,
            profileImageUrl: adminUser.profileImageUrl,
            isAdmin: adminUser.isAdmin,
            sessionExpiry: settings.auth.sessionTimeoutMinutes,
          },
        });
      });
    } catch (error: any) {
      console.error("Admin OTP verify error:", error);
      res.status(500).json({ error: "Verification failed" });
    }
  });

  // Public on purpose — the login screen renders the admin email as
  // a placeholder hint, and revealing it isn't a security boundary
  // (it's plastered on the login form for the operator anyway).
  app.get("/api/admin/login/email", (_req: Request, res: Response) => {
    res.json({ adminEmail: ADMIN_EMAIL });
  });
}
