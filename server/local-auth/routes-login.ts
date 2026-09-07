import type { Express, Request, Response } from "express";

import { logSecurityEvent } from "../services/SecurityAudit";

import { getClientIp } from "./session-helpers";

/**
 * Privy is the only login mechanism. This route module owns logout only.
 */
export function registerLoginRoutes(app: Express): void {
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
