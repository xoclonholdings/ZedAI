import type { EvaluationConfig, EvaluationReport } from "../../../shared/trading-training-types";

import { readTradingObject, writeTradingObject } from "./tradingPersistence";
import { TradingStore } from "./TradingStore";
import { TradingIntegrationsStore } from "./TradingIntegrationsStore";
import { tradovateConfigured } from "./TradovateBridge";

/**
 * Stage 5 — External evaluation.
 *
 * Runs ZAR's proven strategy through a funded-account-style objective:
 * reach a profit target without breaching the max daily loss or the max
 * total drawdown, over a minimum number of trading days. Progress is
 * measured from the paper trades ZAR closes after the evaluation starts —
 * the same auto-resolving engine that proved the sandbox — so the run is
 * real, not fabricated.
 *
 * When a real evaluation provider is connected it is reported as the
 * source; until a live
 * provider bridge exists, the run is transparently labelled as running on
 * ZAR's own engine. It never invents a provider result.
 */

const CONFIG_SCOPE = "evaluation-config";
const STATE_SCOPE = "evaluation-state";

const EVALUATION_PROVIDERS = ["webull", "tradovate", "lucid"];

export const DEFAULT_EVALUATION_CONFIG: EvaluationConfig = {
  provider: "auto",
  startingBalance: 50000,
  profitTarget: 3000,
  maxDailyLoss: 1000,
  maxTotalDrawdown: 2000,
  minTradingDays: 5,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function loadConfig(userId: string): Promise<EvaluationConfig> {
  const stored = await readTradingObject<EvaluationConfig>(CONFIG_SCOPE, userId);
  return { ...DEFAULT_EVALUATION_CONFIG, ...(stored || {}) };
}

export async function saveEvaluationConfig(
  userId: string,
  patch: Partial<EvaluationConfig>,
): Promise<EvaluationConfig> {
  const next = { ...(await loadConfig(userId)), ...patch };
  await writeTradingObject(CONFIG_SCOPE, userId, next);
  return next;
}

async function loadStartedAt(userId: string): Promise<string | null> {
  const state = await readTradingObject<{ startedAt: string | null }>(STATE_SCOPE, userId);
  return state?.startedAt ?? null;
}

export async function startEvaluation(userId: string): Promise<EvaluationReport> {
  await writeTradingObject(STATE_SCOPE, userId, { startedAt: new Date().toISOString() });
  return getEvaluationReport(userId);
}

export async function resetEvaluation(userId: string): Promise<EvaluationReport> {
  await writeTradingObject(STATE_SCOPE, userId, { startedAt: null });
  return getEvaluationReport(userId);
}

async function evaluationProvider(
  userIdArg: string,
): Promise<{ connected: boolean; label: string }> {
  // Tradovate credentials live in their own store (TradovateBridge), not
  // TradingIntegrationsStore, so a fully-configured Tradovate connection
  // must be checked directly — otherwise it always reads as disconnected
  // here even when real Tradovate demo/live trading is working.
  const tradovate = await tradovateConfigured(userIdArg).catch(() => ({ configured: false, environment: "demo" as const }));
  if (tradovate.configured) return { connected: true, label: `Tradovate (${tradovate.environment})` };

  const integrations = await TradingIntegrationsStore.list(userIdArg).catch(() => []);
  const connected = integrations.find(
    (i) =>
      EVALUATION_PROVIDERS.includes(i.provider) &&
      (i.status === "connected" || i.status === "configured"),
  );
  if (connected) return { connected: true, label: connected.label };
  return { connected: false, label: "ZAR sandbox engine (no provider bridge yet)" };
}

export async function getEvaluationReport(userIdArg: string): Promise<EvaluationReport> {
  const config = await loadConfig(userIdArg);
  const startedAt = await loadStartedAt(userIdArg);
  const provider = await evaluationProvider(userIdArg);

  const closedAll = await TradingStore.listPaperTrades(userIdArg, "closed");
  const closed = startedAt
    ? closedAll.filter((t) => (t.closedAt || t.updatedAt) >= startedAt)
    : [];

  // Per-day P&L for the daily-loss check, plus a running equity curve for
  // drawdown. Trades are oldest→newest.
  const ordered = [...closed].sort((a, b) =>
    (a.closedAt || a.updatedAt) < (b.closedAt || b.updatedAt) ? -1 : 1,
  );
  const dayPnl = new Map<string, number>();
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let worstDay = 0;
  for (const t of ordered) {
    const pnl = Number(t.realizedPnl || 0);
    equity += pnl;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
    const day = (t.closedAt || t.updatedAt).slice(0, 10);
    dayPnl.set(day, (dayPnl.get(day) || 0) + pnl);
  }
  for (const v of dayPnl.values()) worstDay = Math.min(worstDay, v);

  const netProfit = round2(equity);
  const currentDrawdown = round2(peak - equity);
  const tradingDays = dayPnl.size;

  const breaches: string[] = [];
  if (worstDay < -config.maxDailyLoss) {
    breaches.push(`Max daily loss breached: worst day ${round2(worstDay)} vs limit -${config.maxDailyLoss}.`);
  }
  if (maxDrawdown > config.maxTotalDrawdown) {
    breaches.push(`Max drawdown breached: ${round2(maxDrawdown)} vs limit ${config.maxTotalDrawdown}.`);
  }

  let status: EvaluationReport["status"] = "not_started";
  if (startedAt) {
    if (breaches.length) status = "failed";
    else if (netProfit >= config.profitTarget && tradingDays >= config.minTradingDays) status = "passed";
    else status = "active";
  }

  const progress = config.profitTarget > 0
    ? Math.max(0, Math.min(100, Math.round((netProfit / config.profitTarget) * 100)))
    : 0;

  const summary =
    status === "not_started"
      ? "Start the evaluation, then let ZAR trade toward the objective."
      : status === "passed"
        ? `Objective met: +$${netProfit} over ${tradingDays} day(s), no rule breaches. Qualification is next.`
        : status === "failed"
          ? `Evaluation failed: ${breaches.join(" ")} Reset and let ZAR run a clean attempt.`
          : `In progress: +$${netProfit} of $${config.profitTarget} (${progress}%), ${tradingDays}/${config.minTradingDays} day(s).`;

  return {
    config,
    startedAt,
    status,
    providerConnected: provider.connected,
    providerLabel: provider.label,
    netProfit,
    profitTargetProgressPct: progress,
    tradingDays,
    worstDayPnl: round2(worstDay),
    currentDrawdown,
    maxDrawdownSeen: round2(maxDrawdown),
    breaches,
    closedTradesCounted: closed.length,
    summary,
  };
}
