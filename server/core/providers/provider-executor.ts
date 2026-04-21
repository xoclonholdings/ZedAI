import { ClaudeProvider } from "./claude-provider";
import { ClawTempProvider } from "./claw-provider-temp";
import { OpenAIProvider } from "./openai-provider";
import { OllamaProvider } from "./ollama-provider";
import { getProviderRuntimeConfig, type ProviderTargetConfig } from "./provider-config";
import { splitIntoTokens } from "./provider-helpers";
import type {
  ComputeTargetName,
  ExecutionLane,
  ModelProvider,
  ProviderExecutionOptions,
  ProviderHealth,
  ProviderMessage,
} from "./provider-interface";

function resolveTargetName(options?: ProviderExecutionOptions): ComputeTargetName {
  const config = getProviderRuntimeConfig();
  if (options?.target) {
    return options.target;
  }
  const lane: ExecutionLane | "default" = options?.lane || "default";
  return config.routing[lane] || config.routing.default;
}

function resolveTargetConfig(options?: ProviderExecutionOptions): ProviderTargetConfig {
  const config = getProviderRuntimeConfig();
  return config.targets[resolveTargetName(options)];
}

function getProviderForTarget(target: ProviderTargetConfig): ModelProvider {
  switch (target.provider) {
    case "openai":
      return new OpenAIProvider(target);
    case "claude":
      return new ClaudeProvider(target);
    case "claw-temp":
      return new ClawTempProvider(target);
    case "ollama":
    default:
      return new OllamaProvider(target);
  }
}

export function getActiveProviderName(options?: ProviderExecutionOptions): string {
  return resolveTargetConfig(options).provider;
}

export function getResolvedTargetName(options?: ProviderExecutionOptions): ComputeTargetName {
  return resolveTargetName(options);
}

export function getProviderRoutingSummary() {
  const config = getProviderRuntimeConfig();
  return {
    activeProvider: config.activeProvider,
    activeModel: config.activeModel,
    routing: config.routing,
    targets: config.targets,
  };
}

export async function executeProviderPrompt(prompt: string, options?: ProviderExecutionOptions): Promise<string> {
  return getProviderForTarget(resolveTargetConfig(options)).executePrompt(prompt, options);
}

export async function executeProviderChat(
  messages: ProviderMessage[],
  options?: ProviderExecutionOptions,
): Promise<string> {
  return getProviderForTarget(resolveTargetConfig(options)).executeChat(messages, options);
}

export async function streamProviderChat(
  messages: ProviderMessage[],
  options: ProviderExecutionOptions | undefined,
  onToken: (token: string) => void,
  onDone: () => void | Promise<void>,
  onError: (err: Error) => void | Promise<void>,
): Promise<void> {
  const provider = getProviderForTarget(resolveTargetConfig(options));

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

export async function checkActiveProviderHealth(options?: ProviderExecutionOptions): Promise<ProviderHealth> {
  return getProviderForTarget(resolveTargetConfig(options)).checkHealth();
}
