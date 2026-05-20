import { webSearch, formatResultsForPrompt, webSearchAvailable, type SearchResponse } from "./WebSearchService";

/**
 * Detects URLs and web-research intent in a user message and fetches
 * live web results for them. The result is a formatted markdown block
 * that callers append to the system prompt for ANY lane (chat,
 * operations, business, finance) — not just R&D. This way Zed can
 * answer accurately about any URL the user pastes, and its agents
 * get the real-world data they need to do their work.
 *
 * The R&D / Intelligence agent runs its own deeper search inside
 * `research()`, so callers routing to that agent should skip this
 * helper to avoid duplicate work.
 */

const URL_REGEX =
  /https?:\/\/[^\s)]+|(?<![a-zA-Z0-9@])(?:www\.)?[a-z0-9-]+\.(?:com|org|net|io|ai|app|dev|co|us|gov|edu|uk|de|fr|ca|au|info|biz|tech|online|xyz|me)(?:\/[^\s)]*)?/gi;

const WEB_INTENT_PHRASES = [
  "latest",
  "current",
  "news on",
  "news about",
  "what's happening with",
  "browse",
  "visit",
  "open this site",
  "open the site",
  "go to",
  "inspect",
  "check this site",
  "look up online",
  "search the web",
  "search online",
  "google",
  "what does this website",
  "analyze this website",
  "audit this website",
  "review this website",
  "summarize this page",
  "summarize this website",
];

export interface WebContextResult {
  /** Markdown block to append to the system prompt. Empty string when no fetch happened. */
  text: string;
  /** The queries that were actually searched. */
  queries: string[];
  /** Total result count across all queries. */
  resultCount: number;
  /** True when web intent was detected (URL or phrase). */
  triggered: boolean;
  /** Why context was not fetched, if applicable. */
  skippedReason?: "no-intent" | "no-provider";
}

export function hasWebIntent(message: string): boolean {
  if (!message) return false;
  if (extractUrls(message).length > 0) return true;
  const lower = message.toLowerCase();
  return WEB_INTENT_PHRASES.some((p) => lower.includes(p));
}

export function extractUrls(message: string): string[] {
  if (!message) return [];
  // Reset lastIndex on the global regex; matchAll handles it safely.
  return Array.from(message.matchAll(URL_REGEX)).map((m) => m[0]);
}

/**
 * Build the list of search queries from a message. URLs are searched
 * as-is (gives back title + description + sibling pages). When there's
 * no URL but a web-intent phrase is present, the whole message becomes
 * the query.
 */
export function buildQueries(message: string): string[] {
  const queries = new Set<string>();
  const urls = extractUrls(message);
  for (const u of urls) queries.add(u);
  if (urls.length === 0 && hasWebIntent(message)) {
    queries.add(message.trim().slice(0, 200));
  }
  return Array.from(queries).slice(0, 3);
}

export async function fetchWebContext(message: string): Promise<WebContextResult> {
  if (!hasWebIntent(message)) {
    return { text: "", queries: [], resultCount: 0, triggered: false, skippedReason: "no-intent" };
  }

  if (!webSearchAvailable()) {
    return {
      text: [
        "## Live Web Context (attempted)",
        "The user's message references a URL or web content, but no web search provider is configured (Brave or Serper).",
        "Tell the user this honestly if your answer would require live data, and suggest enabling a provider in Admin → Integrations.",
      ].join("\n"),
      queries: buildQueries(message),
      resultCount: 0,
      triggered: true,
      skippedReason: "no-provider",
    };
  }

  const queries = buildQueries(message);
  if (queries.length === 0) {
    return { text: "", queries: [], resultCount: 0, triggered: true };
  }

  const responses: SearchResponse[] = await Promise.all(queries.map((q) => webSearch(q, 4)));
  const resultCount = responses.reduce((sum, r) => sum + (r.results?.length || 0), 0);
  const blocks = responses.map((r) => formatResultsForPrompt(r));

  const header =
    resultCount > 0
      ? `## Live Web Context\nThe user's message referenced URLs or web content. The following live search results were fetched automatically. Use them directly to answer — do not say you cannot browse. Cite or paraphrase as appropriate.`
      : `## Live Web Context (no results)\nThe user's message referenced URLs or web content, but the configured web search provider returned no results for: ${queries.map((q) => `"${q}"`).join(", ")}. Explain this to the user and offer concrete next steps (rephrase, narrower keywords, or try a different URL).`;

  return {
    text: `${header}\n\n${blocks.join("\n\n")}`,
    queries,
    resultCount,
    triggered: true,
  };
}
