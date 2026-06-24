import type { TradingKnowledgeCategory, TradingKnowledgeEntry } from "../../../shared/trading-types";

import { TradingStore } from "./TradingStore";

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
    keywords: ["market structure", "trend", "break of structure", "bos", "choch", "support", "resistance", "supply", "demand", "range", "breakout", "reversal"],
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

export async function importTradingKnowledge(input: ImportTradingKnowledgeInput): Promise<TradingKnowledgeEntry> {
  const lines = normalizeLines(input.text);
  const category = detectCategory(input.text);
  const tags = Array.from(new Set([...(input.tags || []), ...detectTags(input.text)]));

  return TradingStore.addKnowledge({
    source: input.source,
    sourceType: input.sourceType || "manual",
    category,
    title: input.title || input.source || "Trading knowledge import",
    concepts: pickLines(lines, ["concept", "means", "is when", "refers to", "market structure", "liquidity", "trend"]),
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
  const entries = await TradingStore.searchKnowledge(query, 6);
  if (!entries.length) {
    return "No stored trading knowledge matched this request yet. Use Phase 1 knowledge import to teach ZED structured concepts before relying on setup evaluation.";
  }

  return entries
    .map((entry) => {
      const rules = entry.rules.slice(0, 3).map((rule) => `- ${rule}`).join("\n");
      const risk = entry.riskRules.slice(0, 2).map((rule) => `- ${rule}`).join("\n");
      const entriesText = entry.entryCriteria.slice(0, 2).map((rule) => `- ${rule}`).join("\n");
      return [`${entry.title} (${entry.category})`, rules && `Rules:\n${rules}`, entriesText && `Entry criteria:\n${entriesText}`, risk && `Risk rules:\n${risk}`]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}
