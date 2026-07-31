export interface TradingCurriculumArea {
  id: string;
  title: string;
  requiredTopics: string[];
}

export interface TradingBuildStep {
  order: number;
  name: string;
  purpose: string;
}

export const TRADING_SOURCE_LIST = [
  {
    name: "Trades By Sci",
    type: "youtube_channel",
    url: "https://youtube.com/@tradesbysci?si=gx1mXul09rWE7q-4",
    purpose: "Primary trading education source for market structure, liquidity, Bank & Sweep concepts, and setup discipline.",
  },
  {
    name: "Bank & Sweep",
    type: "strategy_concept",
    purpose: "Liquidity behavior, stop hunts, sweep confirmation, and institutional-style setup framing.",
  },
];

export const TRADING_KNOWLEDGE_AREAS: TradingCurriculumArea[] = [
  {
    id: "market_structure",
    title: "Market Structure",
    requiredTopics: ["Trend", "Range", "Break of Structure (BOS)", "Change of Character (CHOCH)"],
  },
  {
    id: "liquidity",
    title: "Liquidity",
    requiredTopics: [
      "Liquidity pools",
      "Stop hunts",
      "Liquidity sweeps",
      "Bank & Sweep concepts",
    ],
  },
  {
    id: "supply_demand",
    title: "Supply & Demand",
    requiredTopics: ["Support", "Resistance", "Supply zones", "Demand zones"],
  },
  {
    id: "multi_timeframe",
    title: "Multi-Timeframe Analysis",
    requiredTopics: ["Monthly", "Weekly", "Daily", "Intraday alignment"],
  },
  {
    id: "entry_models",
    title: "Entry Models",
    requiredTopics: ["Confirmation entries", "Retests", "Breakouts", "Reversals"],
  },
  {
    id: "risk_management",
    title: "Risk Management",
    requiredTopics: [
      "Position sizing",
      "Stop loss placement",
      "Risk/reward ratios",
      "Max drawdown rules",
    ],
  },
  {
    id: "trade_planning",
    title: "Trade Planning",
    requiredTopics: ["Entry", "Stop", "Target", "Invalidation"],
  },
  {
    id: "trade_management",
    title: "Trade Management",
    requiredTopics: ["Partial profits", "Stop adjustments", "Exit conditions"],
  },
  {
    id: "probability_assessment",
    title: "Probability Assessment",
    requiredTopics: ["Confluence scoring", "Setup ranking", "Confidence evaluation"],
  },
  {
    id: "broker_integration",
    title: "Broker Integration",
    requiredTopics: ["Paper account connection", "Position sync", "Order status", "Approval controls"],
  },
  {
    id: "backtesting",
    title: "Backtesting",
    requiredTopics: ["Strategy testing", "Performance metrics", "Win rate", "Expectancy"],
  },
  {
    id: "journaling",
    title: "Journaling",
    requiredTopics: ["Trade logging", "Mistake tracking", "Pattern identification"],
  },
  {
    id: "market_catalysts",
    title: "Market Catalysts",
    requiredTopics: ["Economic calendar", "Earnings", "CPI", "FOMC", "Major news events"],
  },
  {
    id: "asset_classes",
    title: "Asset Classes",
    requiredTopics: ["Stocks", "ETFs", "Options", "Futures", "Crypto", "Forex"],
  },
  {
    id: "automation_workflow",
    title: "Automation Workflow",
    requiredTopics: [
      "Scan",
      "Detect",
      "Analyze",
      "Plan",
      "Alert",
      "Approve",
      "Execute",
      "Review",
      "Learn",
    ],
  },
];

export const TRADING_BUILD_SEQUENCE: TradingBuildStep[] = [
  {
    order: 1,
    name: "Broker Integration",
    purpose: "Make paper account status, positions, orders, and approval controls available to ZAR.",
  },
  {
    order: 2,
    name: "Trades By Sci Knowledge Base",
    purpose: "Convert trusted educational material into structured concepts, setup rules, mistakes, and examples.",
  },
  {
    order: 3,
    name: "Scanner",
    purpose: "Detect market structure, liquidity, continuation, reversal, breakout, and no-trade conditions.",
  },
  {
    order: 4,
    name: "Signal Engine",
    purpose: "Convert scanner observations into ranked setup signals with strict invalidation logic.",
  },
  {
    order: 5,
    name: "Journal",
    purpose: "Track trades, decisions, mistakes, screenshots, and lessons learned.",
  },
  {
    order: 6,
    name: "Backtesting",
    purpose: "Validate strategies against historical outcomes before live consideration.",
  },
  {
    order: 7,
    name: "Risk Engine",
    purpose: "Enforce position sizing, drawdown limits, daily loss limits, correlation exposure, and capital preservation rules.",
  },
  {
    order: 8,
    name: "Approval Mode",
    purpose: "Require user approval before any future external or capital-impacting action.",
  },
  {
    order: 9,
    name: "Guarded Autonomy",
    purpose: "Allow low-risk automation only after validation, risk controls, and approval gates are proven.",
  },
  {
    order: 10,
    name: "Full Autonomy",
    purpose: "Future-only target after proven performance, broker integrations, audit trails, hard stops, and user-defined risk limits.",
  },
];

export function buildTradingCurriculumContext(): string {
  const sources = TRADING_SOURCE_LIST.map((source) => `- ${source.name}: ${source.purpose}`).join("\n");
  const areas = TRADING_KNOWLEDGE_AREAS.map(
    (area) => `- ${area.title}: ${area.requiredTopics.join(", ")}`,
  ).join("\n");
  const sequence = TRADING_BUILD_SEQUENCE.map(
    (step) => `${step.order}. ${step.name}: ${step.purpose}`,
  ).join("\n");

  return [
    "Minimum Trading Curriculum Sources:",
    sources,
    "",
    "Required Knowledge Areas:",
    areas,
    "",
    "Build Order:",
    sequence,
  ].join("\n");
}
