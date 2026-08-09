import type { Express, Request, Response } from "express";

import { logSecurityEvent } from "../services/SecurityAudit";
import {
  authenticatePrivyAccessToken,
  PrivyAuthError,
  readBearerToken,
} from "../services/auth/PrivyAuthService";

import { attachUser, getClientIp } from "./session-helpers";

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

/**
 * Exchanges a verified Privy access token for the same HttpOnly ZAR session
 * used by every existing protected route. Privy never becomes a parallel
 * owner or an alternate runtime path.
 */
export function registerPrivyAuthRoutes(app: Express): void {
  app.post("/api/auth/privy/session", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    try {
      const accessToken = readBearerToken(req.headers.authorization);
      const user = await authenticatePrivyAccessToken(accessToken);

      await regenerateSession(req);
      attachUser(req, user);
      await saveSession(req);

      await logSecurityEvent({
        type: "auth.login.success",
        ip,
        userId: user.id,
        detail: "Privy email-code login successful",
      });

      res.json({ success: true });
    } catch (error) {
      const statusCode = error instanceof PrivyAuthError ? error.statusCode : 500;
      const message =
        error instanceof PrivyAuthError
          ? error.message
          : "Privy sign-in failed";

      await logSecurityEvent({
        type: "auth.login.fail",
        ip,
        detail: message,
      });
      res.status(statusCode).json({ error: message });
    }
  });
}
