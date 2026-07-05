export type ProviderRole = "system" | "user" | "assistant";

export interface ProviderMessage {
  role: ProviderRole;
  content: string;
}

/**
 * Lanes describe the calling site so providers / executors can apply
 * different routing or model selection per workload. Lane name flows
 * through to provider-config.resolveModelForLane(), letting you set
 * different models per lane via MODEL_CHAT / MODEL_MANAGER / etc.
 */
export type ProviderLane =
  | "chat"
  | "manager"
  | "operations"
  | "research"
  | "business"
  | "finance";

export interface ProviderExecutionOptions {
  model?: string;
  systemPrompt?: string;
  lane?: ProviderLane;
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
