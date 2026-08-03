import type { ExternalPaperReport } from "../../../shared/trading-training-types";

import { TradingStore } from "./TradingStore";
import { getWebullStatus } from "./WebullBridge";
import { tradovateConfigured } from "./TradovateBridge";

/**
 * Stage 5 — External paper trading.
 *
 * After ZAR proves the strategy in its own simulator (sandbox), it repeats
 * the proof on a real broker's paper/demo account — real platform
 * mechanics and live data, no money — before any funded risk. This stage
 * therefore requires a paper/demo provider to be connected, plus a solid
 * external sample with positive expectancy and clean rule compliance.
 *
 * Until a live provider fill bridge exists, the trade proof mirrors ZAR's
 * governed engine (the same auto-resolving paper trades) and is honestly
 * labelled as such — the new, real requirement here is the external
 * account connection, so the progression can't skip straight from ZAR's
 * own simulator to a funded challenge.
 */

const REQUIRED_TRADES = 30;

export async function getExternalPaperReport(userId: string): Promise<ExternalPaperReport> {
  const [webull, tradovate] = await Promise.all([
    getWebullStatus(userId).catch(() => null),
    tradovateConfigured(userId).catch(() => ({ configured: false, environment: "demo" as const })),
  ]);
  const webullConnected = Boolean(webull?.connected);
  const tradovateConnected = tradovate.configured;
  const providerConnected = webullConnected || tradovateConnected;
  const providerLabel = webullConnected && tradovateConnected
    ? "Webull + Tradovate"
    : webullConnected
      ? "Webull"
      : tradovateConnected
        ? "Tradovate"
        : "No paper/demo broker connected";

  const closed = (await TradingStore.listPaperTrades(userId, "closed").catch(() => []))
    .filter(
      (trade) =>
        trade.executionMode === "external_paper" &&
        (trade.executionProvider === "webull" || trade.executionProvider === "tradovate"),
    );
  const closedTrades = closed.length;
  const totalPnl = closed.reduce((sum, trade) => sum + Number(trade.realizedPnl || 0), 0);
  const expectancy = closedTrades ? Math.round((totalPnl / closedTrades) * 10000) / 10000 : 0;
  const ruleViolations = closed.reduce((sum, trade) => sum + (trade.ruleViolations?.length || 0), 0);

  const passed =
    providerConnected && closedTrades >= REQUIRED_TRADES && expectancy > 0 && ruleViolations === 0;

  const summary = !providerConnected
    ? "Connect Webull or Tradovate paper/demo trading so ZAR can prove the strategy on real platform rails."
    : passed
      ? `External paper proven: ${closedTrades} ${providerLabel} paper trades with positive expectancy. Funded account is next.`
      : closedTrades < REQUIRED_TRADES
        ? `On ${providerLabel}: ${closedTrades}/${REQUIRED_TRADES} external paper trades. Keep ZAR trading.`
        : ruleViolations > 0
          ? `On ${providerLabel}: sample size met, but ${ruleViolations} rule-violation type(s) must clear first.`
          : `On ${providerLabel}: expectancy is ${expectancy} — it needs to be positive.`;

  return {
    providerConnected,
    providerLabel,
    closedTrades,
    requiredTrades: REQUIRED_TRADES,
    expectancy,
    ruleViolations,
    passed,
    summary,
  };
}
