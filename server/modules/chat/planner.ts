import type { Msg } from "./types";

export function systemPrompt(tools: string[]) {
  return [
    "You are Zed, a local, privacy-first AI.",
    "You may produce a JSON action when needed:",
    '  {"action":"tool","name":"<tool>","args":{...}}',
    'or finalize with: {"final":"text"}',
    `Available tools: ${tools.join(", ")}`
  ].join("\n");
}

export function parseAction(text: string): {type:"tool"|"final"; name?:string; args?:any; final?:string} | null {
  const m = text.match(/\{[\s\S]*\}$/m);
  if (!m) return null;
  try {
    const json = JSON.parse(m[0]);
    if (json?.action === "tool") return { type:"tool", name: json.name, args: json.args };
    if (typeof json?.final === "string") return { type:"final", final: json.final };
  } catch {}
  return null;
}

export function clipMessages(history: Msg[], max=16): Msg[] {
  if (history.length <= max) return history;
  return [...history.slice(0,1), ...history.slice(-max)]; // keep system + last (max-1)
}
