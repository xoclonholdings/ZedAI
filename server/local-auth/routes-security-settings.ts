import type { Express, Request, Response } from "express";

import {
  getPublicAdminSettings,
  updateAuthSettings,
} from "../services/AdminSettingsStore";

import { isAdmin } from "./middleware";

/**
 * Admin security settings:
 *   GET  /api/admin/security-settings   read current values (already
 *                                       run through publicMasking so
 *                                       no raw session secret leaks)
 *   POST /api/admin/security-settings   patch any subset; empty
 *                                       fields are dropped by
 *                                       updateAuthSettings so partial
 *                                       PATCHes don't clobber stored
 *                                       values.
 */
export function registerSecuritySettingsRoutes(app: Express): void {
  app.get(
    "/api/admin/security-settings",
    isAdmin,
    async (_req: Request, res: Response) => {
      const settings = await getPublicAdminSettings();
      const hostedCrossOrigin = Boolean(process.env.FRONTEND_URL?.trim());
      res.json({
        securePhraseConfigured: Boolean(settings.auth.securePhrase),
        sessionTimeoutMinutes: settings.auth.sessionTimeoutMinutes,
        maxFailedAttempts: settings.auth.maxFailedAttempts,
        lockoutDurationMinutes: settings.auth.lockoutDurationMinutes,
        requireSecureCookies: settings.auth.requireSecureCookies,
        effectiveSecureCookies: hostedCrossOrigin || settings.auth.requireSecureCookies,
      });
    },
  );

  app.post(
    "/api/admin/security-settings",
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const {
          newSecurePhrase,
          sessionTimeoutMinutes,
          maxFailedAttempts,
          lockoutDurationMinutes,
          requireSecureCookies,
        } = req.body || {};

        if (newSecurePhrase && String(newSecurePhrase).trim().length < 8) {
          return res.status(400).json({ error: "Secure phrase must be at least 8 characters" });
        }
        if (sessionTimeoutMinutes !== undefined && Number(sessionTimeoutMinutes) < 5) {
          return res.status(400).json({ error: "Session timeout must be at least 5 minutes" });
        }
        if (maxFailedAttempts !== undefined && Number(maxFailedAttempts) < 1) {
          return res.status(400).json({ error: "Max failed attempts must be at least 1" });
        }
        if (lockoutDurationMinutes !== undefined && Number(lockoutDurationMinutes) < 1) {
          return res.status(400).json({ error: "Lockout duration must be at least 1 minute" });
        }

        const auth = await updateAuthSettings({
          securePhrase: newSecurePhrase?.trim(),
          sessionTimeoutMinutes,
          maxFailedAttempts,
          lockoutDurationMinutes,
          requireSecureCookies,
        });

        res.json({
          success: true,
          message: "Security settings updated successfully",
          settings: {
            securePhraseConfigured: Boolean(auth.securePhrase),
            sessionTimeoutMinutes: auth.sessionTimeoutMinutes,
            maxFailedAttempts: auth.maxFailedAttempts,
            lockoutDurationMinutes: auth.lockoutDurationMinutes,
            requireSecureCookies: auth.requireSecureCookies,
            effectiveSecureCookies:
              Boolean(process.env.FRONTEND_URL?.trim()) || auth.requireSecureCookies,
          },
        });
      } catch (error: any) {
        console.error("Security settings update failed:", error);
        res
          .status(400)
          .json({ error: error.message || "Failed to update security settings" });
      }
    },
  );
}
