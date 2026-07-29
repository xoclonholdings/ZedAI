/**
 * Trading Intelligence progression model — ZAR's training pipeline.
 *
 * This is NOT a course the user climbs. It is the path along which
 * ZED becomes a capable trading intelligence. The user's job is to
 * provide ZAR with material and make decisions; ZAR learns, structures,
 * analyzes, and governs. Each stage describes what ZAR can do once
 * trained, and ZAR must PASS a stage assessment before the next
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
  | "external_paper"
  | "evaluation"
  | "qualification"
  | "live";

/**
 * How ZAR is tested before it may advance out of a stage.
 * - knowledge_quiz: ZAR is quizzed on the material it was given, and graded.
 * - data_check: deterministic gate on real artifacts ZAR produced.
 * - locked: the stage's integrations aren't connected yet, so it can't
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
  /** What YOU do — always some flavor of "provide / decide", never "study". */
  yourMove: string;
  /** What ZED does with it. */
  whatZedDoes: string;
  /** Ready-when criteria, framed around ZAR's capability, not your competency. */
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
    purpose: "Train ZAR's foundational market knowledge before it builds strategy.",
    yourMove:
      "Provide ZAR with sources — strategy notes, rulebooks, market education, PDFs, videos, and your own examples. That's your whole job here.",
    whatZedDoes:
      "Reviews each source and organizes it into concepts, rules, examples, common mistakes, and a glossary it reuses in every later stage.",
    readyWhen: [
      "ZAR has structured knowledge across the required areas (market structure, liquidity, risk, and the rest).",
      "ZAR passes the knowledge test on the material you provided.",
    ],
    assessment: {
      kind: "knowledge_quiz",
      passThreshold: 70,
      blurb:
        "ZAR is scored on how much of the required curriculum it has covered, then quizzed on that material. It must score 70+ to move on.",
    },
    nextUnlocks: "strategy",
  },
  {
    id: "strategy",
    order: 2,
    label: "Build the strategy",
    shortLabel: "Strategy",
    purpose: "ZAR turns what it learned into repeatable, versioned trading systems.",
    yourMove:
      "Tell ZAR which systems to build — the markets, entries, exits, sizing, and no-trade rules to encode.",
    whatZedDoes:
      "Stores each strategy as a versioned object with full history you can roll back to, and auto-runs a governance review so you see a verdict on every one.",
    readyWhen: [
      "At least one strategy has entry, exit, risk, and sizing defined.",
      "ZAR's governance review returns Approved or Paper Trade Only on it.",
    ],
    assessment: {
      kind: "data_check",
      passThreshold: 100,
      blurb:
        "ZAR must hold at least one complete strategy that its own governance review cleared (Approved or Paper Trade Only).",
    },
    nextUnlocks: "validation",
  },
  {
    id: "validation",
    order: 3,
    label: "Validate the strategy",
    shortLabel: "Validation",
    purpose: "ZAR objectively decides whether a strategy deserves testing.",
    yourMove: "Point ZAR at a strategy to review.",
    whatZedDoes:
      "Runs market context, binary triggers, statistical edge, risk math, systemic-weakness, optimization, and governance review — returning Approved / Conditionally Approved / Paper Trade Only / Requires Revision / Rejected.",
    readyWhen: [
      "A strategy carries an Approved or Paper Trade Only verdict.",
      "ZAR has recorded the weakness/incident notes for it.",
    ],
    assessment: {
      kind: "data_check",
      passThreshold: 100,
      blurb:
        "ZAR must have produced a governance verdict of Approved or Paper Trade Only on at least one strategy.",
    },
    nextUnlocks: "sandbox",
  },
  {
    id: "sandbox",
    order: 4,
    label: "Internal paper trading",
    shortLabel: "Internal",
    purpose: "ZAR proves the strategy in its own simulator before touching an external platform.",
    yourMove:
      "Hand ZAR setups to paper-trade — each with a thesis it authorizes, simulates, and journals.",
    whatZedDoes:
      "Authorizes each trade through the governance layer, simulates the outcome, compares expected vs actual, flags rule violations, and tracks performance against the exact strategy version used.",
    readyWhen: [
      "Enough closed internal paper trades to be meaningful (20+).",
      "Positive expectancy and no rule violations across the recent sample.",
    ],
    assessment: {
      kind: "data_check",
      passThreshold: 100,
      blurb:
        "ZAR must show 20+ closed internal paper trades with positive expectancy before external paper trading unlocks.",
    },
    nextUnlocks: "external_paper",
  },
  {
    id: "external_paper",
    order: 5,
    label: "External paper trading",
    shortLabel: "External",
    purpose:
      "ZAR proves the same strategy on a real broker's paper/demo account — real platform mechanics and live data, no money — before any funded risk.",
    yourMove:
      "Connect Webull paper trading so ZAR can trade on a real broker platform.",
    whatZedDoes:
      "Runs the approved strategy on the connected paper account against live data, tracks the results, and compares them to the internal test run to confirm the edge holds up outside ZAR's own simulation.",
    readyWhen: [
      "A paper/demo provider is connected.",
      "A solid external paper sample (30+) with positive expectancy and no rule violations.",
    ],
    assessment: {
      kind: "data_check",
      passThreshold: 100,
      blurb:
        "ZAR must have a paper/demo provider connected and show 30+ closed external paper trades with positive expectancy before a funded account unlocks.",
    },
    nextUnlocks: "evaluation",
  },
  {
    id: "evaluation",
    order: 6,
    label: "Funded account",
    shortLabel: "Funded",
    purpose: "ZAR runs a funded-account evaluation — the challenge with real payout stakes.",
    yourMove:
      "Connect a funded-account provider once that integration is available so ZAR can run the challenge under real evaluation rules.",
    whatZedDoes:
      "Tracks the funded objective (profit target, daily-loss and drawdown limits, minimum trading days), imports trades when a provider connection is live or runs on its own system when it isn't, and reports how far you are from passing.",
    readyWhen: [
      "A provider connection is healthy (or manual sync is current).",
      "The funded objective is met without breaking rules.",
    ],
    assessment: {
      kind: "data_check",
      passThreshold: 100,
      blurb:
        "ZAR must meet the funded profit objective across the minimum trading days without breaching the daily-loss or drawdown limits. Runs on ZAR's own system until a provider connection is set up.",
    },
    nextUnlocks: "qualification",
  },
  {
    id: "qualification",
    order: 7,
    label: "Qualification",
    shortLabel: "Qualification",
    purpose: "ZAR confirms it consistently satisfies professional evaluation requirements.",
    yourMove:
      "Let ZAR keep running and read the daily readiness scorecard it produces.",
    whatZedDoes:
      "Reports current strengths, weaknesses, required improvements, and readiness every day.",
    readyWhen: [
      "All discipline scores are at target.",
      "ZAR marks qualification readiness as ready.",
    ],
    assessment: {
      kind: "data_check",
      passThreshold: 70,
      blurb:
        "ZAR must score at target on every discipline in the readiness scorecard — rule compliance, edge, drawdown control, consistency, and a proven sample.",
    },
    nextUnlocks: "live",
  },
  {
    id: "live",
    order: 8,
    label: "Live trading",
    shortLabel: "Live",
    purpose: "ZAR operates a professionally governed live trading environment.",
    yourMove:
      "Authorize ZAR to execute within the risk framework it proved out through the earlier stages.",
    whatZedDoes:
      "Runs broker connectivity, portfolio and execution management, risk monitoring, position/order tracking, trade authorization, analytics, a kill switch, and drawdown controls — all inside the discipline built in the earlier stages.",
    readyWhen: [
      "Continuous readiness reviews keep the system qualified.",
      "Kill switch and drawdown controls stay armed.",
    ],
    assessment: {
      kind: "data_check",
      passThreshold: 100,
      blurb:
        "Unlocks when qualification is passed and a broker is connected. ZAR operates the full risk framework and kill switch; live order routing runs through the broker connection once enabled.",
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
  /** Latest assessment result per stage — the gate that lets ZAR advance. */
  assessments?: Partial<Record<TradingStageId, StageAssessmentRecord>>;
  lastUpdated: string;
}

/**
 * Sandbox (stage 4) is the stage that works today — it maps to the
 * fully-wired paper-trading flow. The three stages before it
 * (Learn / Strategy / Validation) also unlock by default because
 * their supporting services (TradingKnowledgeBase, TradeThesisEngine,
 * TradingGovernanceEngine) are implemented and ZAR can be trained and
 * tested through them. Locking Sandbox behind them would make the one
 * fully functional part of Trading unreachable.
 *
 * The later stages are wired to real engines: External paper trading
 * gates on a paper/demo provider connection, the Funded account runs a
 * funded-account objective on ZAR's own trade engine until a provider
 * bridge exists, Qualification scores a readiness card from that
 * performance, and Live wires the full risk framework + kill switch and
 * unlocks when qualified with a broker connected. Live *order routing*
 * still requires a broker bridge such as Webull — ZAR reports "ready,
 * pending broker" rather than faking execution.
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
