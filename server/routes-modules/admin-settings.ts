import type { Express } from "express";

import { isAdmin } from "../localAuth";
import {
  createManagedUser,
  getPublicAdminSettings,
  listManagedUsers,
  resetApprovalSettings,
  resetAppSettings,
  resetVoiceSettings,
  updateApprovalSettings,
  updateAppSettings,
  updateIntegrationSettings,
  updateManagedUser,
  updatePersonalizationSettings,
  updateVoiceSettings,
} from "../services/AdminSettingsStore";
import { checkGitHubIntegrationStatus, getGitHubRepoReadout } from "../services/GitHubIntegrationService";
import { getFirewallIntegrationStatus } from "../services/FirewallIntegrationService";
import { getEffectivePolicy } from "../services/AccessPolicyService";

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

  // Legacy compatibility endpoint. Settings are persistent AI memory, so
  // reset requests return the current saved values without clearing them.
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

  // ── Voice ("How ZAR sounds") ───────────────────────────────────────
  // Partial patches supported — the UI PUTs one field at a time on
  // change / blur, so the reducer accepts any subset of VoiceSettings
  // and mergeSettings clamps + normalizes on load.
  app.put("/api/admin/settings/voice", isAdmin, async (req, res) => {
    try {
      res.json(await updateVoiceSettings(req.body || {}));
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update voice settings" });
    }
  });

  // Legacy compatibility endpoint; returns current voice settings.
  app.post("/api/admin/settings/voice/reset", isAdmin, async (_req, res) => {
    try {
      res.json(await resetVoiceSettings());
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to reset voice settings" });
    }
  });

  // ── Approvals ("What needs your approval") ─────────────────────────
  app.put("/api/admin/settings/approvals", isAdmin, async (req, res) => {
    try {
      res.json(await updateApprovalSettings(req.body || {}));
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to update approvals" });
    }
  });

  // Legacy compatibility endpoint; returns current approval settings.
  app.post("/api/admin/settings/approvals/reset", isAdmin, async (_req, res) => {
    try {
      res.json(await resetApprovalSettings());
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Failed to reset approvals" });
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

  // ── Access policy (read-only view of hub/config/access.yaml) ──────
  // Surfaces the effective policy: which external services are
  // whitelisted, which are actually configured with env keys, and
  // the current trust model. The yaml itself is edited via the
  // Ruleset tab; the runtime consults it via consultExternalService.
  app.get("/api/admin/access-policy", isAdmin, async (_req, res) => {
    res.json(await getEffectivePolicy());
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
