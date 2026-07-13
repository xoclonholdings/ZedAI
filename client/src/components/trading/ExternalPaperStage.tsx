import { useCallback, useEffect, useState } from "react";

import type { ExternalPaperReport } from "@shared/trading-training-types";

import { EmptyBox, NoticeBanner, StageShell } from "./stage-atoms";

/**
 * Stage 5 — External paper trading. After the internal simulator, Zed
 * proves the same strategy on a real broker's paper/demo account (real
 * platform mechanics + live data, no money) before any funded risk.
 * Gated on connecting a paper/demo provider.
 */
export default function ExternalPaperStage() {
  const [report, setReport] = useState<ExternalPaperReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/trading/external-paper", { credentials: "include" });
      if (res.ok) setReport((await res.json()).report);
    } catch (err: any) {
      setError(err?.message || "Failed to load external paper");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <StageShell
      eyebrow="External paper"
      title="External paper trading"
      description="Zed repeats the proof on a real broker's paper/demo account — real platform mechanics and live data, no money — before any funded risk. Connect a paper provider in Train Zed to begin."
      onRefresh={() => void refresh()}
      refreshing={loading}
    >
      {error && <NoticeBanner kind="error">{error}</NoticeBanner>}
      {!report ? (
        <EmptyBox>Loading…</EmptyBox>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[10px] uppercase tracking-[0.06em] rounded-full px-2 py-0.5 ${
                report.passed
                  ? "bg-emerald-400/15 text-emerald-300"
                  : report.providerConnected
                    ? "bg-cyan-400/15 text-cyan-300"
                    : "bg-amber-400/15 text-amber-300"
              }`}
            >
              {report.passed ? "proven" : report.providerConnected ? "in progress" : "connect provider"}
            </span>
            <span className="text-[11.5px] text-white/50">
              {report.providerConnected ? `Provider: ${report.providerLabel}` : report.providerLabel}
            </span>
          </div>

          <p className="text-[12.5px] text-white/70 leading-snug">{report.summary}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="External trades" value={`${report.closedTrades}/${report.requiredTrades}`} />
            <Stat label="Expectancy" value={`$${report.expectancy}`} />
            <Stat label="Rule violations" value={String(report.ruleViolations)} />
            <Stat label="Provider" value={report.providerConnected ? "Connected" : "—"} />
          </div>

          {!report.providerConnected && (
            <p className="text-[11px] text-white/40 leading-snug">
              Connect Tradovate demo, TradingView paper, or Lucid in the Train Zed console. Until a
              live fill bridge exists, Zed mirrors this proof on its governed engine — the new
              requirement here is the external account connection.
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
