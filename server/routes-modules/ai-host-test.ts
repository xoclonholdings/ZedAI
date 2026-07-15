import type { Express } from "express";

import { isAdmin } from "../localAuth";
import {
  checkModelProviderHealth,
  generateChatFromProvider,
} from "../services/ModelProviderService";
import {
  getActiveProviderName,
  getResolvedTargetName,
} from "../core/providers/provider-executor";
import {
  getActiveProviderDefaultModel,
  getProviderRuntimeConfig,
} from "../core/providers/provider-config";
import type { ProviderLane, ReasoningEffort } from "../core/providers/provider-interface";
import { logRuntimeEvent } from "../services/RuntimeLogger";

interface HostProbe {
  name: string;
  lane: ProviderLane;
  reasoningEffort?: ReasoningEffort;
}

interface HostProbeResult extends HostProbe {
  model: string;
  status: "ok" | "error";
  reply: string;
  error: string;
  errorKind: string;
  elapsedMs: number;
}

interface PublicAiHostProbeResult {
  status: "ok" | "error";
  provider: string;
  target: string;
  model: string;
  apiKey: string;
  apiKeySource: string;
  reply: string;
  error: string;
  errorKind: string;
  elapsedMs: number;
  cached?: boolean;
}

const PUBLIC_AI_HOST_PROBE_TTL_MS = 60_000;
let publicAiHostProbeCache:
  | { at: number; body: PublicAiHostProbeResult }
  | null = null;

function apiKeySource(): string {
  if (process.env.LIGHTNING_API_KEY) return "LIGHTNING_API_KEY";
  if (process.env.LIGHTNING_AI_API_KEY) return "LIGHTNING_AI_API_KEY";
  if (process.env.LIGHTNING_TOKEN) return "LIGHTNING_TOKEN";
  return "none";
}

function maskedApiKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "not set";
  if (trimmed.length <= 12) return `set:${trimmed.length}`;
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

function errorMessageFor(error: any): { error: string; errorKind: string } {
  const message =
    (typeof error?.message === "string" && error.message) ||
    (typeof error === "string" && error) ||
    "";
  return {
    errorKind: error?.constructor?.name || "Error",
    error:
      message ||
      (() => {
        try {
          return JSON.stringify(error);
        } catch {
          return String(error);
        }
      })(),
  };
}

/**
 * POST /api/admin/ai-host/test
 *
 * Round-trips one short prompt through the active provider and returns
 * a structured pass/fail with the actual upstream error message — used
 * by the admin Integrations → AI Host panel to diagnose provider
 * misconfigurations (wrong URL, bad API key, billing, etc.) without
 * tailing the server log.
 */
export function registerAiHostTestRoute(app: Express): void {
  app.get("/api/health/ai-host", async (_req, res) => {
    if (
      publicAiHostProbeCache &&
      Date.now() - publicAiHostProbeCache.at < PUBLIC_AI_HOST_PROBE_TTL_MS
    ) {
      return res.json({ ...publicAiHostProbeCache.body, cached: true });
    }

    const startedAt = Date.now();
    const provider = getActiveProviderName({ lane: "chat" });
    const target = getResolvedTargetName({ lane: "chat" });
    const providerConfig = getProviderRuntimeConfig();
    const model = getActiveProviderDefaultModel(providerConfig);
    const apiKey = maskedApiKey(providerConfig.lightning.apiKey);
    const keySource = apiKeySource();

    try {
      const reply = await generateChatFromProvider(
        [{ role: "user", content: "Reply with READY only." }],
        undefined,
        { lane: "chat", temperature: 0, maxTokens: 16 },
      );
      const body: PublicAiHostProbeResult = {
        status: "ok",
        provider,
        target,
        model,
        apiKey,
        apiKeySource: keySource,
        reply,
        error: "",
        errorKind: "",
        elapsedMs: Date.now() - startedAt,
      };
      publicAiHostProbeCache = { at: Date.now(), body };
      return res.json(body);
    } catch (error: any) {
      const detail = errorMessageFor(error);
      const body: PublicAiHostProbeResult = {
        status: "error",
        provider,
        target,
        model,
        apiKey,
        apiKeySource: keySource,
        reply: "",
        error: detail.error,
        errorKind: detail.errorKind,
        elapsedMs: Date.now() - startedAt,
      };
      publicAiHostProbeCache = { at: Date.now(), body };
      await logRuntimeEvent({
        level: "error",
        source: "server",
        event: "health.ai_host.failed",
        detail: detail.error,
        context: {
          provider,
          target,
          model,
          kind: detail.errorKind,
        },
      });
      return res.status(502).json(body);
    }
  });

  app.post("/api/admin/ai-host/test", isAdmin, async (_req, res) => {
    try {
      const health = await checkModelProviderHealth();
      const provider = getActiveProviderName({ lane: "chat" });
      const target = getResolvedTargetName({ lane: "chat" });
      const providerConfig = getProviderRuntimeConfig();
      const model =
        providerConfig.activeModel || getActiveProviderDefaultModel(providerConfig);
      const probes: HostProbe[] = [
        { name: "default_chat", lane: "chat" },
        { name: "manager_classifier", lane: "manager" },
        { name: "finance_high_reasoning", lane: "finance", reasoningEffort: "high" },
      ];

      const startedAt = Date.now();
      const checks: HostProbeResult[] = [];

      for (const probe of probes) {
        const probeStartedAt = Date.now();
        const deploymentModel = getActiveProviderDefaultModel(providerConfig);
        try {
          const reply = await generateChatFromProvider(
            [{ role: "user", content: "Reply with READY only." }],
            undefined,
            {
              lane: probe.lane,
              reasoningEffort: probe.reasoningEffort,
              temperature: 0,
              maxTokens: 16,
            },
          );
          checks.push({
            ...probe,
            model: deploymentModel,
            status: "ok",
            reply,
            error: "",
            errorKind: "",
            elapsedMs: Date.now() - probeStartedAt,
          });
        } catch (chatError: any) {
          const detail = errorMessageFor(chatError);
          const failed: HostProbeResult = {
            ...probe,
            model: deploymentModel,
            status: "error",
            reply: "",
            error: detail.error,
            errorKind: detail.errorKind,
            elapsedMs: Date.now() - probeStartedAt,
          };
          checks.push(failed);
          await logRuntimeEvent({
            level: "error",
            source: "server",
            event: "admin.ai_host.test_failed",
            detail: failed.error,
            context: {
              provider,
              target,
              model: deploymentModel,
              lane: probe.lane,
              reasoningEffort: probe.reasoningEffort || null,
              kind: failed.errorKind,
            },
          });
        }
      }

      const failedChecks = checks.filter((check) => check.status === "error");
      const status = failedChecks.length ? "failed" : "success";
      const detail = failedChecks.length
        ? failedChecks
            .map((check) => `${check.name} (${check.model}): ${check.error}`)
            .join(" | ")
        : "AI host passed default chat, manager, and finance/high probes.";

      res.json({
        status,
        detail,
        provider,
        target,
        model,
        elapsedMs: Date.now() - startedAt,
        health,
        chat: checks.find((check) => check.name === "manager_classifier") || checks[0],
        checks,
      });
    } catch (error: any) {
      res.status(500).json({
        error:
          error?.message ||
          (() => {
            try {
              return JSON.stringify(error);
            } catch {
              return String(error);
            }
          })(),
      });
    }
  });
}
