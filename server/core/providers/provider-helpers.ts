import type { ProviderMessage } from "./provider-interface";

export function mergeMessagesWithSystem(messages: ProviderMessage[], systemPrompt?: string): ProviderMessage[] {
  if (!systemPrompt) return messages;
  return [{ role: "system", content: systemPrompt }, ...messages];
}

export function buildPromptFromMessages(messages: ProviderMessage[], systemPrompt?: string): string {
  return mergeMessagesWithSystem(messages, systemPrompt)
    .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
    .join("\n\n");
}

export function splitIntoTokens(text: string): string[] {
  const matches = text.match(/\S+\s*/g);
  return matches && matches.length > 0 ? matches : [text];
}

export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = 45000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      throw new Error(`Remote inference timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function extractAssistantText(payload: any): string {
  if (!payload) return "(no response)";
  if (typeof payload === "string") return payload;
  if (typeof payload.reply === "string") return payload.reply;
  if (typeof payload.response === "string") return payload.response;
  if (typeof payload.output_text === "string") return payload.output_text;
  if (typeof payload.content === "string") return payload.content;
  if (typeof payload.message?.content === "string") return payload.message.content;
  if (typeof payload.completion === "string") return payload.completion;
  if (Array.isArray(payload.content)) {
    const text = payload.content
      .map((item: any) => item?.text)
      .filter((value: unknown) => typeof value === "string")
      .join("");
    if (text) return text;
  }
  if (Array.isArray(payload.choices) && payload.choices[0]) {
    const choice = payload.choices[0];
    if (typeof choice.message?.content === "string") return choice.message.content;
    if (typeof choice.text === "string") return choice.text;
  }
  return "(no response)";
}
