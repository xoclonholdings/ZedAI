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

/**
 * Provider chosen for an execution attempt. The first entry is the
 * active provider; the remainder are graceful fallbacks tried in order
 * when the active one throws (e.g. a misconfigured remote returns 404).
 */
function buildProviderChain(): ProviderName[] {
  const config = getProviderRuntimeConfig();
  const active = config.activeProvider;
  const chain: ProviderName[] = [active];

  // If we're set to claw-temp / openai / claude but Ollama is reachable,
  // fall back to Ollama so chat keeps working even when the configured
  // remote is broken. We do NOT fall back the other direction (Ollama
  // problems shouldn't suddenly mint OpenAI calls and rack up cost).
  if (active !== "ollama" && config.ollama.baseUrl) {
    chain.push("ollama");
  }
  return chain;
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

async function withFallback<T>(
  run: (provider: ModelProvider, name: ProviderName) => Promise<T>,
  context: string,
): Promise<T> {
  const chain = buildProviderChain();
  let lastError: unknown = null;
  for (const name of chain) {
    try {
      return await run(buildProvider(name), name);
    } catch (err) {
      lastError = err;
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(
        `[provider-executor] ${context} via '${name}' failed: ${reason}${
          chain.length > 1 ? "; trying next provider in chain" : ""
        }`,
      );
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`All providers failed for ${context}`);
}

export async function executeProviderPrompt(prompt: string, options?: ProviderExecutionOptions): Promise<string> {
  return withFallback((provider) => provider.executePrompt(prompt, options), "prompt");
}

export async function executeProviderChat(
  messages: ProviderMessage[],
  options?: ProviderExecutionOptions,
): Promise<string> {
  return withFallback((provider) => provider.executeChat(messages, options), "chat");
}

export async function streamProviderChat(
  messages: ProviderMessage[],
  options: ProviderExecutionOptions | undefined,
  onToken: (token: string) => void,
  onDone: () => void | Promise<void>,
  onError: (err: Error) => void | Promise<void>,
): Promise<void> {
  const chain = buildProviderChain();

  for (let i = 0; i < chain.length; i++) {
    const name = chain[i];
    const provider = buildProvider(name);
    const isLast = i === chain.length - 1;

    if (provider.streamChat) {
      let streamFailed: Error | null = null;
      let tokenSeen = false;
      try {
        await provider.streamChat(
          messages,
          options,
          (token) => {
            tokenSeen = true;
            onToken(token);
          },
          onDone,
          (err) => {
            streamFailed = err;
          },
        );
      } catch (err) {
        streamFailed = err instanceof Error ? err : new Error(String(err));
      }

      if (!streamFailed) return;
      if (tokenSeen || isLast) {
        await onError(streamFailed);
        return;
      }
      console.warn(
        `[provider-executor] stream via '${name}' failed before any tokens (${streamFailed.message}); falling back`,
      );
      continue;
    }

    try {
      const reply = await provider.executeChat(messages, options);
      for (const token of splitIntoTokens(reply)) onToken(token);
      await onDone();
      return;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (isLast) {
        await onError(error);
        return;
      }
      console.warn(
        `[provider-executor] non-stream via '${name}' failed (${error.message}); falling back`,
      );
    }
  }

  // Should be unreachable — chain always has at least one provider.
  await onError(new Error("All providers failed for streaming chat"));
}

export async function checkActiveProviderHealth(_options?: ProviderExecutionOptions): Promise<ProviderHealth> {
  return getActiveProvider().checkHealth();
}
