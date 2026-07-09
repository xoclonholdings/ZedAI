import { getProviderRuntimeConfig, resolveModelForLane } from "./provider-config";
import {
  buildPromptFromMessages,
  extractAssistantText,
  fetchWithTimeout,
  splitIntoTokens,
} from "./provider-helpers";
import type { ModelProvider, ProviderExecutionOptions, ProviderHealth, ProviderMessage } from "./provider-interface";

function flattenContent(content: ProviderMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .map((block) => (block.type === "text" ? block.text : "[image]"))
    .join("\n");
}

function flattenMessages(messages: ProviderMessage[]): ProviderMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: flattenContent(message.content),
  }));
}

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

    const attachments = options?.attachments || [];
    const flatMessages = flattenMessages(messages);
    if (attachments.length > 0) {
      console.warn(
        `[claw-temp] Provider does not support vision — dropping ${attachments.length} image attachment(s). Consider switching MODEL_PROVIDER to openai or claude.`,
      );
      let lastUserIdx = -1;
      for (let i = flatMessages.length - 1; i >= 0; i--) {
        if (flatMessages[i].role === "user") {
          lastUserIdx = i;
          break;
        }
      }
      const note = `\n\n[User attached ${attachments.length} image${attachments.length === 1 ? "" : "s"} — the current model can't view images. Ask the user to describe the content if needed.]`;
      if (lastUserIdx >= 0) {
        flatMessages[lastUserIdx] = {
          ...flatMessages[lastUserIdx],
          content: `${flatMessages[lastUserIdx].content}${note}`,
        };
      }
    }
    const userMessage =
      ([...flatMessages]
        .reverse()
        .find((message) => message.role === "user")?.content as string) ||
      buildPromptFromMessages(flatMessages, options?.systemPrompt);

    const requestBody: Record<string, unknown> = {
      model: options?.model || resolveModelForLane(options?.lane, config.model),
      message: userMessage,
      messages: flatMessages,
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
