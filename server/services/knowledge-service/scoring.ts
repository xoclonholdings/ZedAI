import { PERSONAL_MEMORY_TYPES } from "./types";

/** Lowercase + strip punctuation so keyword matching is whitespace-tolerant. */
export function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
}

/**
 * Pulls the up-to-12 distinct keywords ≥3 chars from the query.
 * Short tokens are dropped because they cause false-positive hits
 * everywhere; 12 is the cap so scoring stays O(n*k) bounded.
 */
export function extractKeywords(query: string): string[] {
  return Array.from(
    new Set(
      normalizeText(query)
        .split(/\s+/)
        .map((part) => part.trim())
        .filter((part) => part.length >= 3),
    ),
  ).slice(0, 12);
}

export function scoreText(text: string, keywords: string[]): number {
  const haystack = normalizeText(text);
  return keywords.reduce(
    (score, keyword) => score + (haystack.includes(keyword) ? 1 : 0),
    0,
  );
}

/**
 * Weighted relevance score for a project-memory entry. Personal-type
 * memories (profile / identity / preferences / goals) get a flat +5
 * boost so they show up even when the user's question doesn't share
 * keywords with the stored content.
 */
export function scoreProjectMemory(
  entry: { name: string; description: string | null; content: string; type?: string | null },
  keywords: string[],
): number {
  return (
    (PERSONAL_MEMORY_TYPES.has((entry.type || "").toLowerCase()) ? 5 : 0) +
    scoreText(entry.name, keywords) * 4 +
    scoreText(entry.description || "", keywords) * 2 +
    scoreText(entry.type || "", keywords) * 2 +
    scoreText(entry.content, keywords)
  );
}

/**
 * Scratchpad scoring favors tag matches over body matches, and
 * gives a +5 bonus to entries scoped to the active conversation —
 * so the in-flight thread's notes win against older scraps.
 */
export function scoreScratchpadMemory(
  entry: { content: string; tags?: string[] | null; conversationId?: string | null },
  keywords: string[],
  conversationId?: string,
): number {
  return (
    scoreText(entry.content, keywords) * 2 +
    scoreText((entry.tags || []).join(" "), keywords) * 3 +
    (conversationId && entry.conversationId === conversationId ? 5 : 0)
  );
}

/** Truncate-with-ellipsis used by every excerpt in the prompt. */
export function safeExcerpt(text: string, max = 320): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1)}…`;
}
