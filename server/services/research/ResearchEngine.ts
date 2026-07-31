import { randomUUID } from "crypto";

import { generateChatFromProvider } from "../ModelProviderService";
import { buildWorkspaceMemoryContext } from "../WorkspaceMemoryService";
import { readAppState, writeAppState } from "../appState";

/**
 * The Research workspace engine.
 *
 * Search is the front door. After ZAR looks something up, you can ask him
 * to do one of a few plain things with it: give the short version,
 * check if it's legit / worth it, or save it for later. "Other" lets you
 * say what you want in your own words.
 *
 * Every action grounds in the Research workspace's own memory first, and
 * in the actual search results — ZAR never invents sources or facts.
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

export interface ActionResult {
  ok: boolean;
  text: string;
  /** True when it's worth tapping "try again". */
  retryable: boolean;
}

/**
 * Turn any brain/model failure into something ZAR would actually say to a
 * person — plain, warm, no error codes — and tell them whether to retry.
 */
function friendlyBrainFailure(error: unknown): string {
  const message = (error instanceof Error ? error.message : String(error || "")).toLowerCase();
  if (
    message.includes("timeout") ||
    message.includes("aborted") ||
    message.includes("timed out")
  ) {
    return "That one took too long and timed out on my end. Give it another tap and I'll try again.";
  }
  if (
    message.includes("fetch failed") ||
    message.includes("econnrefused") ||
    message.includes("enotfound") ||
    message.includes("unreachable") ||
    message.includes("network")
  ) {
    return "I couldn't reach my brain just now, so I couldn't think that through. Give it a moment and try again.";
  }
  if (
    message.includes("not configured") ||
    message.includes("lightning") ||
    message.includes("base_url") ||
    message.includes("api key") ||
    message.includes("401") ||
    message.includes("403") ||
    message.includes("unauthorized")
  ) {
    return "My thinking isn't switched on yet on this end, so I can't write that up. Once it's connected, tap try again and I'll do it.";
  }
  return "Something hiccuped on my end and I couldn't finish that. Mind trying again?";
}

export async function runResearchAction(input: RunActionInput): Promise<ActionResult> {
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

  try {
    const text = await generateChatFromProvider(
      [{ role: "user", content: prompt }],
      "You are ZAR, a warm, plain-spoken personal assistant. You never use jargon or corporate filler. You are honest, and you never invent facts or sources.",
      { lane: "research" },
    );
    if (!text || !text.trim()) {
      return {
        ok: false,
        text: "I came up empty on that one — nothing useful came back. Give it another try?",
        retryable: true,
      };
    }
    return { ok: true, text: text.trim(), retryable: false };
  } catch (error) {
    console.warn("[Research] action failed:", error);
    return { ok: false, text: friendlyBrainFailure(error), retryable: true };
  }
}

// ── Create / Document ──────────────────────────────────────────────

export interface ResearchDocument {
  id: string;
  createdAt: string;
  title: string;
  content: string;
}

export interface DocumentDraft {
  ok: boolean;
  title: string;
  content: string;
  retryable: boolean;
}

const DOCS_SCOPE = "research:documents";
const MAX_DOCS = 200;

export async function createResearchDocument(input: {
  userId: string;
  instruction: string;
  title?: string;
  sources?: string;
  docType?: string;
}): Promise<DocumentDraft> {
  const instruction = String(input.instruction || "").trim();
  const sourceText = String(input.sources || "").trim();
  const docType = String(input.docType || "").trim();

  const memory = await buildWorkspaceMemoryContext("research", instruction).catch(() => ({
    prompt: "",
    count: 0,
    used: false,
  }));

  const prompt = [
    memory.used ? `${memory.prompt}\n` : "",
    docType
      ? `Write this up as a ${docType.toLowerCase()} - a clean, readable document a normal person could open later and get everything they need.`
      : `Write this up as a clean, readable document a normal person could open later and get everything they need.`,
    input.title ? `Suggested title: ${input.title}` : "",
    `What it should cover: ${instruction || "Write up the research below."}`,
    sourceText ? `\nMaterial to base it on:\n"""\n${sourceText.slice(0, 8000)}\n"""` : "",
    `\nUse plain language and whatever structure actually fits a ${docType || "document"} (headings only if that's normal for this type - a letter or resume shouldn't get markdown headers). Start with a one-line title on the first line, then the body. No jargon, no invented facts.`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await generateChatFromProvider(
      [{ role: "user", content: prompt }],
      "You are ZAR, writing a clear, honest document for a real person. Plain language, no filler, no invented facts or sources.",
      { lane: "research" },
    );
    const text = (raw || "").trim();
    if (!text) {
      return { ok: false, title: input.title || "", content: "I came up empty writing that. Try again?", retryable: true };
    }
    // First non-empty line becomes the title; the rest is the body.
    const lines = text.split("\n");
    const firstIdx = lines.findIndex((l) => l.trim());
    const title =
      (input.title && input.title.trim()) ||
      lines[firstIdx]?.replace(/^#+\s*/, "").trim().slice(0, 120) ||
      "Untitled document";
    const content = input.title ? text : lines.slice(firstIdx + 1).join("\n").trim() || text;
    return { ok: true, title, content, retryable: false };
  } catch (error) {
    console.warn("[Research] document failed:", error);
    return { ok: false, title: input.title || "", content: friendlyBrainFailure(error), retryable: true };
  }
}

export async function listResearchDocuments(userId: string): Promise<ResearchDocument[]> {
  const stored = await readAppState<ResearchDocument[]>(DOCS_SCOPE, userId);
  return Array.isArray(stored) ? stored : [];
}

export async function saveResearchDocument(input: {
  userId: string;
  title: string;
  content: string;
}): Promise<ResearchDocument> {
  const doc: ResearchDocument = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    title: String(input.title || "Untitled document").trim(),
    content: String(input.content || "").trim(),
  };
  const existing = await listResearchDocuments(input.userId);
  await writeAppState(DOCS_SCOPE, input.userId, [doc, ...existing].slice(0, MAX_DOCS));
  return doc;
}

export async function deleteResearchDocument(userId: string, id: string): Promise<ResearchDocument[]> {
  const docs = await listResearchDocuments(userId);
  const next = docs.filter((d) => d.id !== id);
  await writeAppState(DOCS_SCOPE, userId, next);
  return next;
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
