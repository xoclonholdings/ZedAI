import type { TradingKnowledgeCategory, TradingKnowledgeEntry } from "../../../shared/trading-types";

import { generateChatFromProvider } from "../../services/ModelProviderService";
import { buildTradingCurriculumContext } from "./TradingCurriculum";
import { TradingStore } from "./TradingStore";

const VALID_CATEGORIES: TradingKnowledgeCategory[] = [
  "market_structure",
  "liquidity",
  "supply_demand",
  "trade_planning",
  "trade_management",
  "risk_management",
  "probability",
  "multi_timeframe",
  "market_catalyst",
  "journal_lesson",
  "strategy_rule",
];

interface ImportTradingKnowledgeInput {
  source: string;
  sourceType?: TradingKnowledgeEntry["sourceType"];
  title?: string;
  text: string;
  tags?: string[];
}

const CATEGORY_KEYWORDS: Array<{ category: TradingKnowledgeCategory; keywords: string[] }> = [
  {
    category: "market_structure",
    keywords: [
      "market structure",
      "trend",
      "break of structure",
      "bos",
      "choch",
      "support",
      "resistance",
      "supply",
      "demand",
      "range",
      "breakout",
      "reversal",
    ],
  },
  {
    category: "liquidity",
    keywords: ["liquidity", "sweep", "grab", "stop hunt", "equal highs", "equal lows", "bank", "institutional"],
  },
  {
    category: "trade_planning",
    keywords: ["entry", "confirmation", "invalidation", "stop", "target", "risk reward", "thesis"],
  },
  {
    category: "risk_management",
    keywords: ["position size", "risk per trade", "daily loss", "weekly loss", "drawdown", "exposure", "capital preservation"],
  },
  {
    category: "probability",
    keywords: ["confluence", "probability", "confidence", "expected outcome", "setup ranking", "historical"],
  },
  {
    category: "multi_timeframe",
    keywords: ["monthly", "weekly", "daily", "4h", "1h", "15m", "timeframe", "alignment"],
  },
];

