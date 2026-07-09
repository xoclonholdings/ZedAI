/**
 * Trading Intelligence progression model — Zed's training pipeline.
 *
 * This is NOT a course the user climbs. It is the path along which
 * ZED becomes a capable trading intelligence. The user's job is to
 * feed Zed material and make decisions; Zed learns, structures,
 * analyzes, and governs. Each stage describes what Zed can do once
 * trained, and Zed must PASS a stage assessment before the next
 * stage unlocks.
 *
 * All stages exist in the type system from day one. The currently
 * ACTIVE stage determines what the workspace focuses on. Progression
 * advances existing infrastructure rather than requiring
 * re-implementation.
 */

export type TradingStageId =
  | "learn"
  | "strategy"
  | "validation"
  | "sandbox"
  | "evaluation"
  | "qualification"
  | "live";

/**
 * How Zed is tested before it may advance out of a stage.
 * - knowledge_quiz: Zed is quizzed on what it ingested and graded.
 * - data_check: deterministic gate on real artifacts Zed produced.
 * - locked: the stage's integrations aren't wired yet, so it can't
 *   be assessed and stays locked (honest — no fake pass).
 */
export type StageAssessmentKind = "knowledge_quiz" | "data_check" | "locked";

export interface StageAssessment {
  kind: StageAssessmentKind;
  passThreshold: number;
  blurb: string;
}

export interface TradingStageDefinition {
  id: TradingStageId;
  order: number;
  label: string;
  shortLabel: string;
  purpose: string;
  /** What YOU do — always some flavor of "feed / decide", never "study". */
  yourMove: string;
  /** What ZED does with it. */
  whatZedDoes: string;
  /** Ready-when criteria, framed around Zed's capability, not your competency. */
  readyWhen: string[];
  assessment: StageAssessment;
  nextUnlocks?: TradingStageId;
}

export const TRADING_STAGES: TradingStageDefinition[] = [
  {
    id: "learn",
    order: 1,
    label: "Learn the markets",
    shortLabel: "Learn",
    purpose: "Train Zed's foundational market knowledge before it builds strategy.",
    yourMove:
      "Feed Zed sources — TopStep, Trades By Sci, TradingView Education, Investopedia, Babypips, PDFs, videos, your own notes. That's your whole job here.",
    whatZedDoes:
      "Ingests each source and structures it into concepts, rules, examples, mistakes, and a glossary it reuses in every later stage.",
    readyWhen: [
      "Zed has structured knowledge across the required areas (market structure, liquidity, risk, and the rest).",
      "Zed passes the knowledge test on the material you fed it.",
    ],
    assessment: {
      kind: "knowledge_quiz",
      passThreshold: 70,
      blurb:
        "Zed is scored on how much of the required curriculum it has ingested, then quizzed on that material. It must score 70+ to move on.",
    },
    nextUnlocks: "strategy",
  },
  {
    id: "strategy",
    order: 2,
    label: "Build the strategy",
    shortLabel: "Strategy",
    purpose: "Turn what Zed learned into repeatable, versioned trading systems.",
    yourMove:
      "Define the systems you want — entry model, exits, timeframes, markets, sizing, and no-trade rules — and let Zed structure each as a versioned strategy.",
    whatZedDoes:
      "Stores each strategy as a versioned object with full history you can roll back to, and auto-runs a governance review so you see a verdict on every one.",
    readyWhen: [
      "At least one strategy has entry, exit, risk, and sizing defined.",
      "Zed's governance review returns Approved or Paper Trade Only on it.",
    ],
    assessment: {
      kind: "data_check",
      passThreshold: 100,
      blurb:
        "Zed must hold at least one complete strategy that its own governance review cleared (Approved or Paper Trade Only).",
    },
    nextUnlocks: "validation",
  },
  {
    id: "validation",
    order: 3,
    label: "Validate the strategy",
    shortLabel: "Validation",
    purpose: "Have Zed objectively decide whether a strategy deserves testing.",
    yourMove: "Submit a strategy for Zed's Trading Intelligence review.",
    whatZedDoes:
      "Runs market context, binary triggers, statistical edge, risk math, systemic-weakness, optimization, and governance review — returning Approved / Conditionally Approved / Paper Trade Only / Requires Revision / Rejected.",
    readyWhen: [
      "A strategy carries an Approved or Paper Trade Only verdict.",
      "Zed has recorded the weakness/incident notes for it.",
    ],
    assessment: {
      kind: "data_check",
      passThreshold: 100,
      blurb:
        "Zed must have produced a governance verdict of Approved or Paper Trade Only on at least one strategy.",
    },
    nextUnlocks: "sandbox",
  },
  {
    id: "sandbox",
    order: 4,
    label: "Sandbox trading",
    shortLabel: "Sandbox",
    purpose: "Prove the strategy inside Zed's simulator before any external evaluation.",
    yourMove:
      "Log paper trades against the strategy — each with a thesis, entry / stop / target, and a lesson on close.",
    whatZedDoes:
      "Authorizes each trade through the governance layer, simulates the outcome, compares expected vs actual, flags rule violations, and tracks performance against the exact strategy version used.",
    readyWhen: [
      "Enough closed sandbox trades to be meaningful (20+).",
      "Positive expectancy and no rule violations across the recent sample.",
    ],
    assessment: {
      kind: "data_check",
      passThreshold: 100,
      blurb:
        "Zed must show 20+ closed paper trades with positive expectancy before external evaluation unlocks.",
    },
    nextUnlocks: "evaluation",
  },
  {
    id: "evaluation",
    order: 5,
    label: "External evaluation",
    shortLabel: "Evaluation",
    purpose: "Validate the process inside professional evaluation environments.",
    yourMove:
      "Connect Lucid, Tradovate Paper, or TradingView, then trade under evaluation rules (objective, daily loss, drawdown, consistency).",
    whatZedDoes:
      "Tracks evaluation progress, imports trades when a provider bridge is live or preserves a structured manual workflow when it isn't, and reports how far you are from the objective.",
    readyWhen: [
      "A provider connection is healthy (or manual sync is current).",
      "The evaluation objective is met without breaking rules.",
    ],
    assessment: {
      kind: "locked",
      passThreshold: 100,
      blurb:
        "Locked until an evaluation provider (Lucid / Tradovate / TradingView) is connected — Zed won't fake an evaluation result.",
    },
    nextUnlocks: "qualification",
  },
  {
    id: "qualification",
    order: 6,
    label: "Qualification",
    shortLabel: "Qualification",
    purpose: "Confirm the process consistently satisfies professional evaluation requirements.",
    yourMove:
      "Keep executing while Zed watches the readiness scorecard — consistency, drawdown, rule compliance, average R, expectancy, profit factor.",
    whatZedDoes:
      "Reports current strengths, weaknesses, required improvements, and readiness every day.",
    readyWhen: [
      "All discipline scores are at target.",
      "Zed marks qualification readiness as ready.",
    ],
    assessment: {
      kind: "locked",
      passThreshold: 100,
      blurb: "Locked until evaluation data exists to score qualification against.",
    },
    nextUnlocks: "live",
  },
  {
    id: "live",
    order: 7,
    label: "Live trading",
    shortLabel: "Live",
    purpose: "Operate a professionally governed trading environment.",
    yourMove:
      "Authorize real trades within the risk framework Zed proved out through the earlier stages.",
    whatZedDoes:
      "Runs broker connectivity, portfolio and execution engines, the risk engine, position/order monitoring, trade authorization, analytics, a kill switch, and drawdown controls — all inside the discipline built in stages 1–6.",
    readyWhen: [
      "Continuous readiness reviews keep the system qualified.",
      "Kill switch and drawdown controls stay armed.",
    ],
    assessment: {
      kind: "locked",
      passThreshold: 100,
      blurb: "Locked until a broker integration is connected and qualification is passed.",
    },
  },
];

