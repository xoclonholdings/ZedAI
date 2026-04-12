const OLLAMA_BASE = process.env.OLLAMA_URL || "http://localhost:11434";
const PRIMARY_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b";
const FALLBACK_MODEL = "llama3.2";
const REMOTE_INFERENCE_URL = process.env.REMOTE_INFERENCE_URL?.replace(/\/+$/, "") || "";
const REMOTE_INFERENCE_MODE = process.env.REMOTE_INFERENCE_MODE || "ollama";

console.log(`[OllamaService] Ollama target: ${OLLAMA_BASE}`);
if (REMOTE_INFERENCE_URL) {
  console.log(`[OllamaService] Remote inference target: ${REMOTE_INFERENCE_URL} (${REMOTE_INFERENCE_MODE})`);
}

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function useRemoteInference() {
  return Boolean(REMOTE_INFERENCE_URL);
}

function mergeMessagesWithSystem(messages: OllamaMessage[], systemPrompt?: string) {
  if (!systemPrompt) {
    return messages;
  }

  return [{ role: "system" as const, content: systemPrompt }, ...messages];
}

function buildPromptFromMessages(messages: OllamaMessage[], systemPrompt?: string) {
  const combined = mergeMessagesWithSystem(messages, systemPrompt);
  return combined
    .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
    .join("\n\n");
}

function splitIntoTokens(text: string) {
  const matches = text.match(/\S+\s*/g);
  return matches && matches.length > 0 ? matches : [text];
}

async function getAvailableModel(): Promise<string> {
  if (useRemoteInference() && REMOTE_INFERENCE_MODE !== "ollama") {
    return PRIMARY_MODEL;
  }

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`);
    if (!res.ok) return FALLBACK_MODEL;
    const data = await res.json();
    const names: string[] = (data.models || []).map((m: any) => m.name);
    if (names.some((n) => n.startsWith("qwen2.5"))) return PRIMARY_MODEL;
    if (names.some((n) => n.startsWith("llama3.2"))) return FALLBACK_MODEL;
    return names[0] || FALLBACK_MODEL;
  } catch {
    return FALLBACK_MODEL;
  }
}

async function callRemoteInference(messages: OllamaMessage[], systemPrompt?: string): Promise<string> {
  if (!REMOTE_INFERENCE_URL) {
    throw new Error("REMOTE_INFERENCE_URL is not configured");
  }

  if (REMOTE_INFERENCE_MODE === "colab") {
    const userMessage = [...messages].reverse().find((message) => message.role === "user")?.content
      || buildPromptFromMessages(messages, systemPrompt);

    const response = await fetch(`${REMOTE_INFERENCE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: userMessage,
        system_prompt: systemPrompt,
      }),
    });

    if (!response.ok) {
      throw new Error(`Remote inference error ${response.status}`);
    }

    const data = await response.json();
    return data.reply || "(no response)";
  }

  const model = await getAvailableModel();
  const payload = {
    model,
    messages: mergeMessagesWithSystem(messages, systemPrompt),
    stream: false,
  };

  const response = await fetch(`${REMOTE_INFERENCE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Remote Ollama error ${response.status}`);
  }

  const data = await response.json();
  return data.message?.content || data.response || "(no response)";
}

export async function generateFromOllama(prompt: string): Promise<string> {
  if (useRemoteInference() && REMOTE_INFERENCE_MODE === "colab") {
    return callRemoteInference([{ role: "user", content: prompt }]);
  }

  const model = await getAvailableModel();
  try {
    const response = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false }),
    });
    if (!response.ok) throw new Error(`Ollama error ${response.status}`);
    const data = await response.json();
    return data.response || "(no response)";
  } catch (err) {
    console.error("[OllamaService] generateFromOllama failed:", err);
    throw err;
  }
}

export async function generateChatFromOllama(
  messages: OllamaMessage[],
  systemPrompt?: string,
): Promise<string> {
  if (useRemoteInference()) {
    try {
      return await callRemoteInference(messages, systemPrompt);
    } catch (err) {
      console.error("[OllamaService] remote inference failed:", err);
      throw err;
    }
  }

  const model = await getAvailableModel();
  const payload: any = { model, messages, stream: false };
  if (systemPrompt) {
    payload.messages = mergeMessagesWithSystem(messages, systemPrompt);
  }
  try {
    const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Ollama error ${response.status}`);
    const data = await response.json();
    return data.message?.content || data.response || "(no response)";
  } catch (err) {
    console.error("[OllamaService] generateChatFromOllama failed:", err);
    throw err;
  }
}

export async function streamChatFromOllama(
  messages: OllamaMessage[],
  systemPrompt: string | undefined,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
): Promise<void> {
  if (useRemoteInference()) {
    try {
      const reply = await callRemoteInference(messages, systemPrompt);
      for (const token of splitIntoTokens(reply)) {
        onToken(token);
      }
      onDone();
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)));
    }
    return;
  }

  const model = await getAvailableModel();
  const allMessages = mergeMessagesWithSystem(messages, systemPrompt);

  try {
    const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: allMessages, stream: true }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Ollama stream error ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        if (!line.trim()) continue;
        try {
          const json = JSON.parse(line);
          if (json.message?.content) onToken(json.message.content);
          if (json.done) {
            onDone();
            return;
          }
        } catch {}
      }
    }
    onDone();
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

export async function transcribeAudio(_audioBuffer: Buffer): Promise<string> {
  return "[Voice transcription requires Whisper model. Text input is recommended.]";
}

export async function checkOllamaHealth(): Promise<{
  status: "online" | "offline";
  models: string[];
  provider?: string;
}> {
  if (useRemoteInference()) {
    try {
      if (REMOTE_INFERENCE_MODE === "colab") {
        const res = await fetch(`${REMOTE_INFERENCE_URL}/health`);
        if (!res.ok) return { status: "offline", models: [], provider: "colab" };
        const data = await res.json();
        return {
          status: "online",
          models: data.model ? [data.model] : [PRIMARY_MODEL],
          provider: "colab",
        };
      }

      const res = await fetch(`${REMOTE_INFERENCE_URL}/api/tags`);
      if (!res.ok) return { status: "offline", models: [], provider: "remote-ollama" };
      const data = await res.json();
      const models = (data.models || []).map((m: any) => m.name);
      return { status: "online", models, provider: "remote-ollama" };
    } catch {
      return { status: "offline", models: [], provider: REMOTE_INFERENCE_MODE };
    }
  }

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`);
    if (!res.ok) return { status: "offline", models: [], provider: "ollama" };
    const data = await res.json();
    const models = (data.models || []).map((m: any) => m.name);
    return { status: "online", models, provider: "ollama" };
  } catch {
    return { status: "offline", models: [], provider: "ollama" };
  }
}
