import { generateChatFromOllama } from "../../services/Ollama/OllamaService";
import { logRuntimeEvent } from "../../services/RuntimeLogger";

import type { AgentName, HubConfig, OrchestratorRequest } from "./types";

/**
 * URL / web-research intent detection. Capability-level, not lane-
 * level — even if the user has another agent selected, a message
 * with a URL or "look this up" intent gets force-routed to research.
 */
export function isWebLookupIntent(message: string): boolean {
  const lower = message.toLowerCase();

  const hasUrl =
    /\bhttps?:\/\/[^\s)]+/i.test(message) ||
    /\bwww\.[^\s)]+/i.test(message) ||
    /\b[a-z0-9-]+(\.[a-z0-9-]+)+\/?[^\s)]*/i.test(message);

  const webIntentPhrases = [
    "visit",
    "open this site",
    "open the site",
    "go to",
    "browse",
    "inspect",
    "check this site",
    "check the site",
    "look at this site",
    "look up",
    "search web",
    "search the web",
    "google",
    "latest",
    "current",
    "news",
    "what does this website",
    "analyze this website",
    "audit this website",
    "review this website",
    "summarize this page",
    "summarize this website",
  ];

  return hasUrl || webIntentPhrases.some((phrase) => lower.includes(phrase));
}

/**
 * Ask the local model to classify the message into one of four
 * lanes. Returns null if the model is unreachable or replies with
 * something we don't recognize — caller falls back to keywords.
 */
export async function classifyWithLlm(message: string): Promise<AgentName | null> {
  const trimmed = message.trim();
  if (!trimmed) return null;

  const systemPrompt = [
    "You are a routing classifier for the ZED multi-agent system.",
    "Choose exactly one agent for the user's message based on the descriptions below.",
    "",
    "operations  — calendar, email drafting, scheduling, voicemail, posts, invoices, cancellations, bookings, generic personal assistant work.",
    "research    — external websites, URLs, browsing requests, latest/current information, explanations, market scans, trend summaries, comparisons, deep research, 'what is / how does / latest news' questions.",
    "business    — payroll, contractors, ecommerce/dropshipping, real estate, business credit, acquisitions, business operations.",
    "finance     — crypto, forex, trading setups, position management, wealth planning, yield, portfolio strategy.",
    "",
    "Important: Any request containing a URL, website, browse, visit, inspect, current, latest, or news intent must route to research.",
    "",
    "Reply with EXACTLY one lowercase label: operations | research | business | finance.",
    "Do not include punctuation, quotes, or explanations.",
  ].join("\n");

  try {
    const reply = await generateChatFromOllama(
      [{ role: "user", content: trimmed.slice(0, 1200) }],
      systemPrompt,
      { lane: "manager" },
    );
    const label = (reply || "").trim().toLowerCase().replace(/[^a-z]/g, "");
    const map: Record<string, AgentName> = {
      operations: "OperationsAgent",
      research: "IntelligenceAgent",
      business: "BusinessManagerAgent",
      finance: "FinanceAgent",
    };
    const picked = map[label];
    if (!picked) {
      await logRuntimeEvent({
        level: "warn",
        source: "server",
        event: "manager.classify.unmapped",
        detail: `Classifier returned unmapped label: ${(reply || "").slice(0, 60)}`,
      });
      return null;
    }
    await logRuntimeEvent({
      level: "info",
      source: "server",
      event: "manager.classify.ok",
      detail: `Classifier picked ${picked}`,
    });
    return picked;
  } catch (err: any) {
    await logRuntimeEvent({
      level: "warn",
      source: "server",
      event: "manager.classify.failed",
      detail: err?.message || String(err),
    });
    return null;
  }
}

const FINANCE_KEYWORDS = [
  "crypto",
  "bitcoin",
  "btc",
  "ethereum",
  "eth",
  "solana",
  "sol",
  "token",
  "altcoin",
  "defi",
  "web3",
  "nft",
  "on-chain",
  "wallet",
  "forex",
  "fx",
  "eurusd",
  "gbpusd",
  "usdjpy",
  "currency pair",
  "trade",
  "trading",
  "long position",
  "short position",
  "stop loss",
  "take profit",
  "portfolio",
  "rebalance",
  "wealth",
  "compound",
  "allocation",
  "yield",
  "stablecoin",
];

const BUSINESS_KEYWORDS = [
  "payroll",
  "gusto",
  "contractor",
  "employee",
  "onboarding",
  "benefits",
  "reimbursement",
  "w-2",
  "1099",
  "business manager",
  "dropshipping",
  "ecommerce",
  "business credit",
  "property",
  "real estate",
  "acquisition",
  "deal flow",
  "underwriting",
];

const OPERATIONS_KEYWORDS = [
  "calendar",
  "schedule",
  "reschedule",
  "meeting",
  "appointment",
  "email",
  "send email",
  "draft email",
  "reply to",
  "task",
  "todo",
  "to-do",
  "to do",
  "remind me",
  "post to",
  "post on",
  "publish",
  "tweet",
  "draft post",
  "send invoice",
  "invoice",
  "cancel",
  "book ",
  "call",
  "voicemail",
  "phone",
];

const DEFAULT_RESEARCH_KEYWORDS = [
  "research",
  "find information",
  "analyze",
  "trend",
  "market",
  "github",
  "news",
  "what is",
  "how does",
  "who is",
  "explain",
  "summarize",
  "what are",
  "latest",
  "current",
  "current events",
  "happening in",
  "tell me about",
  "website",
  "url",
  "browse",
  "visit",
  "inspect",
];

/**
 * Pure keyword-based fallback for when the LLM classifier didn't
 * return a usable answer. Order matters: web-intent → finance →
 * business → operations → research, with operations as the catch-all.
 *
 * Research keywords can be overridden via parameters.yaml's
 * `agent_routing.research_keywords` so the admin can tune routing
 * without a code change.
 */
export function classifyWithKeywords(message: string, config: HubConfig): AgentName {
  const lower = message.toLowerCase();
  const params = config.parameters || {};

  if (isWebLookupIntent(message)) return "IntelligenceAgent";

  if (FINANCE_KEYWORDS.some((keyword) => lower.includes(keyword))) return "FinanceAgent";
  if (BUSINESS_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return "BusinessManagerAgent";
  }
  if (OPERATIONS_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return "OperationsAgent";
  }

  const researchKeywords: string[] =
    params.agent_routing?.research_keywords || DEFAULT_RESEARCH_KEYWORDS;
  if (researchKeywords.some((keyword) => lower.includes(keyword))) {
    return "IntelligenceAgent";
  }

  return "OperationsAgent";
}

/**
 * Top-level lane picker. Order:
 *   1. Web-lookup intent overrides everything (capability routing)
 *   2. Explicit UI selection (chip in the composer)
 *   3. LLM classifier
 *   4. Keyword fallback
 */
export async function selectAgent(
  message: string,
  config: HubConfig,
  targetAgent?: OrchestratorRequest["targetAgent"],
): Promise<AgentName> {
  if (isWebLookupIntent(message)) {
    await logRuntimeEvent({
      level: "info",
      source: "server",
      event: "manager.route.web_intent",
      detail: "Web / URL lookup intent routed to IntelligenceAgent",
    });
    return "IntelligenceAgent";
  }

  if (targetAgent === "operations") return "OperationsAgent";
  if (targetAgent === "research") return "IntelligenceAgent";
  if (targetAgent === "business") return "BusinessManagerAgent";
  if (targetAgent === "finance") return "FinanceAgent";

  const classified = await classifyWithLlm(message);
  if (classified) return classified;

  return classifyWithKeywords(message, config);
}
