import type { Express, Request, Response } from "express";

import {
  loadAdminSettings,
  updateCurrentUserCredentials,
} from "../services/AdminSettingsStore";

import { isAuthenticated } from "./middleware";
import {
  attachUser,
  clearAttemptsForIp,
  getClientIp,
  sessionUser,
} from "./session-helpers";

/**
 * Out-of-band credential paths:
 *
 *   POST /api/admin/verify-challenge   Admin recovery from lockout —
 *                                      either answer the static
 *                                      challenge or supply the secure
 *                                      phrase; success clears the IP's
 *                                      attempt counters.
 *   POST /api/auth/update-credentials  Logged-in user changes their
 *                                      own username/password.
 *   GET  /api/auth/current-credentials Light reflection used by the
 *                                      settings UI to render the
 *                                      current username.
 */
export function registerCredentialRoutes(app: Express): void {
  app.post("/api/admin/verify-challenge", async (req: Request, res: Response) => {
    try {
      const { challengeAnswer, securePhrase } = req.body || {};
      const settings = await loadAdminSettings();
      const validAnswers = ["42", "xoclon", "diagnostic"];
      const isValidChallenge =
        typeof challengeAnswer === "string" &&
        validAnswers.includes(challengeAnswer.toLowerCase());
      const isValidPhrase =
        typeof securePhrase === "string" && securePhrase === settings.auth.securePhrase;

      if (isValidChallenge || isValidPhrase) {
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

  app.post(
    "/api/auth/update-credentials",
    isAuthenticated,
    async (req: Request, res: Response) => {
      try {
        const { newUsername, newPassword } = req.body || {};
        const currentUser = sessionUser(req);

        if (!currentUser) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        if (!newUsername && !newPassword) {
          return res.status(400).json({ error: "Provide a username, password, or both" });
        }

        const updated = await updateCurrentUserCredentials(currentUser.id, {
          username: newUsername,
          password: newPassword,
        });

        if (!updated) {
          return res.status(404).json({ error: "User not found" });
        }

        attachUser(req, updated);

        res.json({
          success: true,
          message: "Credentials updated successfully",
          user: {
            username: updated.username,
            firstName: updated.firstName,
            lastName: updated.lastName,
          },
        });
      } catch (error: any) {
        console.error("Update credentials error:", error);
        res
          .status(400)
          .json({ error: error.message || "Failed to update credentials" });
      }
    },
  );

  app.get(
    "/api/auth/current-credentials",
    isAuthenticated,
    async (req: Request, res: Response) => {
      const currentUser = sessionUser(req);
      if (!currentUser) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        username: currentUser.username,
        isAdmin: currentUser.isAdmin,
      });
    },
  );
}
