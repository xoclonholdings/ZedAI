import type {
  LiveTradingConfig,
  LiveTradingState,
} from "../../../shared/trading-training-types";

import { readTradingState, writeTradingState } from "./tradingPersistence";
import { TradingIntegrationsStore } from "./TradingIntegrationsStore";
import { getQualificationReport } from "./QualificationEngine";
import { loadProgression } from "../../services/TradingProgressionStore";

/**
 * Stage 7 — Live trading (governed).
 *
 * Wires the full control framework Zed operates a live account inside:
 * per-trade and account risk limits, a kill switch, and the hard gates
 * that must all be satisfied before anything could execute — qualification
 * passed, a broker connected, and the kill switch armed.
 *
 * It deliberately does NOT place orders. Real execution requires a broker
 * order bridge (Tradovate is the intended one); until that exists Zed
 * reports "ready, pending broker" instead of pretending it can trade live.
 * This keeps the promotion path honest end-to-end.
 */

const CONFIG_SCOPE = "live-config";
const BROKER_PROVIDERS = ["tradovate", "topstep"];

export const DEFAULT_LIVE_CONFIG: LiveTradingConfig = {
  maxRiskPerTrade: 100,
  maxDailyLoss: 1000,
  maxTotalDrawdown: 2000,
  killSwitchArmed: false,
};

async function loadConfig(userId: string): Promise<LiveTradingConfig> {
  const stored = await readTradingState<LiveTradingConfig>(CONFIG_SCOPE, userId);
  return { ...DEFAULT_LIVE_CONFIG, ...(stored || {}) };
}

export async function saveLiveConfig(
  userId: string,
  patch: Partial<LiveTradingConfig>,
): Promise<LiveTradingConfig> {
  const next = { ...(await loadConfig(userId)), ...patch };
  await writeTradingState(CONFIG_SCOPE, userId, next);
  return next;
}

export async function setKillSwitch(userId: string, armed: boolean): Promise<LiveTradingState> {
  await saveLiveConfig(userId, { killSwitchArmed: armed });
  return getLiveState(userId);
}

async function broker(userId: string): Promise<{ connected: boolean; label: string }> {
  const integrations = await TradingIntegrationsStore.list(userId).catch(() => []);
  const found = integrations.find(
    (i) =>
      BROKER_PROVIDERS.includes(i.provider) &&
      (i.status === "connected" || i.status === "configured"),
  );
  return found
    ? { connected: true, label: found.label }
    : { connected: false, label: "No broker connected" };
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
  if (!brokerInfo.connected) blockers.push("No broker is connected for order routing (connect Tradovate).");
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
      ? "Zed is qualified and governed — connect a broker (Tradovate) to enable live order routing."
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
