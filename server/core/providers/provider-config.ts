import type { ComputeTargetName, ExecutionLane } from "./provider-interface";

export type ProviderName = "ollama" | "openai" | "claude" | "claw-temp";

export interface ProviderTargetConfig {
  name: ComputeTargetName;
  provider: ProviderName;
  model: string;
  baseUrl: string;
  fallbackModel?: string;
  apiKey?: string;
  chatPath?: string;
  healthPath?: string;
  timeoutMs?: number;
  mode?: string;
}

export interface ProviderRuntimeConfig {
  activeProvider: ProviderName;
  activeModel?: string;
  routing: Record<ExecutionLane | "default", ComputeTargetName>;
  targets: Record<ComputeTargetName, ProviderTargetConfig>;
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

function normalizeTargetName(value?: string): ComputeTargetName | null {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "local") return "local";
  if (normalized === "persistent" || normalized === "oracle" || normalized === "server") return "persistent";
  if (normalized === "burst" || normalized === "lightning" || normalized === "gpu") return "burst";
  return null;
}

function getLegacyActiveProvider(remoteInferenceUrl: string, remoteInferenceMode: string): ProviderName {
  const configuredProvider =
    normalizeProviderName(process.env.MODEL_PROVIDER) || normalizeProviderName(process.env.ZED_MODEL_PROVIDER);

  return (
    configuredProvider ||
    (remoteInferenceUrl ? (remoteInferenceMode === "ollama" ? "ollama" : "claw-temp") : "ollama")
  );
}

function buildTarget(
  name: ComputeTargetName,
  defaults: ProviderTargetConfig,
  envPrefix: string,
  legacyBaseUrl?: string,
): ProviderTargetConfig {
  const provider =
    normalizeProviderName(process.env[`${envPrefix}_PROVIDER`]) ||
    normalizeProviderName(process.env[`${envPrefix}_MODE`]) ||
    defaults.provider;

  return {
    name,
    provider,
    model: process.env[`${envPrefix}_MODEL`] || defaults.model,
    baseUrl: trimTrailingSlash(process.env[`${envPrefix}_BASE_URL`] || legacyBaseUrl || defaults.baseUrl || ""),
    fallbackModel: process.env[`${envPrefix}_FALLBACK_MODEL`] || defaults.fallbackModel,
    apiKey: process.env[`${envPrefix}_API_KEY`] || defaults.apiKey,
    chatPath: process.env[`${envPrefix}_CHAT_PATH`] || defaults.chatPath,
    healthPath: process.env[`${envPrefix}_HEALTH_PATH`] || defaults.healthPath,
    timeoutMs: Number(process.env[`${envPrefix}_TIMEOUT_MS`] || defaults.timeoutMs || 45000),
    mode: process.env[`${envPrefix}_RUNNER_MODE`] || defaults.mode,
  };
}

