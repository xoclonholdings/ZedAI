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

    const requestBody: Record<string, unknown> = {
      model: this.resolveModel(options),
      system: options?.systemPrompt,
      // Anthropic requires max_tokens on every messages call. Default
      // to a modest ceiling and let voice-derived settings override.
      max_tokens: typeof options?.maxTokens === "number" ? options.maxTokens : 1024,
      messages: withAttachments
        .filter((message) => message.role !== "system")
        .map((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content:
            typeof message.content === "string"
              ? message.content
              : message.content.map((block) =>
                  block.type === "image"
                    ? {
                        type: "image",
                        source: {
                          type: "base64",
                          media_type: block.mediaType,
                          data: block.data,
                        },
                      }
                    : { type: "text", text: block.text },
                ),
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
