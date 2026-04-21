import type { ProviderTargetConfig } from "./provider-config";
import {
  buildPromptFromMessages,
  extractAssistantText,
  fetchWithTimeout,
  splitIntoTokens,
} from "./provider-helpers";
import type { ModelProvider, ProviderExecutionOptions, ProviderHealth, ProviderMessage } from "./provider-interface";

export class ClawTempProvider implements ModelProvider {
  constructor(private readonly config: ProviderTargetConfig) {}

  private ensureConfigured() {
    if (!this.config.baseUrl) {
      throw new Error("CLAW_BASE_URL / REMOTE_INFERENCE_URL is not configured");
    }
    return this.config;
  }

  async executePrompt(prompt: string, options?: ProviderExecutionOptions): Promise<string> {
    return this.executeChat([{ role: "user", content: prompt }], options);
  }

  async executeChat(messages: ProviderMessage[], options?: ProviderExecutionOptions): Promise<string> {
    const config = this.ensureConfigured();
    const userMessage =
      [...messages].reverse().find((message) => message.role === "user")?.content ||
      buildPromptFromMessages(messages, options?.systemPrompt);

    const response = await fetchWithTimeout(
      `${config.baseUrl}${config.chatPath}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: options?.model || config.model,
          message: userMessage,
          messages,
          system_prompt: options?.systemPrompt,
        }),
      },
      config.timeoutMs,
    );

    if (!response.ok) {
      throw new Error(`Remote inference error ${response.status}`);
    }

    return extractAssistantText(await response.json());
  }

  async streamChat(
    messages: ProviderMessage[],
    options: ProviderExecutionOptions | undefined,
    onToken: (token: string) => void,
    onDone: () => void | Promise<void>,
    onError: (err: Error) => void | Promise<void>,
  ): Promise<void> {
    try {
      const reply = await this.executeChat(messages, options);
      for (const token of splitIntoTokens(reply)) {
        onToken(token);
      }
      await onDone();
    } catch (error) {
      await onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async checkHealth(): Promise<ProviderHealth> {
    if (!this.config.baseUrl) {
      return { status: "offline", models: [], provider: "claw-temp", detail: "No temporary runner configured" };
    }

    try {
      const res = await fetchWithTimeout(
        `${this.config.baseUrl}${this.config.healthPath || "/health"}`,
        {},
        this.config.timeoutMs,
      );
      if (!res.ok) return { status: "offline", models: [], provider: "claw-temp" };
      const data = await res.json();
      return {
        status: "online",
        models: data.model ? [data.model] : [this.config.model],
        provider: this.config.mode === "colab" ? "colab" : "claw-temp",
      };
    } catch {
      return { status: "offline", models: [], provider: this.config.mode === "colab" ? "colab" : "claw-temp" };
    }
  }
}
