import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import { EmailInboxService } from "../services/EmailInboxService";

export function registerEmailInboxRoutes(app: Express): void {
  app.get("/api/inbox/email", isAuthenticated, async (req, res) => {
    try {
      const limit = Number(req.query.limit) || 50;
      res.json(await EmailInboxService.listInbox(limit));
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load email inbox" });
    }
  });
}
