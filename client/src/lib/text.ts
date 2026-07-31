/**
 * Stored summaries sometimes carry raw source markup straight through —
 * literal "\n" sequences, markdown headings, blockquotes, list bullets — so
 * this strips that before anything renders it as plain UI text. Centralized
 * here because five different pages were truncating `.summary` by hand
 * without cleaning it first.
 */
export function cleanSummary(text: string, maxLen = 200): string {
  if (!text) return "";
  // Strip line-anchored markdown (headings, quotes, bullets, rules) while
  // "\n" is still a real line break — flattening to one line first would
  // leave "###"/"---"/">" with no line-start left to match against.
  const stripped = text
    .replace(/\\n/g, "\n")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^-{3,}$/gm, "")
    .replace(/[*_`]/g, "");
  const flattened = stripped
    .replace(/\r?\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (flattened.length <= maxLen) return flattened;
  return `${flattened.slice(0, maxLen).trimEnd()}…`;
}

/** Same cleanup as cleanSummary, tuned for a one-line title/name field —
 * some records end up with a full raw text dump in their name instead of
 * a short title, so titles can't be trusted to render safely as-is either. */
export function cleanTitle(text: string, maxLen = 80): string {
  return cleanSummary(text, maxLen);
}

/** For full-detail views where real paragraph breaks should render (unlike
 * cleanSummary, which flattens to one line): just unescape literal "\n"
 * sequences into real line breaks. Pair with `whitespace-pre-line` in CSS. */
export function unescapeText(text: string): string {
  if (!text) return "";
  return text.replace(/\\n/g, "\n");
}

/** Humanize a filesystem-style source path (Windows or POSIX) into a short
 * label instead of showing the raw path — URLs pass through unchanged. */
export function friendlySource(source: string): string {
  if (!source) return source;
  if (/^https?:\/\//i.test(source)) return source;
  const segment = source.split(/[\\/]/).pop() || source;
  const withoutExt = segment.replace(/\.[a-z0-9]+$/i, "");
  const humanized = withoutExt
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
  return humanized || source;
}
