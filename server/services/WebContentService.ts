export interface WebTarget {
  original: string;
  url: string;
}

export interface WebPageResult {
  url: string;
  title?: string;
  text: string;
  status: number;
  contentType?: string;
}

export interface WebFetchResponse {
  targets: WebTarget[];
  pages: WebPageResult[];
  errors: Array<{ url: string; error: string }>;
}

const URL_PATTERN = /\bhttps?:\/\/[^\s)\]}>'"]+/gi;
const WWW_PATTERN = /\bwww\.[^\s)\]}>'"]+/gi;
const DOMAIN_PATTERN = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\/?[^\s)\]}>'"]*/gi;
const FILE_EXT_PATTERN = /\.(txt|md|pdf|png|jpe?g|gif|webp|json|ya?ml|csv|xlsx?|docx?|mp[34]|wav|zip|tar|gz)\b/i;

function trimTrailingPunctuation(value: string): string {
  return value.replace(/[.,!?;:]+$/g, "");
}

function normalizeTarget(raw: string): WebTarget | null {
  const original = trimTrailingPunctuation(raw.trim());
  if (!original) return null;
  if (FILE_EXT_PATTERN.test(original)) return null;

  const url = /^https?:\/\//i.test(original)
    ? original
    : `https://${original.replace(/^www\./i, "www.")}`;

  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes(".")) return null;
    return { original, url: parsed.toString() };
  } catch {
    return null;
  }
}

export function extractWebTargets(text: string): WebTarget[] {
  const matches = new Set<string>();
  for (const pattern of [URL_PATTERN, WWW_PATTERN, DOMAIN_PATTERN]) {
    for (const match of text.matchAll(pattern)) {
      if (match[0]) matches.add(match[0]);
    }
  }

  const targets: WebTarget[] = [];
  const seen = new Set<string>();
  for (const match of matches) {
    const target = normalizeTarget(match);
    if (!target || seen.has(target.url)) continue;
    seen.add(target.url);
    targets.push(target);
  }
  return targets;
}

export function hasWebsiteReferenceWithoutTarget(text: string): boolean {
  if (extractWebTargets(text).length > 0) return false;
  return /\b(this|that|the)\s+(website|site|page|link|url)\b/i.test(text) ||
    /\b(visit|open|read|check|inspect|browse)\s+(it|that|this|the website|the site|the page)\b/i.test(text);
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCharCode(parseInt(code, 16)));
}

function htmlToText(html: string): { title?: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch?.[1]
    ? decodeHtmlEntities(titleMatch[1].replace(/\s+/g, " ").trim())
    : undefined;

  const text = decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );

  return { title, text };
}

async function fetchOnePage(target: WebTarget): Promise<WebPageResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(target.url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "ZED-AI/1.0 (+https://zed-ai.online)",
        Accept: "text/html,application/xhtml+xml,application/xml,text/plain;q=0.9,*/*;q=0.8",
      },
    });

    const contentType = res.headers.get("content-type") || "";
    const raw = await res.text();
    const parsed = contentType.includes("html") ? htmlToText(raw) : { text: raw.replace(/\s+/g, " ").trim() };

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return {
      url: res.url || target.url,
      title: parsed.title,
      text: parsed.text.slice(0, 12_000),
      status: res.status,
      contentType,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchWebTargetsFromText(text: string, limit = 3): Promise<WebFetchResponse> {
  const targets = extractWebTargets(text).slice(0, limit);
  const pages: WebPageResult[] = [];
  const errors: Array<{ url: string; error: string }> = [];

  for (const target of targets) {
    try {
      const page = await fetchOnePage(target);
      if (page.text) pages.push(page);
    } catch (err: any) {
      errors.push({ url: target.url, error: err?.message || String(err) });
    }
  }

  return { targets, pages, errors };
}

export function formatWebPagesForPrompt(response: WebFetchResponse): string {
  if (response.pages.length === 0) {
    if (response.targets.length === 0) {
      return "No direct webpage URL was available to fetch.";
    }
    return [
      "Direct webpage fetch was attempted but no readable page content was returned.",
      ...response.errors.map((entry) => `- ${entry.url}: ${entry.error}`),
    ].join("\n");
  }

  const lines = [
    "## Direct webpage content fetched by ZED",
    "Use this page content as live source material. If the user asks whether the site/page was visited, answer from this fetched context instead of saying browsing is unavailable.",
  ];

  for (const page of response.pages) {
    lines.push([
      `### ${page.title || page.url}`,
      `URL: ${page.url}`,
      `Status: ${page.status}`,
      page.text,
    ].join("\n"));
  }

  return lines.join("\n\n");
}
