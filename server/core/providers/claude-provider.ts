import { getProviderRuntimeConfig, resolveModelForLane } from "./provider-config";
import { extractAssistantText } from "./provider-helpers";
import type { ModelProvider, ProviderExecutionOptions, ProviderHealth, ProviderMessage } from "./provider-interface";

export class ClaudeProvider implements ModelProvider {
  private getConfig() {
    return getProviderRuntimeConfig().claude;
  }

  private ensureConfigured() {
    const config = this.getConfig();
    if (!config.apiKey) {
      throw new Error("CLAUDE_API_KEY / ANTHROPIC_API_KEY is not configured");
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
    const requestBody: Record<string, unknown> = {
      model: this.resolveModel(options),
      system: options?.systemPrompt,
      // Anthropic requires max_tokens on every messages call. Default
      // to a modest ceiling and let voice-derived settings override.
      max_tokens: typeof options?.maxTokens === "number" ? options.maxTokens : 1024,
      messages: messages
        .filter((message) => message.role !== "system")
        .map((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content,
        })),
    };
    if (typeof options?.temperature === "number") requestBody.temperature = options.temperature;
    if (typeof options?.topP === "number") requestBody.top_p = options.topP;

    const response = await fetch(`${config.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Claude ${response.status}${body ? `: ${body.slice(0, 220)}` : ""}`);
    }
    return extractAssistantText(await response.json());
  }

  async checkHealth(): Promise<ProviderHealth> {
    const config = this.getConfig();
    if (!config.apiKey) {
      return { status: "offline", models: [], provider: "claude", detail: "CLAUDE_API_KEY missing" };
    }
    return {
      status: "online",
      models: [config.model],
      provider: "claude",
    };
  }
}
