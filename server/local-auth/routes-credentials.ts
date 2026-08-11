import type { Express, Request, Response } from "express";

import {
  loadAdminSettings,
} from "../services/AdminSettingsStore";

import {
  clearAttemptsForIp,
  getClientIp,
} from "./session-helpers";

/**
 * Out-of-band credential paths:
 *
 *   POST /api/admin/verify-challenge   Admin recovery from lockout —
 *                                      a valid secure phrase clears the
 *                                      IP's attempt counters.
 * Username/password credential routes were retired. Regular users use
 * Privy email verification; admin recovery uses the secure phrase.
 */
export function registerCredentialRoutes(app: Express): void {
  app.post("/api/admin/verify-challenge", async (req: Request, res: Response) => {
    try {
      const { securePhrase } = req.body || {};
      const settings = await loadAdminSettings();
      const isValidPhrase =
        typeof securePhrase === "string" && securePhrase === settings.auth.securePhrase;

      if (isValidPhrase) {
        clearAttemptsForIp(getClientIp(req));
        return res.json({
          success: true,
          message: "Challenge verified, please try logging in again",
        });
      }

      res.status(401).json({ error: "Invalid challenge response" });
    } catch (error) {
      console.error("Challenge verification failed:", error);
      res.status(500).json({ error: "Challenge verification failed" });
    }
  });
}
