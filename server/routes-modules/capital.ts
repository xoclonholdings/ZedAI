import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import { ownerUserIdFromAuthenticatedRequest } from "../services/auth/OwnerContext";
import { buildCapitalLaunchUrl } from "../services/capital/CapitalGateway";

export function registerCapitalRoutes(app: Express): void {
  app.get("/api/capital/launch", isAuthenticated, (req, res) => {
    try {
      const ownerUserId = ownerUserIdFromAuthenticatedRequest(req);
      const nextPath = String(req.query.path || "/");
      res.setHeader("Cache-Control", "no-store");
      res.redirect(303, buildCapitalLaunchUrl(ownerUserId, nextPath));
    } catch (error) {
      res.status(503).json({
        error: error instanceof Error ? error.message : "ZILLION Prosper is unavailable.",
      });
    }
  });
}
