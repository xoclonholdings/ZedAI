import { useCallback, useEffect, useState } from "react";

import type { QualificationReport } from "@shared/trading-training-types";

import { EmptyBox, NoticeBanner, StageShell } from "./stage-atoms";

/**
 * Stage 6 — Qualification. A readiness scorecard computed from ZAR's real
 * performance: rule compliance, edge, drawdown control, consistency, and a
 * proven sample. ZAR is qualified when every score is at target.
 */
export default function QualificationStage() {
  const [report, setReport] = useState<QualificationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/trading/qualification", { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Could not load qualification (HTTP ${res.status})`);
      }
      setReport((await res.json()).report);
    } catch (err: any) {
      setError(err?.message || "Failed to load qualification");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <StageShell
      eyebrow="Qualification"
      title="Readiness scorecard"
      description="ZAR confirms it consistently satisfies professional evaluation requirements. Every discipline must reach target before live unlocks."
      onRefresh={() => void refresh()}
      refreshing={loading}
    >
      {error && <NoticeBanner kind="error">{error}</NoticeBanner>}
      {!report ? (
        error ? null : <EmptyBox>Loading scorecard…</EmptyBox>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[10px] uppercase tracking-[0.06em] rounded-full px-2 py-0.5 ${
                report.ready ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-300"
              }`}
            >
              {report.ready ? "qualified" : "not ready"}
            </span>
            <span className="text-[11.5px] text-white/50">Overall {report.overallScore} / target {report.target}</span>
          </div>

          <p className="text-[12.5px] text-white/70 leading-snug">{report.summary}</p>

          <div className="space-y-2">
            {report.scores.map((s) => {
              const ok = s.score >= s.target;
              return (
                <div key={s.key} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-white">{s.label}</span>
                    <span className={`text-[12px] font-semibold tabular-nums ${ok ? "text-emerald-300" : "text-amber-300"}`}>
                      {s.score}/{s.target}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${ok ? "bg-emerald-400" : "bg-amber-400"}`}
                      style={{ width: `${Math.min(100, s.score)}%` }}
                    />
                  </div>
                  <div className="mt-1.5 text-[11.5px] text-white/50 leading-snug">{s.detail}</div>
                </div>
              );
            })}
          </div>

          {report.requiredImprovements.length > 0 && (
            <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.04] p-3 text-[12px] text-amber-100">
              <div className="font-semibold mb-1">To qualify, improve:</div>
              {report.requiredImprovements.map((r, i) => (
                <div key={i}>· {r}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </StageShell>
  );
}
