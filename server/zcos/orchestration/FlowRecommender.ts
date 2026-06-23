import { FlowStore } from "../../services/FlowStore";
import type { FlowCategory, FlowDefinition } from "../../../shared/flow-types";

export interface FlowRecommendation {
  flowId: string;
  slug: string;
  name: string;
  category: FlowCategory;
  reason: string;
  confidence: "high" | "medium";
  launchEndpoint: string;
}

interface IntentPattern {
  category: FlowCategory;
  keywords: string[];
  reason: string;
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    category: "business",
    keywords: [
      "business",
      "revenue",
      "make money",
      "launch a business",
      "monetize",
      "offer",
      "positioning",
      "growth plan",
      "business model",
    ],
    reason: "It can turn the goal into opportunity analysis, positioning, prioritization, and execution planning.",
  },
  {
    category: "research",
    keywords: [
      "research",
      "competitor",
      "market",
      "trend",
      "audience",
      "opportunity",
      "compare",
      "find",
      "analyze",
    ],
    reason: "It can structure the research, collect findings, and produce a report instead of a loose chat answer.",
  },
  {
    category: "learning",
    keywords: [
      "learn",
      "teach me",
      "study",
      "understand",
      "confused",
      "explain",
      "training plan",
      "learning path",
    ],
    reason: "It can convert the topic into a guided learning path with checkpoints and gaps to close.",
  },
  {
    category: "marketing",
    keywords: [
      "campaign",
      "social media",
      "content calendar",
      "promo",
      "launch content",
      "marketing",
      "seo",
      "audience growth",
    ],
    reason: "It can organize campaign planning, content ideas, timing, and performance follow-up.",
  },
  {
    category: "finance",
    keywords: [
      "crypto",
      "forex",
      "trade",
      "portfolio",
      "watchlist",
      "stock",
      "risk sizing",
      "capital allocation",
    ],
    reason: "It can separate market analysis from approval-gated capital decisions and produce a safer plan.",
  },
];

function scoreFlow(flow: FlowDefinition, message: string): { score: number; reason: string } {
  const haystack = [
    flow.name,
    flow.description,
    flow.purpose,
    flow.userFacingLabel,
    flow.userFacingBlurb,
    flow.category,
    ...flow.triggerConditions,
  ]
    .join(" ")
    .toLowerCase();

  let bestScore = 0;
  let bestReason = "It can accelerate this request with a structured workflow.";

  for (const pattern of INTENT_PATTERNS) {
    const keywordHits = pattern.keywords.filter((keyword) => message.includes(keyword)).length;
    if (keywordHits === 0) continue;

    const categoryMatch = flow.category === pattern.category ? 3 : 0;
    const flowTextHits = pattern.keywords.filter((keyword) => haystack.includes(keyword)).length;
    const score = keywordHits * 2 + categoryMatch + flowTextHits;

    if (score > bestScore) {
      bestScore = score;
      bestReason = pattern.reason;
    }
  }

  return { score: bestScore, reason: bestReason };
}

export async function recommendFlowForMessage(message: string): Promise<FlowRecommendation | null> {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return null;

  const flows = await FlowStore.listPublished();
  if (flows.length === 0) return null;

  const ranked = flows
    .map((flow) => ({ flow, ...scoreFlow(flow, normalized) }))
    .filter((entry) => entry.score >= 4)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best) return null;

  return {
    flowId: best.flow.id,
    slug: best.flow.slug,
    name: best.flow.userFacingLabel || best.flow.name,
    category: best.flow.category,
    reason: best.reason,
    confidence: best.score >= 8 ? "high" : "medium",
    launchEndpoint: `/api/flows/${best.flow.id}/run`,
  };
}
