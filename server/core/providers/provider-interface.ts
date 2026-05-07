export type ProviderRole = "system" | "user" | "assistant";

export interface ProviderMessage {
  role: ProviderRole;
  content: string;
}

/**
 * Lanes describe the calling site so providers / executors can apply
 * different routing or model selection per workload. Today the executor
 * resolves the same target for every lane, but agents already pass
 * lane hints so future per-lane routing requires no call-site changes.
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
