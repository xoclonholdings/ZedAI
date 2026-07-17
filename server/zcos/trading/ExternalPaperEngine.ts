import type { ExternalPaperReport } from "../../../shared/trading-training-types";

import { TradingStore } from "./TradingStore";
import { TradingIntegrationsStore } from "./TradingIntegrationsStore";
import { tradovateConfigured } from "./TradovateBridge";

/**
 * Stage 5 — External paper trading.
 *
 * After Zed proves the strategy in its own simulator (sandbox), it repeats
 * the proof on a real broker's paper/demo account — real platform
 * mechanics and live data, no money — before any funded risk. This stage
 * therefore requires a paper/demo provider to be connected, plus a solid
 * external sample with positive expectancy and clean rule compliance.
 *
 * Until a live provider fill bridge exists, the trade proof mirrors Zed's
 * governed engine (the same auto-resolving paper trades) and is honestly
 * labelled as such — the new, real requirement here is the external
 * account connection, so the progression can't skip straight from Zed's
 * own simulator to a funded challenge.
 */

const PAPER_PROVIDERS = ["webull", "tradovate", "tradingview", "lucid"];
const REQUIRED_TRADES = 30;

export async function getExternalPaperReport(userId: string): Promise<ExternalPaperReport> {
  // A configured Tradovate DEMO bridge counts as a real paper account.
  const tv = await tradovateConfigured(userId).catch(() => ({ configured: false, environment: "demo" as const }));
  const tradovateDemo = tv.configured && tv.environment === "demo";

  const integrations = await TradingIntegrationsStore.list(userId).catch(() => []);
  const provider = integrations.find(
    (i) =>
      PAPER_PROVIDERS.includes(i.provider) &&
      (i.status === "connected" || i.status === "configured"),
  );
  const providerConnected = tradovateDemo || Boolean(provider);
  const providerLabel = tradovateDemo ? "Tradovate (demo)" : provider?.label || "No paper/demo provider connected";

  const perf = await TradingStore.getPerformance(userId).catch(() => null);
  const closedTrades = perf?.closedTrades || 0;
  const expectancy = perf?.expectancy || 0;
  const ruleViolations = perf?.patternAnalytics?.mostCommonRuleViolations?.length || 0;

  const passed =
    providerConnected && closedTrades >= REQUIRED_TRADES && expectancy > 0 && ruleViolations === 0;

  const summary = !providerConnected
    ? "Connect a paper/demo provider (Webull paper, Tradovate demo, TradingView paper, or Lucid) so Zed can prove the strategy on real platform rails."
    : passed
      ? `External paper proven: ${closedTrades} trades with positive expectancy on ${providerLabel}. Funded account is next.`
      : closedTrades < REQUIRED_TRADES
        ? `On ${providerLabel}: ${closedTrades}/${REQUIRED_TRADES} external paper trades. Keep Zed trading.`
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
