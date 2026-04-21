import type { ProviderTargetConfig } from "./provider-config";
import { extractAssistantText } from "./provider-helpers";
import type { ModelProvider, ProviderExecutionOptions, ProviderHealth, ProviderMessage } from "./provider-interface";

export class ClaudeProvider implements ModelProvider {
  constructor(private readonly config: ProviderTargetConfig) {}

  private ensureConfigured() {
    if (!this.config.apiKey) {
      throw new Error("CLAUDE_API_KEY / ANTHROPIC_API_KEY is not configured");
    }
    return this.config;
  }

  async executePrompt(prompt: string, options?: ProviderExecutionOptions): Promise<string> {
    return this.executeChat([{ role: "user", content: prompt }], options);
  }

  async executeChat(messages: ProviderMessage[], options?: ProviderExecutionOptions): Promise<string> {
    const config = this.ensureConfigured();
    const response = await fetch(`${config.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: options?.model || config.model,
        system: options?.systemPrompt,
        max_tokens: 1024,
        messages: messages
          .filter((message) => message.role !== "system")
          .map((message) => ({
            role: message.role === "assistant" ? "assistant" : "user",
            content: message.content,
          })),
      }),
    });
    if (!response.ok) throw new Error(`Claude error ${response.status}`);
    return extractAssistantText(await response.json());
  }

  async checkHealth(): Promise<ProviderHealth> {
    if (!this.config.apiKey) {
      return { status: "offline", models: [], provider: "claude", detail: "CLAUDE_API_KEY missing" };
    }
    return {
      status: "online",
      models: [this.config.model],
      provider: "claude",
    };
  }
}
