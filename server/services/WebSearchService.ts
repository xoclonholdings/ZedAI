export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: "brave" | "serper" | "none";
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  source: "brave" | "serper" | "none";
  note?: string;
}

function getBraveApiKey(): string {
  return (process.env.BRAVE_SEARCH_API_KEY || "").trim();
}

function getSerperApiKey(): string {
  return (process.env.SERPER_API_KEY || "").trim();
}

export function getWebSearchStatus() {
  const braveKey = getBraveApiKey();
  const serperKey = getSerperApiKey();

  return {
    braveConfigured: braveKey.length > 0,
    braveKeyLength: braveKey.length,
    serperConfigured: serperKey.length > 0,
    serperKeyLength: serperKey.length,
  };
}

async function searchBrave(query: string, count = 5): Promise<SearchResult[]> {
  const braveKey = getBraveApiKey();

  if (!braveKey) {
    throw new Error("BRAVE_SEARCH_API_KEY not visible to server runtime.");
  }

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": braveKey,
    },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Brave API ${res.status}${detail ? `: ${detail.slice(0, 160)}` : ""}`);
  }

  const data = await res.json();

  return (data.web?.results || []).slice(0, count).map((r: any) => ({
    title: r.title || "",
    url: r.url || "",
    snippet: r.description || "",
    source: "brave" as const,
  }));
}

async function searchSerper(query: string, count = 5): Promise<SearchResult[]> {
  const serperKey = getSerperApiKey();

  if (!serperKey) {
    throw new Error("SERPER_API_KEY not visible to server runtime.");
  }

  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": serperKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num: count }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Serper API ${res.status}${detail ? `: ${detail.slice(0, 160)}` : ""}`);
  }

  const data = await res.json();

  return (data.organic || []).slice(0, count).map((r: any) => ({
    title: r.title || "",
    url: r.link || "",
    snippet: r.snippet || "",
    source: "serper" as const,
  }));
}

export async function webSearch(query: string, count = 5): Promise<SearchResponse> {
  const braveKey = getBraveApiKey();
  const serperKey = getSerperApiKey();

  if (braveKey) {
    try {
      const results = await searchBrave(query, count);
      console.log(`[WebSearch] Brave returned ${results.length} results for: ${query}`);
      return { results, query, source: "brave" };
    } catch (err) {
      console.warn("[WebSearch] Brave failed, trying Serper:", err);
    }
  }

  if (serperKey) {
    try {
      const results = await searchSerper(query, count);
      console.log(`[WebSearch] Serper returned ${results.length} results for: ${query}`);
      return { results, query, source: "serper" };
    } catch (err) {
      console.warn("[WebSearch] Serper failed:", err);
    }
  }

  console.log("[WebSearch] No search API keys visible to runtime — returning no search results");

  return {
    results: [],
    query,
    source: "none",
    note:
      "No search API results are available for this query. If direct webpage content is supplied separately, use that. If no URL or source context is available, ask for the exact URL instead of saying browsing is unavailable.",
  };
}

export function formatResultsForPrompt(response: SearchResponse): string {
  if (response.source === "none" || response.results.length === 0) {
    return response.note || "No search results are available. Use direct webpage content, model context, and memory when available.";
  }

  const lines = [`## Search context for: "${response.query}"\nDo not mention the search provider, search workflow, or internal query expansion in the user-facing answer.`];

  for (const r of response.results) {
    lines.push(`- ${r.title}\n  ${r.snippet}\n  URL: ${r.url}`);
  }

  return lines.join("\n");
}

export function webSearchAvailable(): boolean {
  return Boolean(getBraveApiKey() || getSerperApiKey());
}
