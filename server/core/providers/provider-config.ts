export type ProviderName = "ollama" | "openai" | "claude" | "claw-temp";

export interface ProviderRuntimeConfig {
  activeProvider: ProviderName;
  activeModel?: string;
  targets: Record<string, { provider: ProviderName; model: string }>;
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

  if (
    normalized === "claw" ||
    normalized === "claw-temp" ||
    normalized === "colab" ||
    normalized === "remote"
  ) {
    return "claw-temp";
  }

  return null;
}

export function getProviderRuntimeConfig(): ProviderRuntimeConfig {
  const remoteInferenceUrl = trimTrailingSlash(process.env.REMOTE_INFERENCE_URL || "");
  const remoteInferenceMode = (process.env.REMOTE_INFERENCE_MODE || "ollama")
    .trim()
    .toLowerCase();

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

  const activeModel = process.env.MODEL_NAME || process.env.ZED_MODEL_NAME || undefined;

  const ollamaModel = process.env.OLLAMA_MODEL || process.env.MODEL_NAME || "qwen2.5:7b";
  const openaiModel = process.env.OPENAI_MODEL || process.env.MODEL_NAME || "gpt-4o-mini";
  const claudeModel =
    process.env.CLAUDE_MODEL || process.env.MODEL_NAME || "claude-3-5-sonnet-latest";
  const clawModel =
    process.env.CLAW_MODEL || process.env.MODEL_NAME || process.env.OLLAMA_MODEL || "qwen2.5:7b";

  return {
    activeProvider,
    activeModel,
    targets: {
      [ollamaModel]: { provider: "ollama", model: ollamaModel },
      [openaiModel]: { provider: "openai", model: openaiModel },
      [claudeModel]: { provider: "claude", model: claudeModel },
      [clawModel]: { provider: "claw-temp", model: clawModel },
    },
    ollama: {
      baseUrl: trimTrailingSlash(
        process.env.OLLAMA_URL || remoteInferenceUrl || "http://localhost:11434",
      ),
      model: ollamaModel,
      fallbackModel: process.env.OLLAMA_FALLBACK_MODEL || "llama3.2",
    },
    openai: {
      baseUrl: trimTrailingSlash(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"),
      apiKey: process.env.OPENAI_API_KEY || "",
      model: openaiModel,
    },
    claude: {
      baseUrl: trimTrailingSlash(
        process.env.CLAUDE_BASE_URL ||
          process.env.ANTHROPIC_BASE_URL ||
          "https://api.anthropic.com/v1",
      ),
      apiKey: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || "",
      model: claudeModel,
    },
    clawTemp: {
      baseUrl: trimTrailingSlash(process.env.CLAW_BASE_URL || remoteInferenceUrl || ""),
      model: clawModel,
      chatPath: process.env.CLAW_CHAT_PATH || "/chat",
      healthPath: process.env.CLAW_HEALTH_PATH || "/health",
      timeoutMs: Number(process.env.REMOTE_INFERENCE_TIMEOUT_MS || process.env.CLAW_TIMEOUT_MS || 45000),
      mode: remoteInferenceMode,
    },
  };
}