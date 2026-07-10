/**
 * Lightning AI is the only provider. The concept of a "provider name"
 * is kept only so downstream diagnostics and admin UI have a stable
 * label — the value is always "lightning".
 */
export type ProviderName = "lightning";

export type ProviderLane =
  | "chat"
  | "manager"
  | "operations"
  | "research"
  | "business"
  | "finance";

export interface ProviderRuntimeConfig {
  activeProvider: ProviderName;
  activeModel: string;
  /**
   * Per-lane model overrides. Set via env vars:
   *   MODEL_CHAT, MODEL_MANAGER, MODEL_OPERATIONS,
   *   MODEL_RESEARCH, MODEL_BUSINESS, MODEL_FINANCE.
   * When a lane has no explicit override, the runner falls back to
   * MODEL_NAME / LIGHTNING_MODEL / a built-in default.
   *
   * This is where "switch based on reasoning need" lives: point the
   * research lane at a heavier model, keep chat on something fast.
   */
  laneModels: Partial<Record<ProviderLane, string>>;
  lightning: {
    baseUrl: string;
    apiKey: string;
    model: string;
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

function buildLaneModels(): Partial<Record<ProviderLane, string>> {
  const lanes: ProviderLane[] = [
    "chat",
    "manager",
    "operations",
    "research",
    "business",
    "finance",
  ];
  const out: Partial<Record<ProviderLane, string>> = {};
  for (const lane of lanes) {
    const value = laneEnv(lane);
    if (value) out[lane] = value;
  }
  return out;
}

/**
 * Resolve the model name to use for a given lane. Priority:
 *   1. Explicit per-lane env override (MODEL_CHAT, MODEL_OPERATIONS, ...)
 *   2. Global MODEL_NAME / ZED_MODEL_NAME
 *   3. The Lightning-configured fallback.
 */
export function resolveModelForLane(
  lane: ProviderLane | undefined,
  fallback: string,
): string {
  if (lane) {
    const laneValue = laneEnv(lane);
    if (laneValue) return laneValue;
  }
  return (
    process.env.MODEL_NAME?.trim() ||
    process.env.ZED_MODEL_NAME?.trim() ||
    fallback
  );
}

export function getProviderRuntimeConfig(): ProviderRuntimeConfig {
  // Lightning AI's public endpoint speaks the OpenAI Chat Completions
  // protocol. Users who set it up with the OpenAI SDK naming (OPENAI_*)
  // and users who set it up with the Lightning naming (LIGHTNING_*)
  // both work — nothing has to be renamed on redeploy.
  const baseUrl = trimTrailingSlash(
    process.env.LIGHTNING_BASE_URL ||
      process.env.OPENAI_BASE_URL ||
      process.env.REMOTE_INFERENCE_URL ||
      "",
  );
  const model =
    process.env.LIGHTNING_MODEL ||
    process.env.OPENAI_MODEL ||
    process.env.MODEL_NAME ||
    process.env.ZED_MODEL_NAME ||
    "";
  const activeModel = model;

  return {
    activeProvider: "lightning",
    activeModel,
    laneModels: buildLaneModels(),
    lightning: {
      baseUrl,
      apiKey: (
        process.env.LIGHTNING_API_KEY ||
        process.env.LIGHTNING_TOKEN ||
        process.env.OPENAI_API_KEY ||
        process.env.REMOTE_INFERENCE_TOKEN ||
        ""
      ).trim(),
      model,
      // Default to the OpenAI-compat path since that's what the public
      // Lightning AI endpoint serves. Custom runners can override.
      chatPath: process.env.LIGHTNING_CHAT_PATH || "/chat/completions",
      healthPath: process.env.LIGHTNING_HEALTH_PATH || "/models",
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
