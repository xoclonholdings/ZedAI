import type { ProviderLane, ReasoningEffort } from "./provider-interface";

/**
 * Lightning AI is the only provider. The concept of a "provider name"
 * is kept only so downstream diagnostics and admin UI have a stable
 * label — the value is always "lightning".
 */
export type ProviderName = "lightning";

export interface ProviderRuntimeConfig {
  activeProvider: ProviderName;
  activeModel: string;
  /**
   * Lane and reasoning model routing are intentionally disabled. The
   * global Lightning API may still require one model selector, while
   * dedicated deployments can leave it blank.
   */
  laneModels: Partial<Record<ProviderLane, string>>;
  reasoningModels: Partial<Record<ReasoningEffort, string>>;
  laneReasoningModels: Partial<Record<ProviderLane, Partial<Record<ReasoningEffort, string>>>>;
  lightning: {
    baseUrl: string;
    apiKey: string;
    model: string;
    models: string[];
    chatPath: string;
    healthPath: string;
    timeoutMs: number;
    healthTimeoutMs: number;
  };
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function buildLaneModels(): Partial<Record<ProviderLane, string>> {
  return {};
}

function buildReasoningModels(): Partial<Record<ReasoningEffort, string>> {
  return {};
}

function buildLaneReasoningModels(): Partial<Record<ProviderLane, Partial<Record<ReasoningEffort, string>>>> {
  return {};
}

const DEFAULT_LIGHTNING_BASE_URL = "https://lightning.ai/api/v1";
// Primary model first, fallback(s) after. LightningProvider tries each
// model in this order and moves to the next on any failed response
// (including a low-balance/quota error from Lightning), so listing
// gemma-4 first with gpt-oss-120b after makes gpt-oss-120b the automatic
// fallback.
const DEFAULT_LIGHTNING_MODELS = [
  "lightning-ai/gemma-4-31B-it",
  "lightning-ai/gpt-oss-120b",
];
const LIGHTNING_DEPLOYMENT_DEFAULT_LABEL = "Lightning deployment default";

function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export function getProviderRuntimeConfig(): ProviderRuntimeConfig {
  const baseUrl = trimTrailingSlash(
    process.env.LIGHTNING_BASE_URL ||
      process.env.LIGHTNING_AI_URL ||
      DEFAULT_LIGHTNING_BASE_URL,
  );
  const usesDefaultModelApi = baseUrl === DEFAULT_LIGHTNING_BASE_URL;
  const configuredModels = uniqueNonEmpty([
    ...(process.env.LIGHTNING_MODELS || "")
      .split(",")
      .map((value) => value.trim()),
    process.env.LIGHTNING_MODEL || "",
  ]);
  const lightningModels =
    configuredModels.length > 0
      ? configuredModels
      : usesDefaultModelApi
        ? DEFAULT_LIGHTNING_MODELS
        : [];
  const lightningModel = lightningModels[0] || "";
  return {
    activeProvider: "lightning",
    activeModel: lightningModels.length
      ? lightningModels.join(", ")
      : LIGHTNING_DEPLOYMENT_DEFAULT_LABEL,
    laneModels: buildLaneModels(),
    reasoningModels: buildReasoningModels(),
    laneReasoningModels: buildLaneReasoningModels(),
    lightning: {
      baseUrl,
      apiKey:
        process.env.LIGHTNING_API_KEY ||
        process.env.LIGHTNING_AI_API_KEY ||
        process.env.LIGHTNING_TOKEN ||
        "",
      model: lightningModel,
      models: lightningModels,
      chatPath: process.env.LIGHTNING_CHAT_PATH || "/chat/completions",
      healthPath: process.env.LIGHTNING_HEALTH_PATH || "/models",
      timeoutMs: Number(process.env.LIGHTNING_TIMEOUT_MS || 45000),
      // Health probes must fail fast — the runtime footer pings them
      // and a hung endpoint should not stall the UI for 45s.
      healthTimeoutMs: Number(process.env.LIGHTNING_HEALTH_TIMEOUT_MS || 8000),
    },
  };
}

/**
 * Returns the single Lightning model used by diagnostics, or the
 * deployment-default label when no model selector is sent.
 */
export function getActiveProviderDefaultModel(
  config: ProviderRuntimeConfig = getProviderRuntimeConfig(),
): string {
  return config.lightning.models.length
    ? config.lightning.models.join(", ")
    : LIGHTNING_DEPLOYMENT_DEFAULT_LABEL;
}