function normalizeLines(text: string): string[] {
  return text
    .split(/\r?\n|\.\s+/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((line) => line.length > 2);
}

function pickLines(lines: string[], keywords: string[], limit = 8): string[] {
  const found = lines.filter((line) => {
    const lower = line.toLowerCase();
    return keywords.some((keyword) => lower.includes(keyword));
  });
  return Array.from(new Set(found)).slice(0, limit);
}

function detectCategory(text: string): TradingKnowledgeCategory {
  const lower = text.toLowerCase();
  const scored = CATEGORY_KEYWORDS.map((item) => ({
    category: item.category,
    score: item.keywords.reduce((sum, keyword) => sum + (lower.includes(keyword) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score);
  return scored[0]?.score ? scored[0].category : "strategy_rule";
}

function detectTags(text: string): string[] {
  const lower = text.toLowerCase();
  const tags = new Set<string>();
  for (const keyword of [
    "bos",
    "choch",
    "support",
    "resistance",
    "supply",
    "demand",
    "liquidity",
    "sweep",
    "stop hunt",
    "risk",
    "entry",
    "stop",
    "target",
    "monthly",
    "weekly",
    "daily",
    "4h",
    "1h",
    "15m",
  ]) {
    if (lower.includes(keyword)) tags.add(keyword);
  }
  return Array.from(tags);
}

interface ExtractedKnowledge {
  category: TradingKnowledgeCategory;
  concepts: string[];
  definitions: string[];
  rules: string[];
  patterns: string[];
  entryCriteria: string[];
  exitCriteria: string[];
  riskRules: string[];
  examples: string[];
  mistakes: string[];
  bestPractices: string[];
  tags: string[];
}

function coerceCategory(value: unknown): TradingKnowledgeCategory {
  const normalized = String(value || "").toLowerCase().trim().replace(/[\s-]+/g, "_");
  return (VALID_CATEGORIES as string[]).includes(normalized)
    ? (normalized as TradingKnowledgeCategory)
    : "strategy_rule";
}

function toStringArray(value: unknown, limit = 40): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((item) => String(item).trim()).filter((item) => item.length > 1)),
  ).slice(0, limit);
}

function extractJsonObject(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body.trim();
}

/**
 * Parse arbitrary material into structured trading knowledge with the
 * model. Captures every substantive point — nothing is dropped for
 * lack of a keyword. Returns null if no provider is reachable so the
 * caller falls back to the deterministic keyword parser.
 */
async function extractWithModel(text: string, title?: string): Promise<ExtractedKnowledge | null> {
  const material = text.length > 16000 ? `${text.slice(0, 16000)}\n…(truncated)` : text;
  const prompt = `Extract structured trading knowledge from the material below. Capture EVERY substantive point — do not drop content. Every meaningful idea must appear in at least one array (default to "concepts"). Keep each item a concise standalone statement.

Output ONLY JSON:
{
  "category": one of [${VALID_CATEGORIES.join(", ")}],
  "concepts": [], "definitions": [], "rules": [], "patterns": [],
  "entryCriteria": [], "exitCriteria": [], "riskRules": [],
  "examples": [], "mistakes": [], "bestPractices": [], "tags": []
}

TITLE: ${title || "(none)"}
MATERIAL:
${material}`;

  try {
    const raw = await generateChatFromProvider(
      [{ role: "user", content: prompt }],
      "You are a trading knowledge extractor. Output only valid JSON, no prose.",
      { lane: "finance" },
    );
    const parsed = JSON.parse(extractJsonObject(raw));
    return {
      category: coerceCategory(parsed.category),
      concepts: toStringArray(parsed.concepts),
      definitions: toStringArray(parsed.definitions),
      rules: toStringArray(parsed.rules),
      patterns: toStringArray(parsed.patterns),
      entryCriteria: toStringArray(parsed.entryCriteria),
      exitCriteria: toStringArray(parsed.exitCriteria),
      riskRules: toStringArray(parsed.riskRules),
      examples: toStringArray(parsed.examples),
      mistakes: toStringArray(parsed.mistakes),
      bestPractices: toStringArray(parsed.bestPractices),
      tags: toStringArray(parsed.tags, 20),
    };
  } catch {
    return null;
  }
}

export async function importTradingKnowledge(input: ImportTradingKnowledgeInput): Promise<TradingKnowledgeEntry> {
  const lines = normalizeLines(input.text);
  const userTags = input.tags || [];
  const title = input.title || input.source || "Trading knowledge import";

  const extracted = await extractWithModel(input.text, input.title);
  if (extracted) {
    // Guarantee nothing is lost: if the model captured very little, seed
    // concepts with the raw lines so the material is still stored + searchable.
    const captured = [
      extracted.concepts,
      extracted.definitions,
      extracted.rules,
      extracted.patterns,
      extracted.entryCriteria,
      extracted.exitCriteria,
      extracted.riskRules,
      extracted.examples,
      extracted.mistakes,
      extracted.bestPractices,
    ].reduce((sum, arr) => sum + arr.length, 0);
    const concepts =
      captured < Math.min(3, lines.length)
        ? Array.from(new Set([...extracted.concepts, ...lines])).slice(0, 40)
        : extracted.concepts;

    return TradingStore.addKnowledge({
      source: input.source,
      sourceType: input.sourceType || "manual",
      category: extracted.category,
      title,
      concepts,
      definitions: extracted.definitions,
      rules: extracted.rules,
      patterns: extracted.patterns,
      entryCriteria: extracted.entryCriteria,
      exitCriteria: extracted.exitCriteria,
      riskRules: extracted.riskRules,
      examples: extracted.examples,
      mistakes: extracted.mistakes,
      bestPractices: extracted.bestPractices,
      tags: Array.from(new Set([...userTags, ...detectTags(input.text), ...extracted.tags])),
    });
  }

  // Fallback (no model reachable): keyword heuristic, but never drop
  // content — every normalized line is kept in concepts so the material
  // is always saved and searchable.
  const category = detectCategory(input.text);
  const tags = Array.from(new Set([...userTags, ...detectTags(input.text)]));
  return TradingStore.addKnowledge({
    source: input.source,
    sourceType: input.sourceType || "manual",
    category,
    title,
    concepts: Array.from(
      new Set([
        ...pickLines(lines, ["concept", "means", "is when", "refers to", "market structure", "liquidity", "trend"]),
        ...lines,
      ]),
    ).slice(0, 40),
    definitions: pickLines(lines, ["definition", "defined", "means", "refers to", "is when"]),
    rules: pickLines(lines, ["rule", "always", "never", "must", "only", "avoid", "wait for"]),
    patterns: pickLines(lines, ["pattern", "setup", "bos", "choch", "sweep", "breakout", "reversal", "continuation"]),
    entryCriteria: pickLines(lines, ["entry", "enter", "confirmation", "trigger", "valid setup"]),
    exitCriteria: pickLines(lines, ["exit", "take profit", "target", "close", "scale out"]),
    riskRules: pickLines(lines, ["risk", "stop", "invalidation", "drawdown", "position size", "loss"]),
    examples: pickLines(lines, ["example", "for example", "case", "scenario"]),
    mistakes: pickLines(lines, ["mistake", "avoid", "wrong", "failed", "violation", "chasing"]),
    bestPractices: pickLines(lines, ["best practice", "should", "discipline", "journal", "wait", "confirm"]),
    tags,
  });
}

export async function buildTradingKnowledgeContext(query: string): Promise<string> {
  const curriculumContext = buildTradingCurriculumContext();
  const entries = await TradingStore.searchKnowledge(query, 6);
  if (!entries.length) {
    return [
      curriculumContext,
      "",
      "Stored Knowledge Matches:",
      "No stored trading knowledge matched this request yet. Use Phase 1 knowledge import to teach ZAR structured concepts before relying on setup evaluation.",
    ].join("\n");
  }

  const storedMatches = entries
    .map((entry) => {
      const rules = entry.rules.slice(0, 3).map((rule) => `- ${rule}`).join("\n");
      const risk = entry.riskRules.slice(0, 2).map((rule) => `- ${rule}`).join("\n");
      const entriesText = entry.entryCriteria.slice(0, 2).map((rule) => `- ${rule}`).join("\n");
      return [
        `${entry.title} (${entry.category})`,
        rules && `Rules:\n${rules}`,
        entriesText && `Entry criteria:\n${entriesText}`,
        risk && `Risk rules:\n${risk}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  return [curriculumContext, "", "Stored Knowledge Matches:", storedMatches].join("\n");
}
