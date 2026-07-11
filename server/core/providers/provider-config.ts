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
   * Per-lane model overrides. Set via env vars:
   *   MODEL_CHAT, MODEL_MANAGER, MODEL_OPERATIONS,
   *   MODEL_RESEARCH, MODEL_BUSINESS, MODEL_FINANCE,
   *   MODEL_STRATEGY, MODEL_ADMIN.
   */
  laneModels: Partial<Record<ProviderLane, string>>;
  reasoningModels: Partial<Record<ReasoningEffort, string>>;
  laneReasoningModels: Partial<Record<ProviderLane, Partial<Record<ReasoningEffort, string>>>>;
  lightning: {
    baseUrl: string;
    model: string;
    apiKey: string;
    chatPath: string;
    healthPath: string;
    timeoutMs: number;
  };
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function laneEnv(lane: ProviderLane): string | undefined {
  const upper = lane.toUpperCase();
  return (
    process.env[`MODEL_${upper}`]?.trim() ||
    process.env[`LANE_${upper}_MODEL`]?.trim() ||
    undefined
  );
}

const PROVIDER_LANES: ProviderLane[] = [
  "chat",
  "manager",
  "operations",
  "research",
  "business",
  "finance",
  "strategy",
  "admin",
];

const REASONING_EFFORTS: ReasoningEffort[] = ["low", "medium", "high", "deep"];

function buildLaneModels(): Partial<Record<ProviderLane, string>> {
  const out: Partial<Record<ProviderLane, string>> = {};
  for (const lane of PROVIDER_LANES) {
    const value = laneEnv(lane);
    if (value) out[lane] = value;
  }
  return out;
}

function reasoningEnv(effort: ReasoningEffort): string | undefined {
  const upper = effort.toUpperCase();
  return (
    process.env[`MODEL_REASONING_${upper}`]?.trim() ||
    process.env[`REASONING_${upper}_MODEL`]?.trim() ||
    undefined
  );
}

function laneReasoningEnv(lane: ProviderLane, effort: ReasoningEffort): string | undefined {
  const upperLane = lane.toUpperCase();
  const upperEffort = effort.toUpperCase();
  return (
    process.env[`MODEL_${upperLane}_${upperEffort}`]?.trim() ||
    process.env[`LANE_${upperLane}_${upperEffort}_MODEL`]?.trim() ||
    undefined
  );
}

function buildReasoningModels(): Partial<Record<ReasoningEffort, string>> {
  const out: Partial<Record<ReasoningEffort, string>> = {};
  for (const effort of REASONING_EFFORTS) {
    const value = reasoningEnv(effort);
    if (value) out[effort] = value;
  }
  return out;
}

function buildLaneReasoningModels(): Partial<Record<ProviderLane, Partial<Record<ReasoningEffort, string>>>> {
  const out: Partial<Record<ProviderLane, Partial<Record<ReasoningEffort, string>>>> = {};
  for (const lane of PROVIDER_LANES) {
    const laneOut: Partial<Record<ReasoningEffort, string>> = {};
    for (const effort of REASONING_EFFORTS) {
      const value = laneReasoningEnv(lane, effort);
      if (value) laneOut[effort] = value;
    }
    if (Object.keys(laneOut).length > 0) out[lane] = laneOut;
  }
  return out;
}

/**
 * Resolve the model name to use for a given lane. Priority:
 *   1. Lane + reasoning override (MODEL_FINANCE_DEEP, MODEL_RESEARCH_HIGH, ...)
 *   2. Reasoning override (MODEL_REASONING_DEEP, MODEL_REASONING_HIGH, ...)
 *   3. Explicit per-lane env override (MODEL_CHAT, MODEL_OPERATIONS, ...)
 *   4. Global OPENAI_MODEL / MODEL_NAME / ZED_MODEL_NAME
 *   5. The Lightning-configured fallback.
 */
export function resolveModelForLane(
  lane: ProviderLane | undefined,
  fallback: string,
  reasoningEffort?: ReasoningEffort,
): string {
  if (lane && reasoningEffort) {
    const laneReasoningValue = laneReasoningEnv(lane, reasoningEffort);
    if (laneReasoningValue) return laneReasoningValue;
  }
  if (reasoningEffort) {
    const reasoningValue = reasoningEnv(reasoningEffort);
    if (reasoningValue) return reasoningValue;
  }
  if (lane) {
    const laneValue = laneEnv(lane);
    if (laneValue) return laneValue;
  }
  return (
    process.env.OPENAI_MODEL?.trim() ||
    process.env.MODEL_NAME?.trim() ||
    process.env.ZED_MODEL_NAME?.trim() ||
    fallback
  );
}

export function getProviderRuntimeConfig(): ProviderRuntimeConfig {
  const openAiCompatibleBaseUrl = process.env.OPENAI_BASE_URL?.trim() || "";
  const baseUrl = trimTrailingSlash(
    process.env.LIGHTNING_BASE_URL ||
      openAiCompatibleBaseUrl ||
      process.env.REMOTE_INFERENCE_URL ||
      "",
  );
  const model =
    process.env.LIGHTNING_MODEL ||
    process.env.OPENAI_MODEL ||
    process.env.MODEL_NAME ||
    process.env.ZED_MODEL_NAME ||
    "";
  const apiKey =
    process.env.LIGHTNING_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.REMOTE_INFERENCE_API_KEY?.trim() ||
    "";
  const activeModel = model;

  return {
    activeProvider: "lightning",
    activeModel,
    laneModels: buildLaneModels(),
    reasoningModels: buildReasoningModels(),
    laneReasoningModels: buildLaneReasoningModels(),
    lightning: {
      baseUrl,
      model,
      apiKey,
      chatPath: process.env.LIGHTNING_CHAT_PATH || (openAiCompatibleBaseUrl ? "/chat/completions" : "/chat"),
      healthPath: process.env.LIGHTNING_HEALTH_PATH || (openAiCompatibleBaseUrl ? "/models" : "/health"),
      timeoutMs: Number(
        process.env.LIGHTNING_TIMEOUT_MS ||
          process.env.REMOTE_INFERENCE_TIMEOUT_MS ||
          45000,
      ),
    },
  };
}

/**
 * Returns the configured default model — the value used when a
 * request doesn't carry a per-lane override. Useful for diagnostics
 * endpoints and admin UI.
 */
export function getActiveProviderDefaultModel(
  config: ProviderRuntimeConfig = getProviderRuntimeConfig(),
): string {
  return config.lightning.model;
}
