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

    const attachments = options?.attachments || [];
    const withAttachments = [...messages];
    if (attachments.length > 0) {
      let lastUserIdx = -1;
      for (let i = withAttachments.length - 1; i >= 0; i--) {
        if (withAttachments[i].role === "user") {
          lastUserIdx = i;
          break;
        }
      }
      const target =
        lastUserIdx >= 0
          ? withAttachments[lastUserIdx]
          : { role: "user" as const, content: "" };
      const asBlocks =
        typeof target.content === "string"
          ? target.content.trim()
            ? [{ type: "text" as const, text: target.content }]
            : []
          : target.content;
      const withImages = [
        ...asBlocks,
        ...attachments.map((img) => ({
          type: "image" as const,
          data: img.data,
          mediaType: img.mediaType,
        })),
      ];
      if (lastUserIdx >= 0) {
        withAttachments[lastUserIdx] = { ...target, content: withImages };
      } else {
        withAttachments.push({ role: "user", content: withImages });
      }
    }

    const formattedMessages = (
      options?.systemPrompt
        ? [
            {
              role: "system",
              content: options.systemPrompt,
            },
            ...withAttachments,
          ]
        : withAttachments
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
          : message.content.map((block) =>
              block.type === "image"
                ? {
                    type: "image_url",
                    image_url: {
                      url: `data:${block.mediaType};base64,${block.data}`,
                    },
                  }
                : { type: "text", text: block.text },
            ),
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
