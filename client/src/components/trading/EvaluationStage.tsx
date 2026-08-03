import { useCallback, useEffect, useState } from "react";

import type { EvaluationReport } from "@shared/trading-training-types";

import { EmptyBox, NoticeBanner, StageShell } from "./stage-atoms";

/**
 * Stage 5 — External evaluation. ZAR runs its proven strategy toward a
 * funded-account objective (profit target, daily-loss + drawdown limits,
 * minimum trading days), scored from the trades it closes. Honest about
 * whether a real provider is connected.
 */

const STATUS_CLS: Record<string, string> = {
  passed: "bg-emerald-400/15 text-emerald-300",
  active: "bg-cyan-400/15 text-cyan-300",
  failed: "bg-red-400/15 text-red-300",
  not_started: "bg-white/10 text-white/50",
};

function money(n: number): string {
  const s = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${s}$${Math.abs(n).toFixed(2)}`;
}

export default function EvaluationStage() {
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/trading/evaluation", { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Could not load evaluation (HTTP ${res.status})`);
      }
      setReport((await res.json()).report);
    } catch (err: any) {
      setError(err?.message || "Failed to load evaluation");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const act = useCallback(
    async (path: string) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/trading/evaluation/${path}`, {
          method: "POST",
          credentials: "include",
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        setReport(body.report);
      } catch (err: any) {
        setError(err?.message || "Action failed");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  return (
    <StageShell
      eyebrow="Funded account"
      title="Funded-account evaluation"
      description="After external paper trading, ZAR runs the funded-account challenge — hit the profit target without breaching the daily-loss or drawdown limits, over the minimum trading days. Real payout stakes."
      onRefresh={() => void refresh()}
      refreshing={loading}
    >
      {error && <NoticeBanner kind="error">{error}</NoticeBanner>}
      {!report ? (
        error ? null : <EmptyBox>Loading evaluation…</EmptyBox>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] uppercase tracking-[0.06em] rounded-full px-2 py-0.5 ${STATUS_CLS[report.status]}`}>
              {report.status.replace("_", " ")}
            </span>
            <span className="text-[11.5px] text-white/50">
              {report.providerConnected ? `Provider: ${report.providerLabel}` : report.providerLabel}
            </span>
          </div>

          <p className="text-[12.5px] text-white/70 leading-snug">{report.summary}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Net P&L" value={money(report.netProfit)} />
            <Stat label="Target" value={`$${report.config.profitTarget}`} />
            <Stat label="Progress" value={`${report.profitTargetProgressPct}%`} />
            <Stat label="Trading days" value={`${report.tradingDays}/${report.config.minTradingDays}`} />
            <Stat label="Worst day" value={money(report.worstDayPnl)} />
            <Stat label="Daily-loss limit" value={`-$${report.config.maxDailyLoss}`} />
            <Stat label="Max drawdown" value={`$${report.maxDrawdownSeen}`} />
            <Stat label="Drawdown limit" value={`$${report.config.maxTotalDrawdown}`} />
          </div>

          {report.breaches.length > 0 && (
            <div className="rounded-lg border border-red-400/30 bg-red-400/[0.05] p-3 text-[12px] text-red-200">
              {report.breaches.map((b, i) => (
                <div key={i}>· {b}</div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            {report.status === "not_started" ? (
              <button
                type="button"
                onClick={() => void act("start")}
                disabled={busy}
                className="rounded-lg bg-cyan-400 text-black font-medium px-3.5 py-1.5 text-[13px] hover:bg-cyan-300 disabled:opacity-50"
              >
                {busy ? "Starting…" : "Start evaluation"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void act("reset")}
                disabled={busy}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[13px] text-white/70 hover:text-white disabled:opacity-50"
              >
                {busy ? "Resetting…" : "Reset evaluation"}
              </button>
            )}
          </div>

          {!report.providerConnected && (
            <p className="text-[11px] text-white/40 leading-snug">
              No evaluation provider is connected yet, so this runs on ZAR's own system.
              Connect a supported evaluation provider when it's available to run it under a real broker.
            </p>
          )}
        </div>
      )}
    </StageShell>
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
