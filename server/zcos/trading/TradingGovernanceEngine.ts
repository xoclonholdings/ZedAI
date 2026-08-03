import type {
  AuthorizationDecision,
  ChecklistResult,
  GovernanceDecisionOutcome,
  LiveTradingEligibility,
  PaperTrade,
  PaperTradingGovernanceSettings,
  TradeThesis,
  TradingAssetClass,
  TradingGovernanceChecklistItem,
  TradingGovernanceDecision,
  TradingPerformanceReport,
} from "../../../shared/trading-types";

import { TradingStore } from "./TradingStore";

const REQUIRED_SAMPLE_SIZE = 100;
const MINIMUM_RISK_REWARD = 2;
const MAX_RISK_PER_PAPER_TRADE = 100;
const MAX_NEGATIVE_DRAWDOWN = -500;

interface PaperTradeAuthorizationInput {
  userId: string;
  thesis?: TradeThesis;
  market: string;
  assetClass: TradingAssetClass;
  symbol: string;
  direction: "long" | "short";
  timeframe?: string;
  setupName?: string;
  entry: number;
  stop: number;
  target: number;
  size: number;
  riskAmount: number;
  entryReason: string;
  /** Optional context ZAR supplies so these checks resolve instead of UNKNOWN. */
  session?: string;
  newsContext?: string;
  correlationNotes?: string;
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasPositiveNumber(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function riskRewardFrom(input: { direction: "long" | "short"; entry: number; stop: number; target: number }): number | null {
  if (!hasPositiveNumber(input.entry) || !hasPositiveNumber(input.stop) || !hasPositiveNumber(input.target)) return null;
  const risk = input.direction === "long" ? input.entry - input.stop : input.stop - input.entry;
  const reward = input.direction === "long" ? input.target - input.entry : input.entry - input.target;
  if (risk <= 0 || reward <= 0) return null;
  return Number((reward / risk).toFixed(4));
}

function checklistItem(
  key: string,
  label: string,
  result: ChecklistResult,
  evidence: string,
  opts?: { missingInformation?: string[]; critical?: boolean },
): TradingGovernanceChecklistItem {
  return { key, label, result, evidence, ...opts };
}

function applyPaperGovernanceSetting(
  item: TradingGovernanceChecklistItem,
  settings: PaperTradingGovernanceSettings,
): TradingGovernanceChecklistItem {
  const check = settings.checks[item.key];
  if (settings.mode === "off") {
    return {
      ...item,
      result: "NOT_APPLICABLE",
      evidence: `${item.evidence} Paper governance is turned off by user setting.`,
      critical: false,
    };
  }
  if (check && !check.enabled) {
    return {
      ...item,
      result: "NOT_APPLICABLE",
      evidence: `${item.label} is disabled in paper governance settings. ${item.evidence}`,
      critical: false,
    };
  }
  if (settings.mode === "warn") {
    return { ...item, critical: false };
  }
  if (check) return { ...item, critical: check.blocking };
  return item;
}

function liveEligibility(performance: TradingPerformanceReport): LiveTradingEligibility {
  if (
    performance.closedTrades >= REQUIRED_SAMPLE_SIZE &&
    performance.expectancy > 0 &&
    performance.maximumDrawdown > MAX_NEGATIVE_DRAWDOWN &&
    performance.patternAnalytics.mostCommonRuleViolations.length === 0
  ) {
    return "Eligible";
  }
  if (performance.closedTrades >= 50 && performance.expectancy > 0) return "Nearly Eligible";
  return "Not Eligible";
}

function validationProgress(performance: TradingPerformanceReport) {
  return {
    currentSampleSize: performance.closedTrades,
    requiredSampleSize: REQUIRED_SAMPLE_SIZE,
    currentExpectancy: performance.expectancy,
    currentDrawdown: performance.maximumDrawdown,
    ruleCompliance: performance.patternAnalytics.mostCommonRuleViolations.length ? "violations_detected" : "clean_or_unproven",
    executionConsistency: performance.consecutiveLosses >= 4 ? "unstable" : "monitoring",
    status: performance.closedTrades >= REQUIRED_SAMPLE_SIZE && performance.expectancy > 0
      ? "Strategy validation sample complete. Continue paper trading until manually reviewed."
      : "Continue Paper Trading",
  };
}

function hardRiskFailures(checklist: TradingGovernanceChecklistItem[]): TradingGovernanceChecklistItem[] {
  return checklist.filter((item) => item.critical && (item.result === "FAIL" || item.result === "UNKNOWN"));
}

function nonCriticalFailures(checklist: TradingGovernanceChecklistItem[]): TradingGovernanceChecklistItem[] {
  return checklist.filter((item) => !item.critical && (item.result === "FAIL" || item.result === "UNKNOWN"));
}

async function createIncidentForDeniedAuthorization(opts: {
  userId: string;
  thesis?: TradeThesis;
  symbol: string;
  decision: TradingGovernanceDecision;
  failures: TradingGovernanceChecklistItem[];
}) {
  await TradingStore.addIncidentReport({
    userId: opts.userId,
    thesisId: opts.thesis?.id,
    symbol: opts.symbol.toUpperCase(),
    linkedDecisionId: opts.decision.id,
    incident: "Paper trade authorization denied by governance layer.",
    cause: opts.failures.map((failure) => `${failure.label}: ${failure.result}`).join(" | "),
    evidence: opts.failures.map((failure) => failure.evidence),
    rulesViolated: opts.failures.map((failure) => failure.label),
    potentialConsequences: [
      "Invalid paper-trade data would weaken strategy validation.",
      "Risk discipline metrics would become unreliable.",
      "Future autonomous execution gates could learn from flawed examples.",
    ],
    requiredCorrections: opts.failures.flatMap((failure) => failure.missingInformation?.length ? failure.missingInformation : [failure.evidence]),
    futurePrevention: [
      "Require complete entry, stop, target, invalidation, and risk fields before paper trade creation.",
      "Block all trades with undefined stop or invalid risk/reward math.",
      "Keep live trading disabled until governance performance is reviewed manually.",
    ],
  });
}

export async function evaluateTradeThesisGovernance(thesis: TradeThesis): Promise<TradingGovernanceDecision> {
  const performance = await TradingStore.getPerformance(thesis.userId);
  const evidence: string[] = [];
  const actions: string[] = [];
  const nextReview: string[] = [];
  const missing: string[] = [];

  if (!hasText(thesis.marketStructure)) missing.push("Market structure");
  if (!hasText(thesis.liquidityAnalysis)) missing.push("Liquidity analysis");
  if (!hasText(thesis.entryPlan)) missing.push("Entry plan");
  if (!hasText(thesis.stopPlan)) missing.push("Stop plan");
  if (!hasText(thesis.targetPlan)) missing.push("Target plan");
  if (!thesis.invalidationConditions.length) missing.push("Invalidation conditions");
  if (thesis.riskReward == null) missing.push("Risk/reward");

  evidence.push(`Setup status: ${thesis.status}.`);
  evidence.push(`Confidence score: ${thesis.confidenceScore}.`);
  evidence.push(`Risk/reward: ${thesis.riskReward ?? "UNKNOWN"}.`);
  evidence.push(`Closed paper-trade sample size: ${performance.closedTrades}/${REQUIRED_SAMPLE_SIZE}.`);

  let decision: GovernanceDecisionOutcome;
  let reason: string;

  if (missing.includes("Stop plan") || missing.includes("Invalidation conditions")) {
    decision = "REJECTED";
    reason = "Critical risk controls are missing.";
    actions.push(...missing.map((item) => `Define ${item}.`));
  } else if (missing.length > 0) {
    decision = "REQUIRES_REVISION";
    reason = "The thesis contains usable ideas but required planning data is incomplete.";
    actions.push(...missing.map((item) => `Complete ${item}.`));
  } else if ((thesis.riskReward || 0) < MINIMUM_RISK_REWARD) {
    decision = "REQUIRES_REVISION";
    reason = `Risk/reward is below the minimum ${MINIMUM_RISK_REWARD}:1 threshold.`;
    actions.push("Revise entry, stop, or target so the setup reaches minimum reward/risk.");
  } else if (performance.closedTrades < REQUIRED_SAMPLE_SIZE) {
    decision = "PAPER_TRADE_ONLY";
    reason = "The setup can be studied, but the strategy has not reached the required validation sample size.";
    actions.push(`Continue paper trading until at least ${REQUIRED_SAMPLE_SIZE} completed trades are logged.`);
  } else if (thesis.confidenceScore >= 70 && thesis.status === "valid_setup") {
    decision = "APPROVED";
    reason = "The thesis satisfies the required structure, risk, and validation checks for paper trading.";
    actions.push("Proceed to paper-trade authorization before opening the trade.");
  } else {
    decision = "CONDITIONALLY_APPROVED";
    reason = "The thesis is structurally acceptable but still needs confirmation before paper execution.";
    actions.push("Wait for the stated confirmation condition before paper-trade authorization.");
  }

  nextReview.push("Run pre-trade authorization before creating any paper trade.");
  nextReview.push("Review after the next closed paper trade updates expectancy and rule compliance.");

  const governanceDecision = await TradingStore.addGovernanceDecision({
    userId: thesis.userId,
    thesisId: thesis.id,
    symbol: thesis.symbol,
    decision,
    reason,
    supportingEvidence: evidence,
    requiredActions: actions.length ? actions : ["No immediate revision required before paper-trade authorization."],
    nextReviewConditions: nextReview,
    riskMetrics: {
      confidenceScore: thesis.confidenceScore,
      riskReward: thesis.riskReward,
      closedTrades: performance.closedTrades,
      expectancy: performance.expectancy,
      maximumDrawdown: performance.maximumDrawdown,
    },
    liveTradingEligibility: liveEligibility(performance),
    paperTradingProgress: validationProgress(performance),
    outcome: "pending",
  });

  await TradingStore.updateThesis({
    id: thesis.id,
    userId: thesis.userId,
    patch: {
      governanceDecisionId: governanceDecision.id,
      governanceDecision: decision,
    },
  });

  return governanceDecision;
}

export async function authorizePaperTrade(input: PaperTradeAuthorizationInput): Promise<{
  decision: TradingGovernanceDecision;
  authorized: boolean;
}> {
  const performance = await TradingStore.getPerformance(input.userId);
  const settings = await TradingStore.getPaperGovernanceSettings(input.userId);
  const thresholds = settings.thresholds;
  const openTrades = await TradingStore.listPaperTrades(input.userId, "open");
  const rr = riskRewardFrom(input);
  const checklist: TradingGovernanceChecklistItem[] = [
    checklistItem(
      "market_context",
      "Market Context",
      hasText(input.market) ? "PASS" : "UNKNOWN",
      hasText(input.market) ? `Market provided: ${input.market}.` : "Market context is unavailable.",
      { missingInformation: hasText(input.market) ? undefined : ["Market context"], critical: true },
    ),
    checklistItem(
      "trend_alignment",
      "Trend Alignment",
      input.thesis?.timeframeAlignment && Object.keys(input.thesis.timeframeAlignment).length ? "PASS" : "UNKNOWN",
      input.thesis?.timeframeAlignment && Object.keys(input.thesis.timeframeAlignment).length
        ? `Timeframe alignment: ${JSON.stringify(input.thesis.timeframeAlignment)}.`
        : "Timeframe alignment is unavailable.",
      { missingInformation: input.thesis?.timeframeAlignment && Object.keys(input.thesis.timeframeAlignment).length ? undefined : ["Multi-timeframe alignment"], critical: false },
    ),
    checklistItem(
      "market_structure",
      "Market Structure",
      hasText(input.thesis?.marketStructure) ? "PASS" : "UNKNOWN",
      hasText(input.thesis?.marketStructure)
        ? `${input.thesis?.setupType ? "Engine-computed: " : "Free text (not engine-verified): "}${input.thesis?.marketStructure}`
        : "Market structure is unavailable.",
      { missingInformation: hasText(input.thesis?.marketStructure) ? undefined : ["Market structure"], critical: true },
    ),
    checklistItem(
      "liquidity_conditions",
      "Liquidity Conditions",
      hasText(input.thesis?.liquidityAnalysis) ? "PASS" : "UNKNOWN",
      hasText(input.thesis?.liquidityAnalysis)
        ? `${input.thesis?.setupType ? "Engine-computed: " : "Free text (not engine-verified): "}${input.thesis?.liquidityAnalysis}`
        : "Liquidity analysis is unavailable.",
      { missingInformation: hasText(input.thesis?.liquidityAnalysis) ? undefined : ["Liquidity analysis"], critical: true },
    ),
    checklistItem(
      "session",
      "Session",
      hasText(input.session) ? "PASS" : "UNKNOWN",
      hasText(input.session) ? `Session: ${input.session}.` : "Market session was not supplied.",
      { missingInformation: hasText(input.session) ? undefined : ["Market session"], critical: false },
    ),
    checklistItem(
      "news_filter",
      "News Filter",
      hasText(input.newsContext) ? "PASS" : "UNKNOWN",
      hasText(input.newsContext) ? String(input.newsContext) : "Economic/news calendar state was not supplied.",
      { missingInformation: hasText(input.newsContext) ? undefined : ["Economic calendar/news filter"], critical: false },
    ),
    checklistItem(
      "trade_thesis",
      "Trade Thesis",
      input.thesis ? "PASS" : "UNKNOWN",
      input.thesis ? `Linked thesis ${input.thesis.id}.` : "No thesis is linked to this paper trade.",
      { missingInformation: input.thesis ? undefined : ["Linked trade thesis"], critical: false },
    ),
    checklistItem(
      "entry_rules",
      "Entry Rules",
      hasText(input.entryReason) && hasPositiveNumber(input.entry) ? "PASS" : "FAIL",
      hasText(input.entryReason) && hasPositiveNumber(input.entry) ? `Entry ${input.entry}: ${input.entryReason}` : "Entry price or entry reason is missing/invalid.",
      { missingInformation: ["Entry price", "Entry reason"], critical: true },
    ),
    checklistItem(
      "exit_rules",
      "Exit Rules",
      hasPositiveNumber(input.stop) && hasPositiveNumber(input.target) ? "PASS" : "FAIL",
      hasPositiveNumber(input.stop) && hasPositiveNumber(input.target) ? `Stop ${input.stop}, target ${input.target}.` : "Stop or target is missing/invalid.",
      { missingInformation: ["Stop loss", "Target"], critical: true },
    ),
    checklistItem(
      "risk_limits",
      "Risk Limits",
      hasPositiveNumber(input.riskAmount) && input.riskAmount <= thresholds.maxRiskPerPaperTrade ? "PASS" : "FAIL",
      hasPositiveNumber(input.riskAmount)
        ? `Risk amount ${input.riskAmount}; limit ${thresholds.maxRiskPerPaperTrade}.`
        : "Risk amount is missing/invalid.",
      { missingInformation: ["Risk amount"], critical: true },
    ),
    checklistItem(
      "position_size",
      "Position Size",
      hasPositiveNumber(input.size) ? "PASS" : "FAIL",
      hasPositiveNumber(input.size) ? `Position size ${input.size}.` : "Position size is missing/invalid.",
      { missingInformation: ["Position size"], critical: true },
    ),
    checklistItem(
      "correlation",
      "Correlation",
      hasText(input.correlationNotes) ? "PASS" : "UNKNOWN",
      hasText(input.correlationNotes) ? String(input.correlationNotes) : "Correlation data was not supplied.",
      { missingInformation: hasText(input.correlationNotes) ? undefined : ["Correlation exposure"], critical: false },
    ),
    checklistItem(
      "drawdown_limits",
      "Drawdown Limits",
      performance.maximumDrawdown > thresholds.maxNegativeDrawdown ? "PASS" : "FAIL",
      `Current max drawdown ${performance.maximumDrawdown}; floor ${thresholds.maxNegativeDrawdown}.`,
      { critical: true },
    ),
    checklistItem(
      "system_health",
      "System Health",
      performance.closedTrades >= thresholds.requiredSampleSize && performance.expectancy > 0 ? "PASS" : "UNKNOWN",
      `Validation sample ${performance.closedTrades}/${thresholds.requiredSampleSize}; expectancy ${performance.expectancy}.`,
      { missingInformation: performance.closedTrades >= thresholds.requiredSampleSize ? undefined : ["Validated sample size"], critical: false },
    ),
    checklistItem(
      "risk_reward",
      "Risk/Reward Math",
      rr !== null && rr >= thresholds.minimumRiskReward ? "PASS" : "FAIL",
      rr === null ? "Risk/reward cannot be calculated from entry, stop, and target." : `Calculated risk/reward ${rr}; minimum ${thresholds.minimumRiskReward}.`,
      { missingInformation: rr === null ? ["Valid entry", "Valid stop", "Valid target"] : undefined, critical: true },
    ),
  ].map((item) => applyPaperGovernanceSetting(item, settings));

  const hardFailures = hardRiskFailures(checklist);
  const softFailures = nonCriticalFailures(checklist);

  let authorization: AuthorizationDecision;
  let reason: string;
  if (settings.mode === "off") {
    authorization = "AUTHORIZED";
    reason = "Paper-trade governance is turned off by user setting. Checklist recorded for visibility only.";
  } else if (hardFailures.length > 0) {
    authorization = "DENIED";
    reason = "One or more critical governance checks failed or returned unknown.";
  } else if (softFailures.length > 0 || performance.closedTrades < thresholds.requiredSampleSize) {
    authorization = "AUTHORIZED_WITH_CONDITIONS";
    reason = settings.mode === "warn"
      ? "Paper-trade governance is warning-only. Checklist failures were recorded but did not block the trade."
      : "Critical risk checks passed, but validation or context remains incomplete. Paper trading may continue for validation only.";
  } else {
    authorization = "AUTHORIZED";
    reason = "All critical and validation checks passed for paper trading.";
  }

  const decision = await TradingStore.addGovernanceDecision({
    userId: input.userId,
    thesisId: input.thesis?.id,
    symbol: input.symbol.toUpperCase(),
    decision: authorization,
    reason,
    supportingEvidence: checklist.map((item) => `${item.label}: ${item.result} - ${item.evidence}`),
    requiredActions: authorization === "AUTHORIZED"
      ? ["Proceed to paper trade only. Live trading remains disabled."]
      : [...hardFailures, ...softFailures].map((item) => item.missingInformation?.length ? `Provide ${item.missingInformation.join(", ")}.` : item.evidence),
    nextReviewConditions: [
      "Review after trade closure and journal update.",
      "Recalculate expectancy, drawdown, and rule compliance after outcome is known.",
    ],
    checklist,
    riskMetrics: {
      entry: input.entry,
      stop: input.stop,
      target: input.target,
      size: input.size,
      riskAmount: input.riskAmount,
      calculatedRiskReward: rr,
      openPaperTrades: openTrades.length,
      maximumDrawdown: performance.maximumDrawdown,
      expectancy: performance.expectancy,
    },
    liveTradingEligibility: liveEligibility(performance),
    paperTradingProgress: validationProgress(performance),
    outcome: "pending",
  });

  if (authorization === "DENIED") {
    await createIncidentForDeniedAuthorization({
      userId: input.userId,
      thesis: input.thesis,
      symbol: input.symbol,
      decision,
      failures: hardFailures,
    });
  }

  return { decision, authorized: authorization !== "DENIED" };
}

export async function governanceReview(userId: string): Promise<TradingGovernanceDecision> {
  const performance = await TradingStore.getPerformance(userId);
  const eligibility = liveEligibility(performance);
  return TradingStore.addGovernanceDecision({
    userId,
    decision: performance.closedTrades >= REQUIRED_SAMPLE_SIZE && performance.expectancy > 0 ? "APPROVED" : "PAPER_TRADE_ONLY",
    reason: "Periodic governance review completed for paper-trading validation status.",
    supportingEvidence: [
      `Current trades: ${performance.closedTrades}`,
      `Required sample: ${REQUIRED_SAMPLE_SIZE}`,
      `Expectancy: ${performance.expectancy}`,
      `Maximum drawdown: ${performance.maximumDrawdown}`,
      `Rule violations: ${performance.patternAnalytics.mostCommonRuleViolations.join("; ") || "none recorded"}`,
      `Live trading eligibility: ${eligibility}. Live trading remains disabled in Phase 1.`,
    ],
    requiredActions: eligibility === "Eligible"
      ? ["Manual human review required before any future live-trading phase. Do not enable live execution automatically."]
      : [`Continue paper trading until ${REQUIRED_SAMPLE_SIZE} completed trades and positive expectancy are proven.`],
    nextReviewConditions: ["Run governance review after every 10 closed paper trades or major strategy-rule change."],
    riskMetrics: {
      closedTrades: performance.closedTrades,
      requiredSampleSize: REQUIRED_SAMPLE_SIZE,
      expectancy: performance.expectancy,
      maximumDrawdown: performance.maximumDrawdown,
      winRate: performance.winRate,
      profitFactor: performance.profitFactor,
    },
    liveTradingEligibility: eligibility,
    paperTradingProgress: validationProgress(performance),
    outcome: "pending",
  });
}
