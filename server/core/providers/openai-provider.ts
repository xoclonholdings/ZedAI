import type { ProviderTargetConfig } from "./provider-config";
import { extractAssistantText } from "./provider-helpers";
import type { ModelProvider, ProviderExecutionOptions, ProviderHealth, ProviderMessage } from "./provider-interface";

export class OpenAIProvider implements ModelProvider {
  constructor(private readonly config: ProviderTargetConfig) {}

  private ensureConfigured() {
    if (!this.config.apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    return this.config;
  }

  async executePrompt(prompt: string, options?: ProviderExecutionOptions): Promise<string> {
    return this.executeChat([{ role: "user", content: prompt }], options);
  }

  async executeChat(messages: ProviderMessage[], options?: ProviderExecutionOptions): Promise<string> {
    const config = this.ensureConfigured();
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: options?.model || config.model,
        messages: options?.systemPrompt
          ? [{ role: "system", content: options.systemPrompt }, ...messages]
          : messages,
      }),
    });
    if (!response.ok) throw new Error(`OpenAI error ${response.status}`);
    return extractAssistantText(await response.json());
  }

  async checkHealth(): Promise<ProviderHealth> {
    if (!this.config.apiKey) {
      return { status: "offline", models: [], provider: "openai", detail: "OPENAI_API_KEY missing" };
    }
    return {
      status: "online",
      models: [this.config.model],
      provider: "openai",
    };
  }
}
