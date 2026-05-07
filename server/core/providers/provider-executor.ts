import { ClaudeProvider } from "./claude-provider";
import { ClawTempProvider } from "./claw-provider-temp";
import { OpenAIProvider } from "./openai-provider";
import { OllamaProvider } from "./ollama-provider";
import { getProviderRuntimeConfig } from "./provider-config";
import { splitIntoTokens } from "./provider-helpers";
import type {
  ModelProvider,
  ProviderExecutionOptions,
  ProviderHealth,
  ProviderMessage,
} from "./provider-interface";

function getActiveProvider(): ModelProvider {
  const config = getProviderRuntimeConfig();

  switch (config.activeProvider) {
    case "openai":
      return new OpenAIProvider();
    case "claude":
      return new ClaudeProvider();
    case "claw-temp":
      return new ClawTempProvider();
    case "ollama":
    default:
      return new OllamaProvider();
  }
}

export function getActiveProviderName(_options?: ProviderExecutionOptions): string {
  return getProviderRuntimeConfig().activeProvider;
}

export function getResolvedTargetName(_options?: ProviderExecutionOptions): string {
  const config = getProviderRuntimeConfig();

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

export function getProviderRoutingSummary() {
  const config = getProviderRuntimeConfig();
  const activeProvider = config.activeProvider;

  return {
    activeProvider,
    activeModel: getResolvedTargetName(),
    routing: {
      chat: activeProvider,
      operations: activeProvider,
      business: activeProvider,
      finance: activeProvider,
      research: activeProvider,
    },
  };
}

export async function executeProviderPrompt(
  prompt: string,
  options?: ProviderExecutionOptions,
): Promise<string> {
  return getActiveProvider().executePrompt(prompt, options);
}

export async function executeProviderChat(
  messages: ProviderMessage[],
  options?: ProviderExecutionOptions,
): Promise<string> {
  return getActiveProvider().executeChat(messages, options);
}

export async function streamProviderChat(
  messages: ProviderMessage[],
  options: ProviderExecutionOptions | undefined,
  onToken: (token: string) => void,
  onDone: () => void | Promise<void>,
  onError: (err: Error) => void | Promise<void>,
): Promise<void> {
  const provider = getActiveProvider();

  if (provider.streamChat) {
    await provider.streamChat(messages, options, onToken, onDone, onError);
    return;
  }

  try {
    const reply = await provider.executeChat(messages, options);
    for (const token of splitIntoTokens(reply)) {
      onToken(token);
    }
    await onDone();
  } catch (error) {
    await onError(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function checkActiveProviderHealth(
  _options?: ProviderExecutionOptions,
): Promise<ProviderHealth> {
  return getActiveProvider().checkHealth();
}