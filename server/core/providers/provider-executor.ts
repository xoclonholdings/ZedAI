import { ClaudeProvider } from "./claude-provider";
import { ClawTempProvider } from "./claw-provider-temp";
import { OpenAIProvider } from "./openai-provider";
import { OllamaProvider } from "./ollama-provider";
import { getProviderRuntimeConfig, type ProviderName } from "./provider-config";
import { splitIntoTokens } from "./provider-helpers";
import type { ModelProvider, ProviderExecutionOptions, ProviderHealth, ProviderMessage } from "./provider-interface";

function buildProvider(name: ProviderName): ModelProvider {
  switch (name) {
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

function getActiveProvider(): ModelProvider {
  return buildProvider(getProviderRuntimeConfig().activeProvider);
}

export function getActiveProviderName(_options?: ProviderExecutionOptions): string {
  return getProviderRuntimeConfig().activeProvider;
}

/**
 * Returns the URL the active provider will hit for a given lane. Lanes
 * aren't fully implemented yet — they're a forward-looking knob — so
 * the resolved target is currently identical for every lane.
 */
export function getResolvedTargetName(_options?: ProviderExecutionOptions): string {
  const config = getProviderRuntimeConfig();
  switch (config.activeProvider) {
    case "ollama":
      return config.ollama.baseUrl;
    case "openai":
      return config.openai.baseUrl;
    case "claude":
      return config.claude.baseUrl;
    case "claw-temp":
      return config.clawTemp.baseUrl;
    default:
      return config.ollama.baseUrl;
  }
}

export function getProviderRoutingSummary() {
  const config = getProviderRuntimeConfig();
  const target = getResolvedTargetName();
  return {
    active: config.activeProvider,
    target,
    routing: {
      chat: target,
      operations: target,
      business: target,
      finance: target,
      research: target,
    },
  };
}

export async function executeProviderPrompt(prompt: string, options?: ProviderExecutionOptions): Promise<string> {
  return getActiveProvider().executePrompt(prompt, options);
}

export async function executeProviderChat(
  messages: ProviderMessage[],
  options?: ProviderExecutionOptions,
): Promise<string> {
  return getActiveProvider().executeChat(messages, options);
}

/**
 * No silent fallback to local Ollama. If the active provider fails,
 * the caller sees the real error from upstream — caller decides how
 * to surface it.
 */
export async function streamProviderChat(
  messages: ProviderMessage[],
  options: ProviderExecutionOptions | undefined,
  onToken: (token: string) => void,
  onDone: () => void | Promise<void>,
  onError: (err: Error) => void | Promise<void>,
): Promise<void> {
  const provider = getActiveProvider();

  if (provider.streamChat) {
    let streamFailed: Error | null = null;
    try {
      await provider.streamChat(
        messages,
        options,
        onToken,
        onDone,
        (err) => {
          streamFailed = err;
        },
      );
    } catch (err) {
      streamFailed = err instanceof Error ? err : new Error(String(err));
    }
    if (streamFailed) await onError(streamFailed);
    return;
  }

  // Provider doesn't natively support streaming — split a single response
  // into pseudo-tokens. Same single-attempt semantics: fail surfaces upstream.
  try {
    const reply = await provider.executeChat(messages, options);
    for (const token of splitIntoTokens(reply)) onToken(token);
    await onDone();
  } catch (err) {
    await onError(err instanceof Error ? err : new Error(String(err)));
  }
}

export async function checkActiveProviderHealth(_options?: ProviderExecutionOptions): Promise<ProviderHealth> {
  return getActiveProvider().checkHealth();
}
