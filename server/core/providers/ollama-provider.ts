import type { ProviderTargetConfig } from "./provider-config";
import {
  extractAssistantText,
  fetchWithTimeout,
  mergeMessagesWithSystem,
} from "./provider-helpers";
import type { ModelProvider, ProviderExecutionOptions, ProviderHealth, ProviderMessage } from "./provider-interface";

async function getAvailableModel(config: ProviderTargetConfig): Promise<string> {
  try {
    const res = await fetch(`${config.baseUrl}/api/tags`);
    if (!res.ok) return config.fallbackModel || config.model;
    const data = await res.json();
    const names: string[] = (data.models || []).map((model: any) => model.name);
    if (names.some((name) => name === config.model || name.startsWith(config.model.split(":")[0]))) return config.model;
    if (config.fallbackModel && names.some((name) => name.startsWith(config.fallbackModel))) return config.fallbackModel;
    return names[0] || config.fallbackModel || config.model;
  } catch {
    return config.fallbackModel || config.model;
  }
}

export class OllamaProvider implements ModelProvider {
  constructor(private readonly config: ProviderTargetConfig) {}

  async executePrompt(prompt: string, options?: ProviderExecutionOptions): Promise<string> {
    const model = options?.model || (await getAvailableModel(this.config));
    const response = await fetch(`${this.config.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false }),
    });
    if (!response.ok) throw new Error(`Ollama error ${response.status}`);
    return extractAssistantText(await response.json());
  }

  async executeChat(messages: ProviderMessage[], options?: ProviderExecutionOptions): Promise<string> {
    const model = options?.model || (await getAvailableModel(this.config));
    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
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
    const model = options?.model || (await getAvailableModel(this.config));

    try {
      const response = await fetchWithTimeout(`${this.config.baseUrl}/api/chat`, {
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
    try {
      const res = await fetch(`${this.config.baseUrl}/api/tags`);
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
