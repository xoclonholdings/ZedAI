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
   * Model routing is intentionally disabled for Lightning dedicated
   * deployments. Lanes still exist for prompting / generation params,
   * but they do not select models.
   */
  laneModels: Partial<Record<ProviderLane, string>>;
  reasoningModels: Partial<Record<ReasoningEffort, string>>;
  laneReasoningModels: Partial<Record<ProviderLane, Partial<Record<ReasoningEffort, string>>>>;
  lightning: {
    baseUrl: string;
    apiKey: string;
    model: string;
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
const LIGHTNING_DEPLOYMENT_DEFAULT_LABEL = "Lightning deployment default";

export function getProviderRuntimeConfig(): ProviderRuntimeConfig {
  const baseUrl = trimTrailingSlash(
    process.env.LIGHTNING_BASE_URL ||
      process.env.LIGHTNING_AI_URL ||
      DEFAULT_LIGHTNING_BASE_URL,
  );
  return {
    activeProvider: "lightning",
    activeModel: LIGHTNING_DEPLOYMENT_DEFAULT_LABEL,
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
      model: "",
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
 * Returns the deployment-default model label used by diagnostics. Zed
 * does not send this as a model selector to Lightning.
 */
export function getActiveProviderDefaultModel(
  config: ProviderRuntimeConfig = getProviderRuntimeConfig(),
): string {
  return LIGHTNING_DEPLOYMENT_DEFAULT_LABEL;
}
