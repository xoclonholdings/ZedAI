export type ProviderName = "ollama" | "openai" | "claude" | "claw-temp";

export type ProviderLane =
  | "chat"
  | "manager"
  | "operations"
  | "research"
  | "business"
  | "finance";

export interface ProviderRuntimeConfig {
  activeProvider: ProviderName;
  activeModel?: string;
  /**
   * Per-lane model overrides. Set via env vars:
   *   MODEL_CHAT, MODEL_MANAGER, MODEL_OPERATIONS,
   *   MODEL_RESEARCH, MODEL_BUSINESS, MODEL_FINANCE.
   * When a lane has no explicit override, the provider falls back to
   * the per-provider default (OPENAI_MODEL / OLLAMA_MODEL / etc.) and
   * finally to MODEL_NAME.
   */
  laneModels: Partial<Record<ProviderLane, string>>;
  ollama: {
    baseUrl: string;
    model: string;
    fallbackModel: string;
  };
  openai: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
  claude: {
    baseUrl: string;
    apiKey: string;
    model: string;
  };
  clawTemp: {
    baseUrl: string;
    model: string;
    chatPath: string;
    healthPath: string;
    timeoutMs: number;
    mode: string;
  };
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeProviderName(value?: string): ProviderName | null {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "ollama") return "ollama";
  if (normalized === "openai") return "openai";
  if (normalized === "claude" || normalized === "anthropic") return "claude";
  if (normalized === "claw" || normalized === "claw-temp" || normalized === "colab" || normalized === "remote") {
    return "claw-temp";
  }
  return null;
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
 *   2. The provider's own default (OPENAI_MODEL, OLLAMA_MODEL, etc.)
 *   3. Global MODEL_NAME
 *   4. The provider's hard-coded fallback.
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
  const remoteInferenceUrl = trimTrailingSlash(process.env.REMOTE_INFERENCE_URL || "");
  const remoteInferenceMode = (process.env.REMOTE_INFERENCE_MODE || "ollama").trim().toLowerCase();

  const configuredProvider =
    normalizeProviderName(process.env.MODEL_PROVIDER) ||
    normalizeProviderName(process.env.ZED_MODEL_PROVIDER);

  const activeProvider =
    configuredProvider ||
    (remoteInferenceUrl
      ? remoteInferenceMode === "ollama"
        ? "ollama"
        : "claw-temp"
      : "ollama");

  return {
    activeProvider,
    activeModel: process.env.MODEL_NAME || process.env.ZED_MODEL_NAME || undefined,
    laneModels: buildLaneModels(),
    ollama: {
      baseUrl: trimTrailingSlash(process.env.OLLAMA_URL || remoteInferenceUrl || "http://localhost:11434"),
      model: process.env.OLLAMA_MODEL || process.env.MODEL_NAME || "qwen2.5:7b",
      fallbackModel: process.env.OLLAMA_FALLBACK_MODEL || "llama3.2",
    },
    openai: {
      baseUrl: trimTrailingSlash(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"),
      apiKey: process.env.OPENAI_API_KEY || "",
      model: process.env.OPENAI_MODEL || process.env.MODEL_NAME || "gpt-4o-mini",
    },
    claude: {
      baseUrl: trimTrailingSlash(process.env.CLAUDE_BASE_URL || process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1"),
      apiKey: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || "",
      model: process.env.CLAUDE_MODEL || process.env.MODEL_NAME || "claude-3-5-sonnet-latest",
    },
    clawTemp: {
      baseUrl: trimTrailingSlash(process.env.CLAW_BASE_URL || remoteInferenceUrl || ""),
      model: process.env.CLAW_MODEL || process.env.MODEL_NAME || process.env.OLLAMA_MODEL || "qwen2.5:7b",
      chatPath: process.env.CLAW_CHAT_PATH || "/chat",
      healthPath: process.env.CLAW_HEALTH_PATH || "/health",
      timeoutMs: Number(process.env.REMOTE_INFERENCE_TIMEOUT_MS || process.env.CLAW_TIMEOUT_MS || 45000),
      mode: remoteInferenceMode,
    },
  };
}

/**
 * Returns the configured default model for the active provider — the
 * value used when a request doesn't carry a per-lane override. Useful
 * for diagnostics endpoints and admin UI.
 */
export function getActiveProviderDefaultModel(
  config: ProviderRuntimeConfig = getProviderRuntimeConfig(),
): string {
  switch (config.activeProvider) {
    case "openai":
      return config.openai.model;
    case "claude":
      return config.claude.model;
    case "claw-temp":
      return config.clawTemp.model;
    case "ollama":
    default:
      return config.ollama.model;
  }
}
