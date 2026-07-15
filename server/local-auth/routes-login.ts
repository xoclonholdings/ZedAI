import type { Express, Request, Response } from "express";

import {
  authenticateManagedUser,
  loadAdminSettings,
} from "../services/AdminSettingsStore";
import { logSecurityEvent } from "../services/SecurityAudit";

import {
  VERIFICATION_ATTEMPTS,
  attachUser,
  getClientIp,
  lockoutMessage,
  lockoutRemainingSeconds,
} from "./session-helpers";

/**
 * POST /api/login + /api/logout. Login supports both
 * username/password and the admin secure-phrase fallback — both flow
 * through authenticateManagedUser, which returns null on any failure
 * (the route does the rate-limit accounting outside the auth call).
 */
export function registerLoginRoutes(app: Express): void {
  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const ip = getClientIp(req);
      const { username, password, passphrase } = req.body || {};
      const settings = await loadAdminSettings();
      const attemptKey = `login:${ip}`;
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

      const user = await authenticateManagedUser({ username, password, passphrase });

      if (!user) {
        const newCount = attempts.count + 1;
        VERIFICATION_ATTEMPTS.set(attemptKey, {
          count: newCount,
          lastAttempt: Date.now(),
        });
        await logSecurityEvent({
          type: "auth.login.fail",
          ip,
          detail: `Failed attempt ${newCount}/${settings.auth.maxFailedAttempts}`,
        });
        return res.status(401).json({ error: "Invalid credentials or secure phrase" });
      }

      VERIFICATION_ATTEMPTS.delete(attemptKey);
      attachUser(req, user);

      await logSecurityEvent({
        type: "auth.login.success",
        ip,
        userId: user.id,
        detail: `${user.isAdmin ? "Admin" : "User"} login successful`,
      });

      req.session.save((saveError) => {
        if (saveError) {
          console.error("Session save error:", saveError);
          return res.status(500).json({ error: "Login failed" });
        }

        res.json({
          success: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
            isAdmin: user.isAdmin,
            sessionExpiry: settings.auth.sessionTimeoutMinutes,
          },
        });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/logout", async (req: Request, res: Response) => {
    const userId = (req.session as any)?.userId;
    const ip = getClientIp(req);
    req.session.destroy(async (err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      await logSecurityEvent({
        type: "auth.logout",
        ip,
        userId,
        detail: "Session destroyed",
      });
      res.json({ success: true });
    });
  });
}
