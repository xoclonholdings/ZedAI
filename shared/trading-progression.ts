/**
 * Trading Intelligence progression model.
 *
 * A trader's journey is architected as seven stages. All stages
 * exist in the type system from day one — the user's currently
 * ACTIVE stage determines which capabilities the UI unlocks.
 * Progression advances existing infrastructure rather than
 * requiring re-implementation.
 */

export type TradingStageId =
  | "learn"
  | "strategy"
  | "validation"
  | "sandbox"
  | "evaluation"
  | "qualification"
  | "live";

export interface TradingStageDefinition {
  id: TradingStageId;
  order: number;
  label: string;
  shortLabel: string;
  purpose: string;
  whatYouDo: string;
  whatZedDoes: string;
  completionCriteria: string[];
  nextUnlocks?: TradingStageId;
}

export const TRADING_STAGES: TradingStageDefinition[] = [
  {
    id: "learn",
    order: 1,
    label: "Learn the markets",
    shortLabel: "Learn",
    purpose: "Build foundational trading knowledge before developing a strategy.",
    whatYouDo:
      "Read, watch, and take notes on market structure, risk management, psychology, and the routines professional traders use.",
    whatZedDoes:
      "Ingests every source you bring in (TopStep, Trades By Sci, TradingView Education, Investopedia, Babypips, PDFs, videos) and structures it into concepts, rules, examples, mistakes, and a glossary Zed can reference in every later stage.",
    completionCriteria: [
      "You've covered the required knowledge areas.",
      "Zed's stored the concepts, rules, and examples from your sources.",
      "You can explain your risk framework in plain English.",
    ],
    nextUnlocks: "strategy",
  },
  {
    id: "strategy",
    order: 2,
    label: "Build your strategy",
    shortLabel: "Strategy",
    purpose: "Turn what you learned into a repeatable, versioned trading system.",
    whatYouDo:
      "Define entry model, exit model, timeframes, markets, session, position sizing, risk rules, no-trade rules, and trade thesis templates.",
    whatZedDoes:
      "Stores each strategy as a versioned object. Every change is history you can roll back to. Ready to feed into validation.",
    completionCriteria: [
      "At least one strategy has entry, exit, risk, and sizing rules defined.",
      "The strategy has a trade thesis template.",
      "You can reproduce the same setup twice from your own rules.",
    ],
    nextUnlocks: "validation",
  },
  {
    id: "validation",
    order: 3,
    label: "Validate the strategy",
    shortLabel: "Validation",
    purpose: "Objectively decide whether the strategy deserves testing.",
    whatYouDo: "Submit your strategy for Trading Intelligence review.",
    whatZedDoes:
      "Runs market context, binary logical triggers, statistical edge, risk math, systemic weakness review, optimization review, and governance review. Returns one of five verdicts: Approved / Conditionally Approved / Paper Trade Only / Requires Revision / Rejected.",
    completionCriteria: [
      "Strategy carries an Approved or Paper Trade Only verdict.",
      "All incident/weakness reports are read.",
      "Revision cycles are recorded in version history.",
    ],
    nextUnlocks: "sandbox",
  },
  {
    id: "sandbox",
    order: 4,
    label: "Sandbox trading",
    shortLabel: "Sandbox",
    purpose: "Prove the strategy inside Zed's simulator before you touch external evaluation.",
    whatYouDo:
      "Log paper trades against the strategy. Every trade requires a thesis, authorization, entry / exit / stop / target, and journal.",
    whatZedDoes:
      "Simulates realistic behavior. Compares expected vs actual outcomes continuously. Flags rule violations. Tracks performance versioned against the specific strategy version used.",
    completionCriteria: [
      "Statistically significant sample size of sandbox trades.",
      "Expectancy ≥ your qualification target.",
      "No rule violations across the last 20 trades.",
    ],
    nextUnlocks: "evaluation",
  },
  {
    id: "evaluation",
    order: 5,
    label: "External evaluation",
    shortLabel: "Evaluation",
    purpose: "Validate the process inside professional evaluation environments.",
    whatYouDo:
      "Connect Lucid, Tradovate Paper, or TradingView. Trade under evaluation rules (account objective, daily loss limit, drawdown, consistency).",
    whatZedDoes:
      "Tracks evaluation progress, imports trades when an API is available, or gives you a structured manual workflow that preserves the same experience when it's not. Continuously reports how far you are from the objective.",
    completionCriteria: [
      "Provider connections are healthy or manual sync is up to date.",
      "You've hit the evaluation objective without breaking rules.",
      "Consistency and drawdown pass thresholds.",
    ],
    nextUnlocks: "qualification",
  },
  {
    id: "qualification",
    order: 6,
    label: "Qualification",
    shortLabel: "Qualification",
    purpose: "Confirm you can consistently satisfy professional evaluation requirements.",
    whatYouDo:
      "Keep executing. Watch the readiness scorecard for consistency, drawdown, rule compliance, average R, expectancy, profit factor, and execution/emotional/risk discipline.",
    whatZedDoes:
      "Explains current strengths, current weaknesses, required improvements, and readiness — every day.",
    completionCriteria: [
      "All discipline scores at target.",
      "Qualification readiness = ready.",
    ],
    nextUnlocks: "live",
  },
  {
    id: "live",
    order: 7,
    label: "Live trading",
    shortLabel: "Live",
    purpose: "Operate a professionally governed trading environment.",
    whatYouDo:
      "Execute real trades within the risk framework you've proven works.",
    whatZedDoes:
      "Runs broker connectivity, portfolio management, execution engine, risk engine, position monitoring, order monitoring, trade authorization, performance and portfolio analytics, kill switch, and drawdown controls. Every action stays inside the discipline you built through stages 1-6.",
    completionCriteria: [
      "Continuous readiness reviews keep you here.",
      "Kill switch and drawdown controls stay armed.",
    ],
  },
];

export interface TradingProgression {
  currentStage: TradingStageId;
  unlockedStages: TradingStageId[];
  stageProgress: Partial<Record<TradingStageId, {
    startedAt?: string;
    completedAt?: string;
    completionPercent?: number;
    notes?: string;
  }>>;
  lastUpdated: string;
}

export const DEFAULT_PROGRESSION: TradingProgression = {
  currentStage: "learn",
  unlockedStages: ["learn"],
  stageProgress: {
    learn: { startedAt: undefined, completionPercent: 0 },
  },
  lastUpdated: new Date(0).toISOString(),
};

export function isStageUnlocked(
  progression: TradingProgression,
  stageId: TradingStageId,
): boolean {
  return progression.unlockedStages.includes(stageId);
}

export function stageDefinition(stageId: TradingStageId): TradingStageDefinition {
  const def = TRADING_STAGES.find((s) => s.id === stageId);
  if (!def) throw new Error(`Unknown trading stage: ${stageId}`);
  return def;
}
