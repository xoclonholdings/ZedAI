export type ProviderRole = "system" | "user" | "assistant";
export type ExecutionLane = "chat" | "operations" | "business" | "finance" | "research" | "admin" | "embedding";
export type ComputeTargetName = "local" | "persistent" | "burst";

export interface ProviderMessage {
  role: ProviderRole;
  content: string;
}

export interface ProviderExecutionOptions {
  model?: string;
  systemPrompt?: string;
  lane?: ExecutionLane;
  target?: ComputeTargetName;
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
