import {
  checkActiveProviderHealth,
  executeProviderChat,
  executeProviderPrompt,
  getProviderRoutingSummary,
  getResolvedTargetName,
  getActiveProviderName,
  streamProviderChat,
} from "../../core/providers/provider-executor";
import { getProviderRuntimeConfig } from "../../core/providers/provider-config";
import type { ProviderExecutionOptions, ProviderMessage } from "../../core/providers/provider-interface";

const runtimeConfig = getProviderRuntimeConfig();
const routingSummary = getProviderRoutingSummary();

console.log(`[OllamaService] Active provider: ${runtimeConfig.activeProvider}`);
console.log(`[OllamaService] Ollama target: ${runtimeConfig.ollama.baseUrl}`);
console.log(
  `[OllamaService] Routed targets: chat=${routingSummary.routing.chat}, operations=${routingSummary.routing.operations}, business=${routingSummary.routing.business}, finance=${routingSummary.routing.finance}, research=${routingSummary.routing.research}`,
);
if (runtimeConfig.clawTemp.baseUrl) {
  console.log(
    `[OllamaService] Temporary remote runner: ${runtimeConfig.clawTemp.baseUrl} (${runtimeConfig.clawTemp.mode})`,
  );
}

export type OllamaMessage = ProviderMessage;

export async function generateFromOllama(prompt: string, options?: ProviderExecutionOptions): Promise<string> {
  try {
    return await executeProviderPrompt(prompt, {
      ...options,
      model: options?.model || runtimeConfig.activeModel,
    });
  } catch (err) {
    console.error("[OllamaService] generateFromOllama failed:", err);
    throw err;
  }
}

export async function generateChatFromOllama(
  messages: OllamaMessage[],
  systemPrompt?: string,
  options?: ProviderExecutionOptions,
): Promise<string> {
  try {
    return await executeProviderChat(messages, {
      ...options,
      model: options?.model || runtimeConfig.activeModel,
      systemPrompt: options?.systemPrompt || systemPrompt,
    });
  } catch (err) {
    console.error("[OllamaService] generateChatFromOllama failed:", err);
    throw err;
  }
}

export async function streamChatFromOllama(
  messages: OllamaMessage[],
  systemPrompt: string | undefined,
  onToken: (token: string) => void,
  onDone: () => void | Promise<void>,
  onError: (err: Error) => void | Promise<void>,
  options?: ProviderExecutionOptions,
): Promise<void> {
  await streamProviderChat(
    messages,
    {
      ...options,
      model: options?.model || runtimeConfig.activeModel,
      systemPrompt: options?.systemPrompt || systemPrompt,
    },
    onToken,
    onDone,
    onError,
  );
}

export async function transcribeAudio(_audioBuffer: Buffer): Promise<string> {
  return "[Voice transcription requires Whisper model. Text input is recommended.]";
}

export async function checkOllamaHealth(): Promise<{
  status: "online" | "offline";
  models: string[];
  provider?: string;
  target?: string;
}> {
  try {
    const options: ProviderExecutionOptions = { lane: "chat" };
    const health = await checkActiveProviderHealth(options);
    return {
      status: health.status,
      models: health.models,
      provider: health.provider || getActiveProviderName(options),
      target: getResolvedTargetName(options),
    };
  } catch {
    const options: ProviderExecutionOptions = { lane: "chat" };
    return {
      status: "offline",
      models: [],
      provider: getActiveProviderName(options),
      target: getResolvedTargetName(options),
    };
  }
}
