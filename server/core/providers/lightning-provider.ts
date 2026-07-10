import { getProviderRuntimeConfig, resolveModelForLane } from "./provider-config";
import {
  buildPromptFromMessages,
  extractAssistantText,
  fetchWithTimeout,
  splitIntoTokens,
} from "./provider-helpers";
import type {
  ContentBlock,
  ImageBlock,
  ModelProvider,
  ProviderExecutionOptions,
  ProviderHealth,
  ProviderMessage,
} from "./provider-interface";

/**
 * Lightning AI is the only provider ZED talks to.
 *
 * The Lightning runner (LitServe / user-hosted GPU endpoint) is called
 * with an OpenAI-compatible chat-completions body so runners built on
 * the common wrappers just work. A flattened `message` string and an
 * explicit top-level `images` array are also included so custom
 * runners that don't parse OpenAI content parts still have what they
 * need.
 *
 * Lane-based model routing is handled inside — the caller passes
 * options.lane (chat/manager/operations/research/business/finance)
 * and the config maps that lane to a specific model via MODEL_<LANE>
 * env vars. That's the "switch based on reasoning need" behavior.
 */

function contentToText(content: ProviderMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .map((block) => (block.type === "text" ? block.text : "[image]"))
    .join("\n");
}

function attachImages(
  messages: ProviderMessage[],
  images: ImageBlock[],
): ProviderMessage[] {
  if (images.length === 0) return messages;
  const out = [...messages];
  let lastUserIdx = -1;
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }
  const target =
    lastUserIdx >= 0 ? out[lastUserIdx] : { role: "user" as const, content: "" };
  const asBlocks: ContentBlock[] =
    typeof target.content === "string"
      ? target.content.trim()
        ? [{ type: "text" as const, text: target.content }]
        : []
      : target.content;
  const withImages: ContentBlock[] = [...asBlocks, ...images];
  if (lastUserIdx >= 0) {
    out[lastUserIdx] = { ...target, content: withImages };
  } else {
    out.push({ role: "user", content: withImages });
  }
  return out;
}

function toOpenAIStyleContent(content: ProviderMessage["content"]): unknown {
  if (typeof content === "string") return content;
  return content.map((block) =>
    block.type === "image"
      ? {
          type: "image_url",
          image_url: { url: `data:${block.mediaType};base64,${block.data}` },
        }
      : { type: "text", text: block.text },
  );
}

export class LightningProvider implements ModelProvider {
  private getConfig() {
    return getProviderRuntimeConfig().lightning;
  }

  private ensureConfigured() {
    const config = this.getConfig();
    if (!config.baseUrl) {
      throw new Error(
        "LIGHTNING_BASE_URL is not configured — point it at your Lightning AI endpoint.",
      );
    }
    return config;
  }

  async executePrompt(prompt: string, options?: ProviderExecutionOptions): Promise<string> {
    return this.executeChat([{ role: "user", content: prompt }], options);
  }

  async executeChat(
    messages: ProviderMessage[],
    options?: ProviderExecutionOptions,
  ): Promise<string> {
    const config = this.ensureConfigured();
    const attachments = options?.attachments || [];
    const composed = attachImages(messages, attachments);

    const lastUser = [...composed].reverse().find((m) => m.role === "user");
    const userMessageText = lastUser
      ? contentToText(lastUser.content)
      : buildPromptFromMessages(composed, options?.systemPrompt);

    const requestBody: Record<string, unknown> = {
      model: options?.model || resolveModelForLane(options?.lane, config.model),
      // OpenAI-compatible messages with content blocks so LitServe /
      // vLLM / TGI runners that speak OpenAI schema light up.
      messages: composed.map((m) => ({
        role: m.role,
        content: toOpenAIStyleContent(m.content),
      })),
      // Flattened fallbacks for custom Lightning runners that don't
      // parse OpenAI content parts.
      message: userMessageText,
      system_prompt: options?.systemPrompt,
      // Explicit vision payload alongside for runners that prefer a
      // dedicated field. Empty when there are no attachments.
      images: attachments.map((img) => ({
        data: img.data,
        mediaType: img.mediaType,
      })),
    };
    if (typeof options?.temperature === "number") requestBody.temperature = options.temperature;
    if (typeof options?.maxTokens === "number") requestBody.max_tokens = options.maxTokens;
    if (typeof options?.topP === "number") requestBody.top_p = options.topP;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

    const response = await fetchWithTimeout(
      `${config.baseUrl}${config.chatPath}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      },
      config.timeoutMs,
    );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `Lightning ${response.status}${errorBody ? `: ${errorBody.slice(0, 220)}` : ""}`,
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
      return {
        status: "offline",
        models: [],
        provider: "lightning",
        detail: "LIGHTNING_BASE_URL not set",
      };
    }
    try {
      const healthHeaders: Record<string, string> = {};
      if (config.apiKey) healthHeaders.Authorization = `Bearer ${config.apiKey}`;
      const res = await fetchWithTimeout(
        `${config.baseUrl}${config.healthPath}`,
        { headers: healthHeaders },
        config.timeoutMs,
      );
      if (!res.ok) {
        return {
          status: "offline",
          models: [],
          provider: "lightning",
          detail: `HTTP ${res.status}`,
        };
      }
      const data = await res.json().catch(() => ({}));
      return {
        status: "online",
        models: data?.model ? [data.model] : [config.model],
        provider: "lightning",
      };
    } catch (err) {
      return {
        status: "offline",
        models: [],
        provider: "lightning",
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
