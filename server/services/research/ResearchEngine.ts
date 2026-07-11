import { randomUUID } from "crypto";

import type { ResearchBrief } from "../../../shared/research-types";
import { generateChatFromProvider } from "../ModelProviderService";
import { readAppState, writeAppState } from "../appState";

/**
 * The Research workspace's engine. Turns a subject (plus any sources the
 * user pasted) into a structured, editable brief, and persists briefs
 * durably so the desk fills up over time.
 *
 * Honesty: there is no live web-data source wired in, so a brief is a
 * DRAFT grounded in Zed's own knowledge and whatever sources the user
 * provided — never fabricated live figures or fake citations. When the
 * model provider is unavailable it fails clearly rather than inventing.
 */

const SCOPE = "research:briefs";
const MAX_BRIEFS = 100;

function toStringArray(value: unknown, limit = 8): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v : String(v ?? "")))
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body.trim();
}

export async function listResearchBriefs(userId: string): Promise<ResearchBrief[]> {
  const stored = await readAppState<ResearchBrief[]>(SCOPE, userId);
  return Array.isArray(stored) ? stored : [];
}

export async function deleteResearchBrief(userId: string, id: string): Promise<ResearchBrief[]> {
  const briefs = await listResearchBriefs(userId);
  const next = briefs.filter((b) => b.id !== id);
  await writeAppState(SCOPE, userId, next);
  return next;
}

export interface GenerateBriefInput {
  userId: string;
  topic: string;
  /** Optional source text the user pasted (notes, an article, etc.). */
  sources?: string;
}

export async function generateResearchBrief(input: GenerateBriefInput): Promise<ResearchBrief> {
  const topic = String(input.topic || "").trim();
  if (!topic) throw new Error("A research topic is required.");

  const sourceText = String(input.sources || "").trim();
  const hasSources = sourceText.length > 0;

  const prompt = [
    `Research subject: ${topic}`,
    hasSources
      ? `\nThe user provided these sources — ground your findings in them where relevant:\n"""\n${sourceText.slice(0, 6000)}\n"""`
      : "",
    `\nProduce a working research brief. Be concrete and honest. Do NOT invent live prices, statistics, or citations you can't support — if something needs current data you don't have, put it under openQuestions instead. Return ONLY JSON with this exact shape:`,
    `{`,
    `  "summary": "3-5 sentence orientation on the subject",`,
    `  "keyFindings": ["the core things worth knowing"],`,
    `  "risks": ["risks, unknowns, or cautions"],`,
    `  "openQuestions": ["what to dig into next"],`,
    `  "nextSteps": ["concrete next actions"]`,
    `}`,
  ].join("\n");

  const raw = await generateChatFromProvider(
    [{ role: "user", content: prompt }],
    "You are Zed's research analyst. You produce structured, sourced-where-possible briefs and never fabricate data. Output only the JSON object requested.",
    { lane: "research" },
  );

  let parsed: any = {};
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    // Fall back to a minimal brief rather than throwing, so the desk
    // still records the attempt with the raw text as the summary.
    parsed = { summary: raw.slice(0, 600) };
  }

  const brief: ResearchBrief = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    topic,
    summary: String(parsed.summary || "").trim() || "No summary was produced.",
    keyFindings: toStringArray(parsed.keyFindings),
    risks: toStringArray(parsed.risks),
    openQuestions: toStringArray(parsed.openQuestions),
    nextSteps: toStringArray(parsed.nextSteps),
    sources: hasSources ? [sourceText.slice(0, 4000)] : [],
    draft: true,
    basis: hasSources
      ? "Draft brief grounded in the sources you provided plus Zed's knowledge. No live web data — verify anything time-sensitive."
      : "Draft brief from Zed's own knowledge (no sources provided, no live web data). Add sources or verify anything time-sensitive.",
  };

  const existing = await listResearchBriefs(input.userId);
  await writeAppState(SCOPE, input.userId, [brief, ...existing].slice(0, MAX_BRIEFS));

  return brief;
}
