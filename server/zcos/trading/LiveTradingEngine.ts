import type {
  LiveTradingConfig,
  LiveTradingState,
} from "../../../shared/trading-training-types";

import { readTradingObject, writeTradingObject } from "./tradingPersistence";
import { getQualificationReport } from "./QualificationEngine";
import { tradovateConfigured } from "./TradovateBridge";
import { getWebullStatus } from "./WebullAuth";
import { loadProgression } from "../../services/TradingProgressionStore";

/**
 * Stage 7 — Live trading (governed).
 *
 * Wires the full control framework ZAR operates a live account inside:
 * per-trade and account risk limits, a kill switch, and the hard gates
 * that must all be satisfied before anything could execute — qualification
 * passed, a broker connected, and the kill switch armed.
 *
 * This module itself never places an order — it only computes and stores
 * the gate state (`getLiveState`/`canExecute`). Real order routing lives
 * in each broker's own route: `POST /api/trading/webull/order` (via
 * `placeWebullLiveOrder`) and `POST /api/trading/tradovate/order` (when
 * connected in "live" mode) both call `getLiveState(userId).canExecute`
 * before touching the broker, so this file is the single source of truth
 * either path defers to. Until a broker resolves to a genuine production
 * connection, `brokerConnected` stays false and status reports
 * "ready, pending broker" instead of pretending it can trade live.
 */

const CONFIG_SCOPE = "live-config";

export const DEFAULT_LIVE_CONFIG: LiveTradingConfig = {
  maxRiskPerTrade: 100,
  maxDailyLoss: 1000,
  maxTotalDrawdown: 2000,
  killSwitchArmed: false,
};

async function loadConfig(userId: string): Promise<LiveTradingConfig> {
  const stored = await readTradingObject<LiveTradingConfig>(CONFIG_SCOPE, userId);
  return { ...DEFAULT_LIVE_CONFIG, ...(stored || {}) };
}

export async function saveLiveConfig(
  userId: string,
  patch: Partial<LiveTradingConfig>,
): Promise<LiveTradingConfig> {
  const next = { ...(await loadConfig(userId)), ...patch };
  await writeTradingObject(CONFIG_SCOPE, userId, next);
  return next;
}

export async function setKillSwitch(userId: string, armed: boolean): Promise<LiveTradingState> {
  await saveLiveConfig(userId, { killSwitchArmed: armed });
  return getLiveState(userId);
}

/**
 * A broker only counts as "connected" for live/funded execution if it's
 * actually resolved to a PRODUCTION connection — a sandbox/demo-only
 * connection (either provider) must never make Live status report
 * "armed", since neither placeWebullLiveOrder nor the Tradovate live
 * order route will actually execute against anything but production.
 */
async function broker(userId: string): Promise<{ connected: boolean; label: string }> {
  const tv = await tradovateConfigured(userId).catch(() => ({ configured: false, environment: "demo" as const }));
  if (tv.configured && tv.environment === "live") {
    return { connected: true, label: "Tradovate (live)" };
  }
  const webull = await getWebullStatus(userId).catch(() => null);
  if (webull?.connected && webull.mode === "production") {
    return { connected: true, label: "Webull (production)" };
  }
  return { connected: false, label: "No broker connected" };
}

export async function getLiveState(userId: string): Promise<LiveTradingState> {
  const config = await loadConfig(userId);
  const brokerInfo = await broker(userId);
  const progression = await loadProgression(userId).catch(() => null);
  const qualPassed =
    progression?.assessments?.qualification?.passed ??
    (await getQualificationReport(userId).then((r) => r.ready).catch(() => false));

  const blockers: string[] = [];
  if (!qualPassed) blockers.push("Qualification is not passed yet.");
  if (!brokerInfo.connected) blockers.push("No broker is connected for order routing (connect Webull).");
  if (!config.killSwitchArmed) blockers.push("Kill switch is not armed.");

  const canExecute = qualPassed && brokerInfo.connected && config.killSwitchArmed;
  const status: LiveTradingState["status"] = canExecute
    ? "armed"
    : qualPassed && !brokerInfo.connected
      ? "ready_pending_broker"
      : "blocked";

  const summary = canExecute
    ? "All gates satisfied and the kill switch is armed. Live execution runs through the broker bridge once it is enabled."
    : status === "ready_pending_broker"
      ? "ZAR is qualified and governed — connect Webull to enable live order routing."
      : `Live is blocked: ${blockers.join(" ")}`;

  return {
    config,
    brokerConnected: brokerInfo.connected,
    brokerLabel: brokerInfo.label,
    qualificationPassed: qualPassed,
    canExecute,
    status,
    blockers,
    summary,
  };
}
