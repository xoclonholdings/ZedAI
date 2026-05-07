import { getProviderRuntimeConfig, resolveModelForLane } from "./provider-config";
import {
  buildPromptFromMessages,
  extractAssistantText,
  fetchWithTimeout,
  mergeMessagesWithSystem,
} from "./provider-helpers";
import type { ModelProvider, ProviderExecutionOptions, ProviderHealth, ProviderMessage } from "./provider-interface";

async function getAvailableModel(
  options: ProviderExecutionOptions | undefined,
  config = getProviderRuntimeConfig(),
): Promise<string> {
  // Lane override wins over discovery so per-lane model env vars work
  // even when /api/tags is reachable.
  const laneOverride = resolveModelForLane(options?.lane, "");
  if (laneOverride && laneOverride !== config.ollama.fallbackModel) {
    return laneOverride;
  }
  try {
    const res = await fetch(`${config.ollama.baseUrl}/api/tags`);
    if (!res.ok) return config.ollama.fallbackModel;
    const data = await res.json();
    const names: string[] = (data.models || []).map((model: any) => model.name);
    if (names.some((name) => name.startsWith("qwen2.5"))) return config.ollama.model;
    if (names.some((name) => name.startsWith(config.ollama.fallbackModel))) return config.ollama.fallbackModel;
    return names[0] || config.ollama.fallbackModel;
  } catch {
    return config.ollama.fallbackModel;
  }
}

export class OllamaProvider implements ModelProvider {
  async executePrompt(prompt: string, options?: ProviderExecutionOptions): Promise<string> {
    const config = getProviderRuntimeConfig();
    const model = options?.model || (await getAvailableModel(options, config));
    const response = await fetch(`${config.ollama.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false }),
    });
    if (!response.ok) throw new Error(`Ollama error ${response.status}`);
    return extractAssistantText(await response.json());
  }

  async executeChat(messages: ProviderMessage[], options?: ProviderExecutionOptions): Promise<string> {
    const config = getProviderRuntimeConfig();
    const model = options?.model || (await getAvailableModel(options, config));
    const response = await fetch(`${config.ollama.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: mergeMessagesWithSystem(messages, options?.systemPrompt),
        stream: false,
      }),
    });
    if (!response.ok) throw new Error(`Ollama error ${response.status}`);
    return extractAssistantText(await response.json());
  }

  async streamChat(
    messages: ProviderMessage[],
    options: ProviderExecutionOptions | undefined,
    onToken: (token: string) => void,
    onDone: () => void | Promise<void>,
    onError: (err: Error) => void | Promise<void>,
  ): Promise<void> {
    const config = getProviderRuntimeConfig();
    const model = options?.model || (await getAvailableModel(options, config));

    try {
      const response = await fetchWithTimeout(`${config.ollama.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: mergeMessagesWithSystem(messages, options?.systemPrompt),
          stream: true,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Ollama stream error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.message?.content) onToken(json.message.content);
            if (json.done) {
              await onDone();
              return;
            }
          } catch {}
        }
      }

      await onDone();
    } catch (error) {
      await onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async checkHealth(): Promise<ProviderHealth> {
    const config = getProviderRuntimeConfig();
    try {
      const res = await fetch(`${config.ollama.baseUrl}/api/tags`);
      if (!res.ok) return { status: "offline", models: [], provider: "ollama" };
      const data = await res.json();
      return {
        status: "online",
        models: (data.models || []).map((model: any) => model.name),
        provider: "ollama",
      };
    } catch {
      return { status: "offline", models: [], provider: "ollama" };
    }
  }
}