export interface StageAssessmentRecord {
  score: number;
  passed: boolean;
  assessedAt: string;
}

export interface TradingProgression {
  currentStage: TradingStageId;
  unlockedStages: TradingStageId[];
  stageProgress: Partial<Record<TradingStageId, {
    startedAt?: string;
    completedAt?: string;
    completionPercent?: number;
    notes?: string;
  }>>;
  /** Latest assessment result per stage — the gate that lets Zed advance. */
  assessments?: Partial<Record<TradingStageId, StageAssessmentRecord>>;
  lastUpdated: string;
}

/**
 * Sandbox (stage 4) is the stage that works today — it maps to the
 * fully-wired paper-trading flow. The three stages before it
 * (Learn / Strategy / Validation) also unlock by default because
 * their supporting services (TradingKnowledgeBase, TradeThesisEngine,
 * TradingGovernanceEngine) are implemented and Zed can be trained and
 * tested through them. Locking Sandbox behind them would make the one
 * fully functional part of Trading unreachable.
 *
 * The final three stages (Evaluation / Qualification / Live) stay
 * locked because their integrations (Lucid / Tradovate / broker
 * connectivity) genuinely aren't wired yet — and Zed will not fake a
 * pass for a stage it cannot actually assess.
 */
export const DEFAULT_PROGRESSION: TradingProgression = {
  currentStage: "learn",
  unlockedStages: ["learn", "strategy", "validation", "sandbox"],
  stageProgress: {
    learn: { startedAt: undefined, completionPercent: 0 },
  },
  assessments: {},
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

export function nextStageOf(stageId: TradingStageId): TradingStageDefinition | undefined {
  const def = TRADING_STAGES.find((s) => s.id === stageId);
  if (!def?.nextUnlocks) return undefined;
  return TRADING_STAGES.find((s) => s.id === def.nextUnlocks);
}
