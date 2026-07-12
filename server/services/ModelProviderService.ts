import {
  checkActiveProviderHealth,
  executeProviderChat,
  executeProviderPrompt,
  getActiveProviderName,
  getResolvedTargetName,
  streamProviderChat,
} from "../core/providers/provider-executor";
import { getProviderRuntimeConfig } from "../core/providers/provider-config";
import type {
  ProviderExecutionOptions,
  ProviderMessage,
} from "../core/providers/provider-interface";

const runtimeConfig = getProviderRuntimeConfig();

console.log(`[boot] provider:       Lightning AI`);
console.log(`[boot] target URL:     ${runtimeConfig.lightning.baseUrl || "(none)"}`);
console.log(`[boot] default model:  ${runtimeConfig.lightning.model || "(none)"}`);

const lanes = ["chat", "manager", "operations", "research", "business", "finance", "strategy", "admin"] as const;
const laneRows = lanes
  .map((lane) => {
    const override = runtimeConfig.laneModels[lane];
    return `  ${lane.padEnd(11)} -> ${override || "(default)"}`;
  })
  .join("\n");
console.log(`[boot] per-lane model overrides:\n${laneRows}`);

const effortRows = (["low", "medium", "high", "deep"] as const)
  .map((effort) => {
    const override = runtimeConfig.reasoningModels[effort];
    return `  ${effort.padEnd(11)} -> ${override || "(default)"}`;
  })
  .join("\n");
console.log(`[boot] per-reasoning model overrides:\n${effortRows}`);

export type ModelProviderMessage = ProviderMessage;

export async function generateFromProvider(
  prompt: string,
  options?: ProviderExecutionOptions,
): Promise<string> {
  try {
    return await executeProviderPrompt(prompt, options);
  } catch (err) {
    console.error("[ModelProviderService] generateFromProvider failed:", err);
    throw err;
  }
}

export async function generateChatFromProvider(
  messages: ModelProviderMessage[],
  systemPrompt?: string,
  options?: ProviderExecutionOptions,
): Promise<string> {
  try {
    return await executeProviderChat(messages, {
      ...options,
      systemPrompt: options?.systemPrompt || systemPrompt,
    });
  } catch (err) {
    console.error("[ModelProviderService] generateChatFromProvider failed:", err);
    throw err;
  }
}

export async function streamChatFromProvider(
  messages: ModelProviderMessage[],
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
      systemPrompt: options?.systemPrompt || systemPrompt,
    },
    onToken,
    onDone,
    onError,
  );
}

/**
 * SPEC.md § Hidden Reasoning and Response Governance (line 111):
 *   "Streaming chat buffers generated model text until the Voice +
 *   Presentation layer can apply presentZedResponse /
 *   presentZedResponseWithChecks before the response is sent to the
 *   client."
 *
 * So even when we stream, we must buffer server-side and let Voice +
 * Presentation transform the complete text before it reaches the
 * user. This helper does that: it streams from the provider (which
 * gives us provider-timeout resilience and lets a slow generation
 * keep the connection alive) and returns the buffered complete text
 * to the caller, who then hands it to presentZedResponse as usual.
 *
 * Callers that used generateChatFromProvider can swap to this without
 * changing anything else in their agent flow — output shape is
 * identical.
 */
export async function generateBufferedStreamFromProvider(
  messages: ModelProviderMessage[],
  systemPrompt: string | undefined,
  options?: ProviderExecutionOptions,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const chunks: string[] = [];
    void streamProviderChat(
      messages,
      {
        ...options,
        systemPrompt: options?.systemPrompt || systemPrompt,
      },
      (token) => {
        chunks.push(token);
      },
      () => {
        resolve(chunks.join(""));
      },
      (err) => {
        reject(err);
      },
    );
  });
}

export async function transcribeAudio(_audioBuffer: Buffer): Promise<string> {
  return "[Voice transcription requires Whisper model. Text input is recommended.]";
}

export async function checkModelProviderHealth(): Promise<{
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
