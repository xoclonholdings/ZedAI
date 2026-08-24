import type { Express } from "express";

import { isAuthenticated } from "../localAuth";
import { getConnectCategorySummary } from "../services/admin-settings/connectSummary";
import { computeIntegrationGaps, dismissIntegrationGap } from "../services/IntegrationGapEngine";
import { ownerUserIdFromAuthenticatedRequest } from "../services/auth/OwnerContext";
import { getProviderRuntimeConfig } from "../core/providers/provider-config";
import { webSearchAvailable } from "../services/WebSearchService";
import { zcosCapabilityRegistry } from "../zcos/capabilities/ZcosCapabilityRegistry";

/**
 * Read-only summary of the admin-wide integrations for the user-facing
 * Connect page - see connectSummary.ts. Editing stays admin-only via the
 * existing /api/admin/settings/integrations route; this only tells a
 * regular user what's already connected and how many accounts.
 *
 * Also serves IntegrationGapEngine's prompts: real, detected "you asked for
 * this but it isn't connected" notices, dismissable per user.
 */
export function registerConnectRoutes(app: Express): void {
  app.get("/api/connect/capabilities", isAuthenticated, async (_req: any, res) => {
    const provider = getProviderRuntimeConfig();
    const connected = new Set<string>();
    if (provider.lightning.baseUrl && provider.lightning.apiKey) connected.add("model_provider");
    if (webSearchAvailable()) connected.add("web_search");
    if (
      process.env.ZILLION_PROSPER_API_URL?.trim() &&
      (process.env.ZILLION_CAPABILITY_SECRET?.trim().length || 0) >= 32
    ) connected.add("zillion_capital");

    const integrationIds = [...new Set(
      zcosCapabilityRegistry.list().flatMap((capability) => capability.requiredIntegrations),
    )];
    res.json({
      settingsPath: "/settings/integrations",
      integrations: integrationIds.map((id) => ({
        id,
        connected: connected.has(id),
        requiredBy: zcosCapabilityRegistry.list()
          .filter((capability) => capability.requiredIntegrations.includes(id))
          .map((capability) => capability.id),
      })),
    });
  });

  app.get("/api/connect/categories", isAuthenticated, async (req: any, res) => {
    try {
      const categories = await getConnectCategorySummary();
      res.json({ categories, isAdmin: Boolean(req.user?.claims?.isAdmin) });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load connect categories" });
    }
  });

  app.get("/api/connect/gaps", isAuthenticated, async (req: any, res) => {
    try {
      const gaps = await computeIntegrationGaps(ownerUserIdFromAuthenticatedRequest(req));
      res.json({ gaps });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to compute integration gaps" });
    }
  });

  app.post("/api/connect/gaps/:id/dismiss", isAuthenticated, async (req: any, res) => {
    try {
      await dismissIntegrationGap(ownerUserIdFromAuthenticatedRequest(req), String(req.params.id));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to dismiss" });
    }
  });
}
