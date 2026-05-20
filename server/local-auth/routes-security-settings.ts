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
      res.json({
        adminUsername: settings.auth.adminUsername,
        currentSecurePhrase: settings.auth.securePhrase,
        sessionTimeoutMinutes: settings.auth.sessionTimeoutMinutes,
        maxFailedAttempts: settings.auth.maxFailedAttempts,
        lockoutDurationMinutes: settings.auth.lockoutDurationMinutes,
        requireSecureCookies: settings.auth.requireSecureCookies,
      });
    },
  );

  app.post(
    "/api/admin/security-settings",
    isAdmin,
    async (req: Request, res: Response) => {
      try {
        const {
          adminUsername,
          newSecurePhrase,
          sessionTimeoutMinutes,
          maxFailedAttempts,
          lockoutDurationMinutes,
          requireSecureCookies,
        } = req.body || {};

        const auth = await updateAuthSettings({
          adminUsername: adminUsername?.trim(),
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
            adminUsername: auth.adminUsername,
            securePhrase: auth.securePhrase,
            sessionTimeoutMinutes: auth.sessionTimeoutMinutes,
            maxFailedAttempts: auth.maxFailedAttempts,
            lockoutDurationMinutes: auth.lockoutDurationMinutes,
            requireSecureCookies: auth.requireSecureCookies,
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
