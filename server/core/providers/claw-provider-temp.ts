import { getProviderRuntimeConfig, resolveModelForLane } from "./provider-config";
import {
  buildPromptFromMessages,
  extractAssistantText,
  fetchWithTimeout,
  splitIntoTokens,
} from "./provider-helpers";
import type { ModelProvider, ProviderExecutionOptions, ProviderHealth, ProviderMessage } from "./provider-interface";

export class ClawTempProvider implements ModelProvider {
  private getConfig() {
    return getProviderRuntimeConfig().clawTemp;
  }

  private ensureConfigured() {
    const config = this.getConfig();
    if (!config.baseUrl) {
      throw new Error("CLAW_BASE_URL / REMOTE_INFERENCE_URL is not configured");
    }
    return config;
  }

  async executePrompt(prompt: string, options?: ProviderExecutionOptions): Promise<string> {
    return this.executeChat([{ role: "user", content: prompt }], options);
  }

  async executeChat(messages: ProviderMessage[], options?: ProviderExecutionOptions): Promise<string> {
    const config = this.ensureConfigured();
    const userMessage =
      [...messages].reverse().find((message) => message.role === "user")?.content ||
      buildPromptFromMessages(messages, options?.systemPrompt);

    const requestBody: Record<string, unknown> = {
      model: options?.model || resolveModelForLane(options?.lane, config.model),
      message: userMessage,
      messages,
      system_prompt: options?.systemPrompt,
    };
    // Only include generation params when set, so custom upstreams
    // (Lightning, remote runners) can ignore unrecognized fields
    // rather than fail on schema mismatch.
    if (typeof options?.temperature === "number") requestBody.temperature = options.temperature;
    if (typeof options?.maxTokens === "number") requestBody.max_tokens = options.maxTokens;
    if (typeof options?.topP === "number") requestBody.top_p = options.topP;

    const response = await fetchWithTimeout(
      `${config.baseUrl}${config.chatPath}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      },
      config.timeoutMs,
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `Remote inference ${response.status}${errorBody ? `: ${errorBody.slice(0, 220)}` : ""}`,
      );
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
    const config = this.getConfig();
    if (!config.baseUrl) {
      return { status: "offline", models: [], provider: "claw-temp", detail: "No temporary runner configured" };
    }

    try {
      const res = await fetchWithTimeout(`${config.baseUrl}${config.healthPath}`, {}, config.timeoutMs);
      if (!res.ok) return { status: "offline", models: [], provider: "claw-temp" };
      const data = await res.json();
      return {
        status: "online",
        models: data.model ? [data.model] : [config.model],
        provider: config.mode === "colab" ? "colab" : "claw-temp",
      };
    } catch {
      return { status: "offline", models: [], provider: config.mode === "colab" ? "colab" : "claw-temp" };
    }
  }
}
