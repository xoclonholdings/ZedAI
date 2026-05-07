import { getProviderRuntimeConfig, resolveModelForLane } from "./provider-config";
import { extractAssistantText } from "./provider-helpers";
import type { ModelProvider, ProviderExecutionOptions, ProviderHealth, ProviderMessage } from "./provider-interface";

export class OpenAIProvider implements ModelProvider {
  private getConfig() {
    return getProviderRuntimeConfig().openai;
  }

  private ensureConfigured() {
    const config = this.getConfig();
    if (!config.apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    return config;
  }

  private resolveModel(options?: ProviderExecutionOptions): string {
    const config = this.getConfig();
    return options?.model || resolveModelForLane(options?.lane, config.model);
  }

  async executePrompt(prompt: string, options?: ProviderExecutionOptions): Promise<string> {
    return this.executeChat([{ role: "user", content: prompt }], options);
  }

  async executeChat(messages: ProviderMessage[], options?: ProviderExecutionOptions): Promise<string> {
    const config = this.ensureConfigured();
    const model = this.resolveModel(options);
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: options?.systemPrompt
          ? [{ role: "system", content: options.systemPrompt }, ...messages]
          : messages,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `OpenAI ${response.status}${body ? `: ${body.slice(0, 220)}` : ""}`,
      );
    }
    return extractAssistantText(await response.json());
  }

  async checkHealth(): Promise<ProviderHealth> {
    const config = this.getConfig();
    if (!config.apiKey) {
      return { status: "offline", models: [], provider: "openai", detail: "OPENAI_API_KEY missing" };
    }
    return {
      status: "online",
      models: [config.model],
      provider: "openai",
    };
  }
}
