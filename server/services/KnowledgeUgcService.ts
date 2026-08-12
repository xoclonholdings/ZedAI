import { randomUUID } from "crypto";

import { readAppState, writeAppState } from "./appState";
import { extractKeywords, safeExcerpt, scoreText } from "./knowledge-service/scoring";

const UGC_WEBSITE_SCOPE = "knowledge:ugc:websites";
const MAX_SAVED_WEBSITES = 250;

export interface KnowledgeUgcWebsite {
  id: string;
  category: "ugc";
  contentType: "website";
  url: string;
  title: string;
  text: string;
  visitId: string;
  visitedAt: string;
  savedAt: string;
  updatedAt: string;
  provenance: {
    source: "live_browser";
    selection: "explicit_user_save";
    capturedAt: string;
  };
}

export interface SaveKnowledgeUgcWebsiteInput {
  userId: string;
  visitId: string;
  url: string;
  title?: string;
  text?: string;
  visitedAt: string;
}

function normalizeHttpUrl(value: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only loaded websites can be saved to UGC.");
  }
  parsed.hash = "";
  return parsed.toString();
}

export async function listKnowledgeUgcWebsites(userId: string): Promise<KnowledgeUgcWebsite[]> {
  return (await readAppState<KnowledgeUgcWebsite[]>(UGC_WEBSITE_SCOPE, userId)) || [];
}

export async function saveKnowledgeUgcWebsite(
  input: SaveKnowledgeUgcWebsiteInput,
): Promise<KnowledgeUgcWebsite> {
  const now = new Date().toISOString();
  const url = normalizeHttpUrl(input.url);
  const existing = await listKnowledgeUgcWebsites(input.userId);
  const previous = existing.find((item) => item.url === url);
  const item: KnowledgeUgcWebsite = {
    id: previous?.id || randomUUID(),
    category: "ugc",
    contentType: "website",
    url,
    title: input.title?.trim() || url,
    text: safeExcerpt(input.text || "", 12_000),
    visitId: input.visitId,
    visitedAt: input.visitedAt,
    savedAt: previous?.savedAt || now,
    updatedAt: now,
    provenance: {
      source: "live_browser",
      selection: "explicit_user_save",
      capturedAt: input.visitedAt,
    },
  };
  const next = [item, ...existing.filter((candidate) => candidate.id !== item.id)]
    .slice(0, MAX_SAVED_WEBSITES);
  const stored = await writeAppState(UGC_WEBSITE_SCOPE, input.userId, next);
  if (!stored) throw new Error("Knowledge UGC storage is unavailable.");
  return item;
}

export async function searchKnowledgeUgcWebsites(
  userId: string,
  query: string,
  limit = 5,
): Promise<KnowledgeUgcWebsite[]> {
  const keywords = extractKeywords(query);
  return (await listKnowledgeUgcWebsites(userId))
    .map((item) => ({
      item,
      score:
        scoreText(item.title, keywords) * 4 +
        scoreText(item.url, keywords) * 3 +
        scoreText(item.text, keywords),
    }))
    .filter(({ score }) => keywords.length === 0 || score > 0)
    .sort((a, b) => b.score - a.score || Date.parse(b.item.updatedAt) - Date.parse(a.item.updatedAt))
    .slice(0, limit)
    .map(({ item }) => item);
}
