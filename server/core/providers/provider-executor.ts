import { LightningProvider } from "./lightning-provider";
import { getProviderRuntimeConfig } from "./provider-config";
import { splitIntoTokens } from "./provider-helpers";
import type {
  ModelProvider,
  ProviderExecutionOptions,
  ProviderHealth,
  ProviderLane,
  ProviderMessage,
} from "./provider-interface";

/**
 * Load voice settings and derive generation params, filling in any
 * that the caller left blank. Kept dynamically imported so provider-
 * executor stays a leaf module without a hard dependency cycle back
 * up into services/.
 */
async function mergeVoiceDerivedParams(
  options?: ProviderExecutionOptions,
): Promise<ProviderExecutionOptions | undefined> {
  const temperatureSet = typeof options?.temperature === "number";
  const maxTokensSet = typeof options?.maxTokens === "number";
  const topPSet = typeof options?.topP === "number";
  if (temperatureSet && maxTokensSet && topPSet) return options;

  try {
    const [{ loadAdminSettings }, { deriveGenerationParams }] = await Promise.all([
      import("../../services/AdminSettingsStore"),
      import("../../services/voiceSettingsToGeneration"),
    ]);
    const settings = await loadAdminSettings();
    if (!settings.voice) return options;
    const lane: ProviderLane = options?.lane || "chat";
    const derived = deriveGenerationParams(settings.voice, lane);
    return {
      ...(options || {}),
      temperature: temperatureSet ? options!.temperature : derived.temperature,
      maxTokens: maxTokensSet ? options!.maxTokens : derived.maxTokens,
      topP: topPSet ? options!.topP : derived.topP,
    };
  } catch {
    return options;
  }
}

// Lightning is the only provider — instantiate once and reuse.
const lightningProvider: ModelProvider = new LightningProvider();

function getActiveProvider(): ModelProvider {
  return lightningProvider;
}

export function getActiveProviderName(_options?: ProviderExecutionOptions): string {
  return "lightning";
}

/**
 * URL the Lightning runner will hit. Lanes aren't URL-routed today —
 * per-lane switching happens at the model layer (MODEL_<LANE>) — so
 * the resolved target is identical across lanes.
 */
export function getResolvedTargetName(_options?: ProviderExecutionOptions): string {
  return getProviderRuntimeConfig().lightning.baseUrl;
}

export function getProviderRoutingSummary() {
  const config = getProviderRuntimeConfig();
  const target = getResolvedTargetName();
  return {
    active: config.activeProvider,
    activeModel: config.activeModel,
    target,
    routing: {
      chat: target,
      operations: target,
      business: target,
      finance: target,
      research: target,
      strategy: target,
      admin: target,
    },
    laneModels: config.laneModels,
    reasoningModels: config.reasoningModels,
    laneReasoningModels: config.laneReasoningModels,
  };
}

export async function executeProviderPrompt(
  prompt: string,
  options?: ProviderExecutionOptions,
): Promise<string> {
  return getActiveProvider().executePrompt(prompt, await mergeVoiceDerivedParams(options));
}

export async function executeProviderChat(
  messages: ProviderMessage[],
  options?: ProviderExecutionOptions,
): Promise<string> {
  return getActiveProvider().executeChat(messages, await mergeVoiceDerivedParams(options));
}

/**
 * No silent fallback. If Lightning fails, the caller sees the real
 * error — caller decides how to surface it.
 */
export async function streamProviderChat(
  messages: ProviderMessage[],
  options: ProviderExecutionOptions | undefined,
  onToken: (token: string) => void,
  onDone: () => void | Promise<void>,
  onError: (err: Error) => void | Promise<void>,
): Promise<void> {
  const provider = getActiveProvider();
  const merged = await mergeVoiceDerivedParams(options);

  if (provider.streamChat) {
    let streamFailed: Error | null = null;
    try {
      await provider.streamChat(messages, merged, onToken, onDone, (err) => {
        streamFailed = err;
      });
    } catch (err) {
      streamFailed = err instanceof Error ? err : new Error(String(err));
    }
    if (streamFailed) await onError(streamFailed);
    return;
  }

  // Provider doesn't natively support streaming — split a single response
  // into pseudo-tokens. Same single-attempt semantics: failures surface upstream.
  try {
    const reply = await provider.executeChat(messages, merged);
    for (const token of splitIntoTokens(reply)) onToken(token);
    await onDone();
  } catch (err) {
    await onError(err instanceof Error ? err : new Error(String(err)));
  }
}

export async function checkActiveProviderHealth(
  _options?: ProviderExecutionOptions,
): Promise<ProviderHealth> {
  return getActiveProvider().checkHealth();
}
