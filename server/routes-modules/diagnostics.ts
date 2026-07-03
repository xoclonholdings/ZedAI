import type { Express } from "express";

import { isAdmin, isAuthenticated } from "../localAuth";
import { checkModelProviderHealth } from "../services/ModelProviderService";
import {
  getActiveProviderName,
  getProviderRoutingSummary,
  getResolvedTargetName,
} from "../core/providers/provider-executor";
import {
  getActiveProviderDefaultModel,
  getProviderRuntimeConfig,
} from "../core/providers/provider-config";
import { getPublicAdminSettings } from "../services/AdminSettingsStore";
import { checkGitHubIntegrationStatus } from "../services/GitHubIntegrationService";
import { getFirewallIntegrationStatus } from "../services/FirewallIntegrationService";

/**
 * The three diagnostic endpoints that surface "what is the deploy
 * actually running" — for the admin Overview's Provider Routing card,
 * the chat-runtime footer, and the integrations test panel.
 *
 * Database health lives outside this module (it's mutated by the
 * server's bootstrap pipeline), so we accept a getter callback.
 */
export function registerDiagnosticsRoutes(
  app: Express,
  opts: { isDatabaseHealthy: () => boolean },
): void {
  // User-facing: chat-runtime footer pings this every ~30s.
  app.get("/api/system/runtime", isAuthenticated, async (_req, res) => {
    try {
      const config = getProviderRuntimeConfig();
      const target = getResolvedTargetName({ lane: "chat" });
      const provider = getActiveProviderName({ lane: "chat" });
      // probeUrl must reflect the active provider's cloud endpoint.
      const probeUrl =
        provider === "openai"
          ? config.openai.baseUrl
          : provider === "claude"
            ? config.claude.baseUrl
            : provider === "claw-temp"
              ? config.clawTemp.baseUrl
              : config.openai.baseUrl;

      const targetHost = (() => {
        try {
          return new URL(probeUrl).host;
        } catch {
          return probeUrl;
        }
      })();
      const locationLabel = /lightning/i.test(probeUrl)
          ? "Lightning"
          : targetHost || "Remote";

      const aiHealth = await checkModelProviderHealth();
      const model = getActiveProviderDefaultModel(config);

      res.json({
        provider,
        model,
        target,
        target_url: probeUrl,
        location_label: locationLabel,
        is_local: false,
        status: aiHealth.status,
        available_models: aiHealth.models,
        lane_models: {
          chat: config.laneModels.chat || "",
          manager: config.laneModels.manager || "",
          operations: config.laneModels.operations || "",
          research: config.laneModels.research || "",
          business: config.laneModels.business || "",
          finance: config.laneModels.finance || "",
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to read runtime status" });
    }
  });

  // Admin Overview's system snapshot.
  app.get("/api/admin/system-status", isAdmin, async (_req, res) => {
    const aiHealth = await checkModelProviderHealth();
    const providerConfig = getProviderRuntimeConfig();
    const activeProvider = getActiveProviderName({ lane: "chat" });
    const routingSummary = getProviderRoutingSummary();
    const settings = await getPublicAdminSettings();
    const github = await checkGitHubIntegrationStatus();
    const firewall = await getFirewallIntegrationStatus();
    const normalizedAgents = settings.agents.map((agent) => {
      if (agent.key === "BusinessManagerAgent") {
        const isBusinessReady = settings.integrations.businessOperations.enabled;
        return {
          ...agent,
          status: (isBusinessReady ? "active" : "planned") as "active" | "planned",
          description: isBusinessReady
            ? "Business Manager lane is enabled through Business Operations."
            : agent.description,
        };
      }
      return agent;
    });
    res.json({
      system: "ZED",
      aiProvider: {
        status: aiHealth.status,
        models: aiHealth.models,
        provider: aiHealth.provider || activeProvider,
      },
      aiHost: {
        provider: activeProvider,
        target: getResolvedTargetName({ lane: "chat" }),
        configuredModel:
          providerConfig.activeModel || getActiveProviderDefaultModel(providerConfig),
        remoteMode: providerConfig.clawTemp.mode,
      },
      providerRouting: routingSummary.routing,
      database: opts.isDatabaseHealthy() ? "connected" : "offline",
      orchestrator: {
        status: "operational",
        active: normalizedAgents.filter((agent) => agent.status === "active"),
        planned: normalizedAgents.filter((agent) => agent.status === "planned"),
      },
      integrations: settings.integrations,
      github,
      firewall,
      auth: {
        adminUsername: settings.auth.adminUsername,
        requireSecureCookies: settings.auth.requireSecureCookies,
      },
    });
  });

  // Admin → Overview's Provider Routing card pulls this.
  app.get("/api/admin/provider-diagnostics", isAdmin, async (_req, res) => {
    const providerConfig = getProviderRuntimeConfig();
    const health = await checkModelProviderHealth();
    const activeProvider = getActiveProviderName({ lane: "chat" });
    const routingSummary = getProviderRoutingSummary();
    const defaultModel = getActiveProviderDefaultModel(providerConfig);
    const target = getResolvedTargetName({ lane: "chat" });

    res.json({
      activeProvider,
      health,
      config: {
        defaultModel,
        target,
        clawBaseUrl: providerConfig.clawTemp.baseUrl,
        clawMode: providerConfig.clawTemp.mode,
        openaiConfigured: Boolean(providerConfig.openai.apiKey),
        claudeConfigured: Boolean(providerConfig.claude.apiKey),
      },
      laneModels: {
        chat: providerConfig.laneModels.chat || "",
        manager: providerConfig.laneModels.manager || "",
        operations: providerConfig.laneModels.operations || "",
        research: providerConfig.laneModels.research || "",
        business: providerConfig.laneModels.business || "",
        finance: providerConfig.laneModels.finance || "",
      },
      routing: routingSummary.routing,
    });
  });
}
