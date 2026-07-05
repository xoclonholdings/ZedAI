import { getProviderRuntimeConfig, resolveModelForLane } from "./provider-config";
import { extractAssistantText } from "./provider-helpers";
import type {
  ModelProvider,
  ProviderExecutionOptions,
  ProviderHealth,
  ProviderMessage,
} from "./provider-interface";

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

  async executePrompt(
    prompt: string,
    options?: ProviderExecutionOptions,
  ): Promise<string> {
    return this.executeChat(
      [{ role: "user", content: prompt }],
      options,
    );
  }

  async executeChat(
    messages: ProviderMessage[],
    options?: ProviderExecutionOptions,
  ): Promise<string> {
    const config = this.ensureConfigured();
    const model = this.resolveModel(options);

    const formattedMessages = (
      options?.systemPrompt
        ? [
            {
              role: "system",
              content: options.systemPrompt,
            },
            ...messages,
          ]
        : messages
    ).map((message) => ({
      role: message.role,
      content:
        typeof message.content === "string"
          ? [
              {
                type: "text",
                text: message.content,
              },
            ]
          : message.content,
    }));

    const requestBody: Record<string, unknown> = {
      model,
      messages: formattedMessages,
    };
    // Forward derived generation params when supplied. Only include
    // set fields so the request stays clean for upstreams that reject
    // unknown values.
    if (typeof options?.temperature === "number") requestBody.temperature = options.temperature;
    if (typeof options?.maxTokens === "number") requestBody.max_tokens = options.maxTokens;
    if (typeof options?.topP === "number") requestBody.top_p = options.topP;

    const response = await fetch(
      `${config.baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      },
    );

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
      return {
        status: "offline",
        models: [],
        provider: "openai",
        detail: "OPENAI_API_KEY missing",
      };
    }

    return {
      status: "online",
      models: [config.model],
      provider: "openai",
    };
  }
}