export function getProviderRuntimeConfig(): ProviderRuntimeConfig {
  const remoteInferenceUrl = trimTrailingSlash(process.env.REMOTE_INFERENCE_URL || "");
  const remoteInferenceMode = (process.env.REMOTE_INFERENCE_MODE || "ollama").trim().toLowerCase();
  const activeProvider = getLegacyActiveProvider(remoteInferenceUrl, remoteInferenceMode);
  const activeModel = process.env.MODEL_NAME || process.env.ZED_MODEL_NAME || undefined;

  const ollama = {
    baseUrl: trimTrailingSlash(process.env.OLLAMA_URL || remoteInferenceUrl || "http://localhost:11434"),
    model: process.env.OLLAMA_MODEL || process.env.MODEL_NAME || "qwen2.5:7b",
    fallbackModel: process.env.OLLAMA_FALLBACK_MODEL || "llama3.2",
  };
  const openai = {
    baseUrl: trimTrailingSlash(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"),
    apiKey: process.env.OPENAI_API_KEY || "",
    model: process.env.OPENAI_MODEL || process.env.MODEL_NAME || "gpt-4o-mini",
  };
  const claude = {
    baseUrl: trimTrailingSlash(
      process.env.CLAUDE_BASE_URL || process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1",
    ),
    apiKey: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || "",
    model: process.env.CLAUDE_MODEL || process.env.MODEL_NAME || "claude-3-5-sonnet-latest",
  };
  const clawTemp = {
    baseUrl: trimTrailingSlash(process.env.CLAW_BASE_URL || remoteInferenceUrl || ""),
    model: process.env.CLAW_MODEL || process.env.MODEL_NAME || process.env.OLLAMA_MODEL || "qwen2.5:7b",
    chatPath: process.env.CLAW_CHAT_PATH || "/chat",
    healthPath: process.env.CLAW_HEALTH_PATH || "/health",
    timeoutMs: Number(process.env.REMOTE_INFERENCE_TIMEOUT_MS || process.env.CLAW_TIMEOUT_MS || 45000),
    mode: remoteInferenceMode,
  };

  const targets: Record<ComputeTargetName, ProviderTargetConfig> = {
    local: buildTarget(
      "local",
      {
        name: "local",
        provider: "ollama",
        model: ollama.model,
        baseUrl: ollama.baseUrl,
        fallbackModel: ollama.fallbackModel,
      },
      "ZED_LOCAL",
      ollama.baseUrl,
    ),
    persistent: buildTarget(
      "persistent",
      {
        name: "persistent",
        provider: activeProvider,
        model:
          activeProvider === "openai"
            ? openai.model
            : activeProvider === "claude"
              ? claude.model
              : activeProvider === "claw-temp"
                ? clawTemp.model
                : ollama.model,
        baseUrl:
          activeProvider === "openai"
            ? openai.baseUrl
            : activeProvider === "claude"
              ? claude.baseUrl
              : activeProvider === "claw-temp"
                ? clawTemp.baseUrl
                : ollama.baseUrl,
        fallbackModel: ollama.fallbackModel,
        apiKey: activeProvider === "openai" ? openai.apiKey : activeProvider === "claude" ? claude.apiKey : "",
        chatPath: clawTemp.chatPath,
        healthPath: clawTemp.healthPath,
        timeoutMs: clawTemp.timeoutMs,
        mode: clawTemp.mode,
      },
      "ZED_PERSISTENT",
    ),
    burst: buildTarget(
      "burst",
      {
        name: "burst",
        provider: remoteInferenceUrl ? (remoteInferenceMode === "ollama" ? "ollama" : "claw-temp") : activeProvider,
        model: clawTemp.model,
        baseUrl: clawTemp.baseUrl || ollama.baseUrl,
        fallbackModel: ollama.fallbackModel,
        apiKey: activeProvider === "openai" ? openai.apiKey : activeProvider === "claude" ? claude.apiKey : "",
        chatPath: clawTemp.chatPath,
        healthPath: clawTemp.healthPath,
        timeoutMs: clawTemp.timeoutMs,
        mode: clawTemp.mode,
      },
      "ZED_BURST",
      clawTemp.baseUrl,
    ),
  };

  const routing: Record<ExecutionLane | "default", ComputeTargetName> = {
    default: normalizeTargetName(process.env.ZED_ROUTE_DEFAULT) || "local",
    chat: normalizeTargetName(process.env.ZED_ROUTE_CHAT) || "local",
    operations: normalizeTargetName(process.env.ZED_ROUTE_OPERATIONS) || "local",
    business: normalizeTargetName(process.env.ZED_ROUTE_BUSINESS) || "persistent",
    finance: normalizeTargetName(process.env.ZED_ROUTE_FINANCE) || "burst",
    research: normalizeTargetName(process.env.ZED_ROUTE_RESEARCH) || "burst",
    admin: normalizeTargetName(process.env.ZED_ROUTE_ADMIN) || "local",
    embedding: normalizeTargetName(process.env.ZED_ROUTE_EMBEDDING) || "local",
  };

  return {
    activeProvider,
    activeModel,
    routing,
    targets,
    ollama,
    openai,
    claude,
    clawTemp,
  };
}
