import { randomUUID } from "crypto";

import { generateChatFromProvider } from "../ModelProviderService";
import { buildWorkspaceMemoryContext } from "../WorkspaceMemoryService";
import { readAppState, writeAppState } from "../appState";

/**
 * The Research workspace engine.
 *
 * Search is the front door. After Zed looks something up, you can ask him
 * to do one of a few plain things with it: give the short version,
 * check if it's legit / worth it, or save it for later. "Other" lets you
 * say what you want in your own words.
 *
 * Every action grounds in the Research workspace's own memory first, and
 * in the actual search results — Zed never invents sources or facts.
 */

const SAVED_SCOPE = "research:saved";
const MAX_SAVED = 200;

export interface ResearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SavedResearchItem {
  id: string;
  createdAt: string;
  query: string;
  note: string;
  results: ResearchResult[];
}

function resultsBlock(results: ResearchResult[]): string {
  if (!results || results.length === 0) return "(no search results were provided)";
  return results
    .slice(0, 10)
    .map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   ${r.url}`)
    .join("\n");
}

export type ResearchAction = "summarize" | "verify" | "other";

const ACTION_INSTRUCTIONS: Record<Exclude<ResearchAction, "other">, string> = {
  summarize:
    "Give the short version. Just the points that matter, in plain everyday language — no jargon, no filler. Use short bullets. If the results don't actually answer it, say so plainly.",
  verify:
    "Give an honest gut-check in plain language: does this look real and credible, is it actually something the person would need, and is there anything better or worth knowing? Be straight with them — no hedging, no corporate tone.",
};

export interface RunActionInput {
  userId: string;
  action: ResearchAction;
  query: string;
  results: ResearchResult[];
  instruction?: string;
}

export async function runResearchAction(input: RunActionInput): Promise<string> {
  const query = String(input.query || "").trim();

  const memory = await buildWorkspaceMemoryContext("research", query || input.instruction || "").catch(
    () => ({ prompt: "", count: 0, used: false }),
  );

  const task =
    input.action === "other"
      ? String(input.instruction || "").trim() ||
        "Help with this in a plain, useful way."
      : ACTION_INSTRUCTIONS[input.action];

  const prompt = [
    memory.used ? `${memory.prompt}\n` : "",
    query ? `The person searched for: "${query}"` : "",
    `\nSearch results:\n${resultsBlock(input.results)}`,
    `\nWhat to do: ${task}`,
    `\nTalk like a helpful friend, not a report. Keep it tight.`,
  ]
    .filter(Boolean)
    .join("\n");

  return generateChatFromProvider(
    [{ role: "user", content: prompt }],
    "You are Zed, a warm, plain-spoken personal assistant. You never use jargon or corporate filler. You are honest, and you never invent facts or sources.",
    { lane: "research" },
  );
}

export async function listSavedResearch(userId: string): Promise<SavedResearchItem[]> {
  const stored = await readAppState<SavedResearchItem[]>(SAVED_SCOPE, userId);
  return Array.isArray(stored) ? stored : [];
}

export async function saveResearchItem(input: {
  userId: string;
  query: string;
  note?: string;
  results?: ResearchResult[];
}): Promise<SavedResearchItem> {
  const item: SavedResearchItem = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    query: String(input.query || "").trim(),
    note: String(input.note || "").trim(),
    results: (input.results || []).slice(0, 10),
  };
  const existing = await listSavedResearch(input.userId);
  await writeAppState(SAVED_SCOPE, input.userId, [item, ...existing].slice(0, MAX_SAVED));
  return item;
}

export async function deleteSavedResearch(userId: string, id: string): Promise<SavedResearchItem[]> {
  const items = await listSavedResearch(userId);
  const next = items.filter((i) => i.id !== id);
  await writeAppState(SAVED_SCOPE, userId, next);
  return next;
}
