/**
 * Renders an IntelligenceAgent result into mobile-readable markdown.
 * This formatter must not add canned conversational language. It only
 * cleans internal parse markers and preserves useful agent output.
 */

const INTERNAL_TEXT_PATTERNS = [
  /\bsource trail\b/gi,
  /\bresearch brief results\b/gi,
  /\bconfigured model synthesis\b/gi,
  /\banalyze competitors workflow\b/gi,
  /\bworkflow(?: name| route| used)?\b/gi,
  /\bvia\s+(?:brave|serper)\b/gi,
  /\bbrave\b/gi,
  /\bserper\b/gi,
  /\blive web search results\b/gi,
  /^\s*(?:source|provider)\s*:\s*/gim,
];

const TEMPLATE_TEXT_PATTERNS = [
  /^\s*next\s+move\s*:\s*/gim,
  /^\s*recommended\s+action\s*:\s*/gim,
  /^\s*confidence(?:\s+level)?\s*:\s*/gim,
  /^\s*key\s+findings\s*:?\s*$/gim,
  /^\s*findings\s*:?\s*$/gim,
  /^\s*executive\s+summary\s*:?\s*$/gim,
  /^\s*research\s+brief\s*:?\s*$/gim,
  /\bgive me one more constraint or target,? and i can turn this into a cleaner action plan\.?/gi,
  /\bgive me the specific competitor set or market,? and i can turn this into a tighter action plan\.?/gi,
];

function cleanBriefText(value: unknown): string {
  let text = String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/^(?:SUBJECT|SOURCE_STRENGTH|POINTS|MEANING|NEXT_STEP)\s*:\s*/gim, "")
    .trim();

  for (const pattern of INTERNAL_TEXT_PATTERNS) {
    text = text.replace(pattern, "");
  }

  for (const pattern of TEMPLATE_TEXT_PATTERNS) {
    text = text.replace(pattern, "");
  }

  return text
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function uniqueCleanLines(values: unknown[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const cleaned = cleanBriefText(value);
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    output.push(cleaned);
  }

  return output.slice(0, 5);
}

export function formatBrief(
  brief: any,
  options: { includeSources?: boolean } = {},
): string {
  const points = Array.isArray(brief?.keyFindings)
    ? uniqueCleanLines(brief.keyFindings)
    : [];

  const directAnswer = cleanBriefText(
    points[0] || brief?.implications || brief?.recommendedAction || "",
  );

  const supportingPoints = points
    .filter((point) => point !== directAnswer)
    .slice(0, 4);
  const pointLines = supportingPoints.length > 0
    ? `\n\n${supportingPoints.map((point) => `- ${point}`).join("\n")}`
    : "";

  const sources = Array.isArray(brief?.sources)
    ? uniqueCleanLines(brief.sources)
    : [];
  const sourceSection = options.includeSources && sources.length > 0
    ? `\n\nSources:\n${sources.map((source) => `- ${source}`).join("\n")}`
    : "";

  return `${directAnswer}${pointLines}${sourceSection}`.trim();
}
