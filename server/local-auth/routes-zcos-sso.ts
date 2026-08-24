import type { Express, Request, Response } from "express";

import { attachUser } from "./session-helpers";
import type { LocalUser } from "./types";

type ZcosIdentity = {
  id: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  isAdmin?: boolean;
};

function zcosApiBase(): string {
  return String(process.env.ZCOS_API_URL || "https://zcos.onrender.com").replace(/\/$/, "");
}

function zarFrontendBase(): string {
  return String(process.env.FRONTEND_URL || process.env.ZAR_APP_URL || "https://zar-ai.online").replace(/\/$/, "");
}

function asLocalUser(identity: ZcosIdentity): LocalUser {
  return {
    id: String(identity.id),
    username: String(identity.username || identity.email || "ZCOS User"),
    email: String(identity.email || ""),
    firstName: String(identity.firstName || ""),
    lastName: String(identity.lastName || ""),
    profileImageUrl: String(identity.profileImageUrl || ""),
    isAdmin: Boolean(identity.isAdmin),
    isActive: true,
  };
}

export function registerZcosSsoRoutes(app: Express): void {
  app.get("/api/sso/zcos/callback", async (req: Request, res: Response) => {
    const ticket = typeof req.query.ticket === "string" ? req.query.ticket.trim() : "";
    if (!ticket) return res.status(400).send("Missing ZCOS identity ticket");

    try {
      const response = await fetch(`${zcosApiBase()}/api/sso/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client: "zar", ticket }),
      });
      const payload = await response.json() as { success?: boolean; user?: ZcosIdentity; error?: string };
      if (!response.ok || !payload.success || !payload.user?.id) {
        console.error("ZCOS SSO exchange failed:", payload.error || response.statusText);
        return res.redirect(`${zarFrontendBase()}/?auth=zcos-failed`);
      }

      attachUser(req, asLocalUser(payload.user));
      req.session.save((error) => {
        if (error) {
          console.error("ZCOS session save failed:", error);
          return res.redirect(`${zarFrontendBase()}/?auth=zcos-failed`);
        }
        res.redirect(`${zarFrontendBase()}/`);
      });
    } catch (error) {
      console.error("ZCOS SSO callback failed:", error);
      res.redirect(`${zarFrontendBase()}/?auth=zcos-failed`);
    }
  });
}
