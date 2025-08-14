import { ENV } from "../../env";

export async function ollamaChat(messages: {role:string;content:string}[]) {
  const r = await fetch(`${ENV.OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ model: ENV.ZED_MODEL, messages })
  }).catch(() => null);
  if (!r || !r.ok) return null;
  const j = await r.json().catch(() => null);
  const content = j?.message?.content ?? "";
  return String(content);
}

// Minimal local fallback: echoes plan & last context if Ollama is missing
export async function miniReason(messages: {role:string;content:string}[]) {
  const lastUser = [...messages].reverse().find(m => m.role === "user")?.content || "";
  return `MiniReasoner: I received "${lastUser}". (Install Ollama for real model responses.)`;
}
