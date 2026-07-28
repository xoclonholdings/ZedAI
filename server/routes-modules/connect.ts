import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import { getConnectCategorySummary } from "../services/admin-settings/connectSummary";

/**
 * Read-only summary of the admin-wide integrations for the user-facing
 * Connect page - see connectSummary.ts. Editing stays admin-only via the
 * existing /api/admin/settings/integrations route; this only tells a
 * regular user what's already connected and how many accounts.
 */
export function registerConnectRoutes(app: Express): void {
  app.get("/api/connect/categories", isAuthenticated, async (req: any, res) => {
    try {
      const categories = await getConnectCategorySummary();
      res.json({ categories, isAdmin: Boolean(req.user?.claims?.isAdmin) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load connect categories" });
    }
  });
}
