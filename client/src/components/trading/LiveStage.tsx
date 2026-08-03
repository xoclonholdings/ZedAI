import { useCallback, useEffect, useState } from "react";

import type { LiveTradingState } from "@shared/trading-training-types";

import { EmptyBox, NoticeBanner, StageShell } from "./stage-atoms";

/**
 * Stage 7 — Live trading (governed). Wires the full risk framework and
 * kill switch and shows the hard gates before anything can execute:
 * qualification passed, a broker connected, and the kill switch armed.
 * Order routing itself runs through the broker bridge once it
 * exists — this never fakes a live fill.
 */

const STATUS_CLS: Record<string, string> = {
  armed: "bg-emerald-400/15 text-emerald-300",
  ready_pending_broker: "bg-cyan-400/15 text-cyan-300",
  blocked: "bg-red-400/15 text-red-300",
};

export default function LiveStage() {
  const [state, setState] = useState<LiveTradingState | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/trading/live", { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Could not load live state (HTTP ${res.status})`);
      }
      setState((await res.json()).state);
    } catch (err: any) {
      setError(err?.message || "Failed to load live state");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleKill = useCallback(async () => {
    if (!state) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/trading/live/kill-switch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ armed: !state.config.killSwitchArmed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setState((await res.json()).state);
    } catch (err: any) {
      setError(err?.message || "Could not toggle kill switch");
    } finally {
      setBusy(false);
    }
  }, [state]);

  return (
    <StageShell
      eyebrow="Live"
      title="Live trading (governed)"
      description="ZAR operates the full risk framework it proved through the earlier stages. Live execution unlocks only when qualified, with a broker connected and the kill switch armed."
      onRefresh={() => void refresh()}
      refreshing={loading}
    >
      {error && <NoticeBanner kind="error">{error}</NoticeBanner>}
      {!state ? (
        error ? null : <EmptyBox>Loading live state…</EmptyBox>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] uppercase tracking-[0.06em] rounded-full px-2 py-0.5 ${STATUS_CLS[state.status]}`}>
              {state.status.replace(/_/g, " ")}
            </span>
            <span className="text-[11.5px] text-white/50">
              {state.brokerConnected ? `Broker: ${state.brokerLabel}` : state.brokerLabel}
            </span>
          </div>

          <p className="text-[12.5px] text-white/70 leading-snug">{state.summary}</p>

          {/* Hard gates */}
          <div className="space-y-1.5">
            <Gate ok={state.qualificationPassed} label="Qualification passed" />
            <Gate ok={state.brokerConnected} label="Broker connected (order routing)" />
            <Gate ok={state.config.killSwitchArmed} label="Kill switch armed" />
          </div>

          {/* Risk framework */}
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Max risk / trade" value={`$${state.config.maxRiskPerTrade}`} />
            <Stat label="Max daily loss" value={`$${state.config.maxDailyLoss}`} />
            <Stat label="Max drawdown" value={`$${state.config.maxTotalDrawdown}`} />
          </div>

          <button
            type="button"
            onClick={() => void toggleKill()}
            disabled={busy}
            className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium disabled:opacity-50 ${
              state.config.killSwitchArmed
                ? "border border-red-400/30 bg-red-400/[0.06] text-red-200 hover:bg-red-400/[0.12]"
                : "bg-cyan-400 text-black hover:bg-cyan-300"
            }`}
          >
            {busy ? "Working…" : state.config.killSwitchArmed ? "Disarm kill switch" : "Arm kill switch"}
          </button>

          <p className="text-[11px] text-white/40 leading-snug">
            Live order routing requires a connected broker such as Webull. Until it's enabled,
            ZAR stays in a governed, ready state and does not place real orders.
          </p>
        </div>
      )}
    </StageShell>
  );
}

function Gate({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[12.5px]">
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-white/30"}`} />
      <span className={ok ? "text-white/80" : "text-white/45"}>{label}</span>
      <span className={`ml-auto text-[11px] ${ok ? "text-emerald-300" : "text-white/40"}`}>{ok ? "ready" : "pending"}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.08em] text-white/40">{label}</div>
      <div className="mt-0.5 text-[14px] font-semibold text-white tabular-nums">{value}</div>
    </div>
  );
}
