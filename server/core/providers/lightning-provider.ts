import { getProviderRuntimeConfig } from "./provider-config";
import {
  buildPromptFromMessages,
  extractAssistantText,
  fetchWithTimeout,
  mergeMessagesWithSystem,
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
 * Calls Lightning Model APIs with an OpenAI-compatible chat-completions
 * body. Custom runner compatibility fields can be enabled explicitly
 * with LIGHTNING_INCLUDE_RUNNER_COMPAT_FIELDS=true.
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

interface AuthKeyAttempt {
  label: string;
  key: string;
}

function errorDetailForModel(
  model: string,
  authTarget: string,
  status: number,
  body: string,
): string {
  const label = model || "deployment default";
  return `${label} via ${authTarget}: Lightning ${status}${body ? `: ${body.slice(0, 500)}` : ""}`;
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

  /**
   * Lightning endpoints are token-protected. Attach the bearer token
   * from LIGHTNING_API_KEY (or LIGHTNING_AI_API_KEY / LIGHTNING_TOKEN)
   * so requests don't come back 401 "Missing or invalid Authorization
   * header". Falls back to no auth header only when no key is set.
   */
  private authHeaders(apiKey?: string): Record<string, string> {
    const key = apiKey || this.getConfig().apiKey;
    return key ? { Authorization: `Bearer ${key}` } : {};
  }

  private authKeyAttempts(): AuthKeyAttempt[] {
    const { apiKey } = this.getConfig();
    if (!apiKey) return [{ label: "no api key", key: "" }];
    return [{ label: "LIGHTNING_API_KEY", key: apiKey }];
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
    const composed = mergeMessagesWithSystem(
      attachImages(messages, attachments),
      options?.systemPrompt,
    );

    const lastUser = [...composed].reverse().find((m) => m.role === "user");
    const userMessageText = lastUser
      ? contentToText(lastUser.content)
      : buildPromptFromMessages(composed, options?.systemPrompt);

    const baseRequestBody: Record<string, unknown> = {
      messages: composed.map((m) => ({
        role: m.role,
        content: toOpenAIStyleContent(m.content),
      })),
    };
    if (process.env.LIGHTNING_INCLUDE_RUNNER_COMPAT_FIELDS === "true") {
      baseRequestBody.message = userMessageText;
      baseRequestBody.system_prompt = options?.systemPrompt;
      baseRequestBody.images = attachments.map((img) => ({
        data: img.data,
        mediaType: img.mediaType,
      }));
    }
    if (typeof options?.temperature === "number") baseRequestBody.temperature = options.temperature;
    if (typeof options?.maxTokens === "number") baseRequestBody.max_tokens = options.maxTokens;
    if (typeof options?.topP === "number") baseRequestBody.top_p = options.topP;

    const modelAttempts = config.models.length ? config.models : [""];
    const authAttempts = this.authKeyAttempts();
    const errors: string[] = [];

    for (const authAttempt of authAttempts) {
      for (const model of modelAttempts) {
        const requestBody = model
          ? { ...baseRequestBody, model }
          : { ...baseRequestBody };
        const response = await fetchWithTimeout(
          `${config.baseUrl}${config.chatPath}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", ...this.authHeaders(authAttempt.key) },
            body: JSON.stringify(requestBody),
          },
          config.timeoutMs,
        );

        if (response.ok) {
          return extractAssistantText(await response.json());
        }

        const errorBody = await response.text().catch(() => "");
        errors.push(errorDetailForModel(model, authAttempt.label, response.status, errorBody));
      }
    }

    throw new Error(`Lightning all approved models failed: ${errors.join(" | ")}`);
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
      const res = await fetchWithTimeout(
        `${config.baseUrl}${config.healthPath}`,
        { headers: this.authHeaders() },
        config.healthTimeoutMs,
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
      const modelList = Array.isArray(data?.data)
        ? data.data
            .map((item: any) => item?.id)
            .filter((value: unknown): value is string => typeof value === "string")
        : [];
      return {
        status: "online",
        models: modelList.length > 0 ? modelList : data?.model ? [data.model] : ["Lightning deployment default"],
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
