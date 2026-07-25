export type ProviderRole = "system" | "user" | "assistant";

/**
 * A single piece of message content. Text messages remain plain
 * strings; multimodal messages (images alongside text) use blocks so
 * each provider adapter can serialize to its native format.
 */
export interface TextBlock {
  type: "text";
  text: string;
}

export interface ImageBlock {
  type: "image";
  /** Raw base64 payload without the `data:` prefix. */
  data: string;
  /** IANA media type — e.g. `image/jpeg`, `image/png`. */
  mediaType: string;
}

export type ContentBlock = TextBlock | ImageBlock;

export interface ProviderMessage {
  role: ProviderRole;
  content: string | ContentBlock[];
}

/**
 * Lanes describe the calling site so providers / executors can apply
 * workload-specific prompts and generation params. They do not select
 * models; the Lightning deployment owns model routing internally.
 */
export type ProviderLane =
  | "chat"
  | "manager"
  | "operations"
  | "research"
  | "business"
  | "finance"
  | "strategy"
  | "admin"
  | "education";

/**
 * Reasoning effort is separate from lane. Lane answers "what kind of
 * work is this?", effort answers "how hard is this turn?".
 */
export type ReasoningEffort = "low" | "medium" | "high" | "deep";

export interface ProviderExecutionOptions {
  systemPrompt?: string;
  lane?: ProviderLane;
  /** Describes task complexity for prompt/runtime tuning only; it does not select a model. */
  reasoningEffort?: ReasoningEffort;
  /**
   * Generation parameters. When any of these are set, providers forward
   * them into the request body; when unset, provider-executor derives
   * them from the admin voice settings so a user picking "Concise +
   * Direct" in Settings actually shapes the model call, not just the
   * prompt.
   */
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  /**
   * Optional image attachments. Each adapter appends these to the
   * final user message in its native content-block format. When the
   * active provider doesn't support vision, attachments are dropped
   * with a warning and a bracket note is added to the text so the
   * model at least knows they existed.
   */
  attachments?: ImageBlock[];
}

export interface ProviderHealth {
  status: "online" | "offline";
  models: string[];
  provider: string;
  detail?: string;
}

export interface ModelProvider {
  executePrompt(prompt: string, options?: ProviderExecutionOptions): Promise<string>;
  executeChat(messages: ProviderMessage[], options?: ProviderExecutionOptions): Promise<string>;
  streamChat?(
    messages: ProviderMessage[],
    options: ProviderExecutionOptions | undefined,
    onToken: (token: string) => void,
    onDone: () => void | Promise<void>,
    onError: (err: Error) => void | Promise<void>,
  ): Promise<void>;
  checkHealth(): Promise<ProviderHealth>;
}
