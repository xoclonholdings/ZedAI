import type { Express } from "express";

import { isAdmin } from "../localAuth";
import {
  createManagedUser,
  getPublicAdminSettings,
  listManagedUsers,
  resetAppSettings,
  updateAppSettings,
  updateIntegrationSettings,
  updateManagedUser,
  updatePersonalizationSettings,
} from "../services/AdminSettingsStore";
import { checkGitHubIntegrationStatus, getGitHubRepoReadout } from "../services/GitHubIntegrationService";
import { getFirewallIntegrationStatus } from "../services/FirewallIntegrationService";

/**
 * Admin settings: app prefs, personalization defaults, integration
 * configs (multi-account aware), managed users, integration status
 * probes. Pure thin route layer over AdminSettingsStore.
 */
export function registerAdminSettingsRoutes(app: Express): void {
  // ── Settings load ──────────────────────────────────────────────────
  app.get("/api/admin/settings", isAdmin, async (_req, res) => {
    res.json(await getPublicAdminSettings());
  });

  // ── App settings ───────────────────────────────────────────────────
  app.put("/api/admin/settings/app", isAdmin, async (req, res) => {
    try {
      res.json(await updateAppSettings(req.body || {}));
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update app settings" });
    }
  });

  app.post("/api/admin/settings/app/reset", isAdmin, async (_req, res) => {
    try {
      res.json(await resetAppSettings());
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to reset app settings" });
    }
  });

  // ── Personalization defaults ───────────────────────────────────────
  app.put("/api/admin/settings/personalization", isAdmin, async (req, res) => {
    try {
      res.json(await updatePersonalizationSettings(req.body || {}));
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update personalization" });
    }
  });

  // ── Integrations (multi-account aware) ─────────────────────────────
  app.put("/api/admin/settings/integrations", isAdmin, async (req, res) => {
    try {
      await updateIntegrationSettings(req.body || {});
      const settings = await getPublicAdminSettings();
      res.json(settings.integrations);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update integrations" });
    }
  });

  app.get("/api/admin/integrations/github/status", isAdmin, async (_req, res) => {
    res.json(await checkGitHubIntegrationStatus());
  });

  app.get("/api/admin/integrations/github/readout", isAdmin, async (_req, res) => {
    res.json(await getGitHubRepoReadout());
  });

  app.get("/api/admin/integrations/firewall/status", isAdmin, async (_req, res) => {
    res.json(await getFirewallIntegrationStatus());
  });

  // ── Managed users ─────────────────────────────────────────────────
  app.get("/api/admin/users", isAdmin, async (_req, res) => {
    res.json({ users: await listManagedUsers() });
  });

  app.post("/api/admin/users", isAdmin, async (req, res) => {
    try {
      res.json({ users: await createManagedUser(req.body || {}) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to create user" });
    }
  });

  app.patch("/api/admin/users/:id", isAdmin, async (req: any, res) => {
    try {
      res.json({ users: await updateManagedUser(req.params.id, req.body || {}) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update user" });
    }
  });
}
