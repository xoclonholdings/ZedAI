export type Msg = { role: "system"|"user"|"assistant"|"tool"; content: string; name?: string };
export type AskBody = { threadId?: string; message: string; meta?: Record<string, any> };
export type AskResponse = {
  answer: string;
  steps: Array<{ type: string; data: any }>;
  citations?: Array<{ uri?: string; title?: string; text?: string }>;
  threadId: string;
};
