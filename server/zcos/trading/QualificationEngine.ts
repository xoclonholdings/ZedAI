import type {
  QualificationReport,
  QualificationScore,
} from "../../../shared/trading-training-types";

import { TradingStore } from "./TradingStore";
import { getEvaluationReport, DEFAULT_EVALUATION_CONFIG } from "./EvaluationEngine";

/**
 * Stage 6 — Qualification.
 *
 * Turns ZAR's real performance (sandbox + evaluation) into a daily
 * readiness scorecard across the disciplines a professional evaluation
 * cares about: rule compliance, edge (expectancy), drawdown control,
 * consistency, and a sufficient sample. ZAR is qualified when every score
 * is at target. Everything is computed from stored results — no guesswork.
 */

const TARGET = 70;

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function getQualificationReport(userId: string): Promise<QualificationReport> {
  const perf = await TradingStore.getPerformance(userId).catch(() => null);
  const evalReport = await getEvaluationReport(userId).catch(() => null);

  const closed = perf?.closedTrades || 0;
  const expectancy = perf?.expectancy || 0;
  const winRate = perf?.winRate || 0;
  const profitFactor = perf?.profitFactor || 0;
  const drawdown = perf?.maximumDrawdown || 0;
  const consecutiveLosses = perf?.consecutiveLosses || 0;
  const violations = perf?.patternAnalytics?.mostCommonRuleViolations?.length || 0;

  // Rule compliance — full marks with no recurring violations.
  const compliance = clamp(violations === 0 ? 100 : Math.max(0, 100 - violations * 25));
  // Edge — positive, growing expectancy. Scaled so a solid expectancy tops out.
  const edge = clamp(expectancy <= 0 ? 0 : 60 + Math.min(40, expectancy * 4));
  // Drawdown control — evaluation drawdown limit as the yardstick.
  const ddLimit = evalReport?.config.maxTotalDrawdown || DEFAULT_EVALUATION_CONFIG.maxTotalDrawdown;
  const ddUsedPct = ddLimit > 0 ? Math.min(1, (evalReport?.maxDrawdownSeen || Math.abs(drawdown)) / ddLimit) : 1;
  const drawdownControl = clamp((1 - ddUsedPct) * 100);
  // Consistency — win rate + profit factor, penalised by loss streaks.
  const consistency = clamp(
    winRate * 60 + Math.min(30, profitFactor * 15) - consecutiveLosses * 5 + 10,
  );
  // Sample — 100 closed trades is a full, proven sample.
  const sample = clamp((closed / 100) * 100);

  const scores: QualificationScore[] = [
    { key: "compliance", label: "Rule compliance", score: compliance, target: TARGET, detail: violations === 0 ? "No recurring rule violations." : `${violations} recurring rule violation type(s).` },
    { key: "edge", label: "Edge (expectancy)", score: edge, target: TARGET, detail: `Expectancy $${expectancy}. Needs to be positive and stable.` },
    { key: "drawdown", label: "Drawdown control", score: drawdownControl, target: TARGET, detail: `Max drawdown seen $${evalReport?.maxDrawdownSeen ?? Math.abs(drawdown)} of $${ddLimit} limit.` },
    { key: "consistency", label: "Consistency", score: consistency, target: TARGET, detail: `Win rate ${Math.round(winRate * 100)}%, profit factor ${profitFactor}, ${consecutiveLosses} consecutive losses.` },
    { key: "sample", label: "Proven sample", score: sample, target: TARGET, detail: `${closed} of 100 closed trades.` },
  ];

  const overallScore = clamp(scores.reduce((sum, s) => sum + s.score, 0) / scores.length);
  const ready = scores.every((s) => s.score >= s.target);

  const strengths = scores.filter((s) => s.score >= s.target).map((s) => s.label);
  const weaknesses = scores.filter((s) => s.score < s.target).map((s) => s.label);
  const requiredImprovements = scores
    .filter((s) => s.score < s.target)
    .map((s) => `${s.label}: ${s.detail}`);

  const summary = ready
    ? `ZAR is qualified — every discipline is at target (overall ${overallScore}). Live is unlocked once a broker is connected.`
    : `Not qualified yet (overall ${overallScore}). Improve: ${weaknesses.join(", ")}.`;

  return {
    ready,
    overallScore,
    target: TARGET,
    scores,
    strengths,
    weaknesses,
    requiredImprovements,
    summary,
    generatedAt: new Date().toISOString(),
  };
}
