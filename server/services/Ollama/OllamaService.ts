const OLLAMA_BASE = process.env.OLLAMA_URL || "http://localhost:11434";
const PRIMARY_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b";
const FALLBACK_MODEL = "llama3.2";

console.log(`[OllamaService] Targeting Ollama at: ${OLLAMA_BASE}`);

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function getAvailableModel(): Promise<string> {
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

export async function generateFromOllama(prompt: string): Promise<string> {
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
  systemPrompt?: string
): Promise<string> {
  const model = await getAvailableModel();
  const payload: any = { model, messages, stream: false };
  if (systemPrompt) {
    payload.messages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];
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
  onError: (err: Error) => void
): Promise<void> {
  const model = await getAvailableModel();
  const allMessages = systemPrompt
    ? [{ role: "system" as const, content: systemPrompt }, ...messages]
    : messages;

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
          if (json.done) { onDone(); return; }
        } catch {}
      }
    }
    onDone();
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  // Whisper via Ollama is not yet widely supported in local Ollama
  // Returning a placeholder — replace with whisper.cpp integration when available
  return "[Voice transcription requires Whisper model. Text input is recommended.]";
}

export async function checkOllamaHealth(): Promise<{
  status: "online" | "offline";
  models: string[];
}> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`);
    if (!res.ok) return { status: "offline", models: [] };
    const data = await res.json();
    const models = (data.models || []).map((m: any) => m.name);
    return { status: "online", models };
  } catch {
    return { status: "offline", models: [] };
  }
}
