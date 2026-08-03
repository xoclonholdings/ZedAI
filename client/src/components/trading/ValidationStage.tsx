import { useCallback, useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";

import type { TradeThesis, TradingGovernanceDecision } from "@shared/trading-types";

import { EmptyBox, GroupHeading, NoticeBanner, StageShell } from "./stage-atoms";

/**
 * The Validation stage — every strategy is objectively reviewed
 * through the Trading Intelligence governance layer before it
 * earns paper-trading time.
 *
 * The server-side layer produces a decision (Approved,
 * Conditionally Approved, Paper Trade Only, Requires Revision,
 * Rejected) with a recorded reason. The user can re-run the review after
 * revising the strategy.
 */

const CHECK_CLS: Record<string, string> = {
  PASS: "bg-emerald-400/15 text-emerald-300",
  FAIL: "bg-red-400/15 text-red-300",
  NOT_APPLICABLE: "bg-white/10 text-white/40",
  UNKNOWN: "bg-yellow-400/15 text-yellow-200",
};

const VERDICT_META: Record<string, { label: string; cls: string; hint: string }> = {
  APPROVED: {
    label: "Approved",
    cls: "bg-emerald-400/15 text-emerald-300",
    hint: "Cleared for live-adjacent testing once qualified.",
  },
  AUTHORIZED: {
    label: "Approved",
    cls: "bg-emerald-400/15 text-emerald-300",
    hint: "Cleared for live-adjacent testing once qualified.",
  },
  CONDITIONALLY_APPROVED: {
    label: "Conditional",
    cls: "bg-yellow-400/15 text-yellow-200",
    hint: "Approved with conditions — see reasons below.",
  },
  AUTHORIZED_WITH_CONDITIONS: {
    label: "Conditional",
    cls: "bg-yellow-400/15 text-yellow-200",
    hint: "Approved with conditions — see reasons below.",
  },
  PAPER_TRADE_ONLY: {
    label: "Paper only",
    cls: "bg-cyan-400/15 text-cyan-300",
    hint: "Cleared for sandbox testing. Not ready for external evaluation yet.",
  },
  REQUIRES_REVISION: {
    label: "Needs revision",
    cls: "bg-orange-400/15 text-orange-300",
    hint: "Rework the strategy and re-run the review.",
  },
  REJECTED: {
    label: "Rejected",
    cls: "bg-red-400/15 text-red-300",
    hint: "The strategy has structural issues. Don't paper-trade it as is.",
  },
  DENIED: {
    label: "Rejected",
    cls: "bg-red-400/15 text-red-300",
    hint: "The strategy has structural issues. Don't paper-trade it as is.",
  },
};

export default function ValidationStage() {
  const [theses, setTheses] = useState<TradeThesis[]>([]);
  const [decisions, setDecisions] = useState<Record<string, TradingGovernanceDecision>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [thesesRes, decisionsRes] = await Promise.all([
        fetch("/api/trading/theses", { credentials: "include" }),
        fetch("/api/trading/governance/decisions", { credentials: "include" }),
      ]);
      if (!thesesRes.ok) {
        const body = await thesesRes.json().catch(() => ({}));
        throw new Error(body?.error || `Could not load strategies (HTTP ${thesesRes.status})`);
      }
      const thesesData = await thesesRes.json();
      setTheses(
        [...(thesesData.theses || [])].sort((a: TradeThesis, b: TradeThesis) =>
          a.createdAt < b.createdAt ? 1 : -1,
        ),
      );
      if (!decisionsRes.ok) {
        const body = await decisionsRes.json().catch(() => ({}));
        throw new Error(body?.error || `Could not load governance decisions (HTTP ${decisionsRes.status})`);
      }
      // Map the latest decision per thesis so reviewed strategies show
      // their full checklist/reasons on load, not just after re-review.
      const decisionsData = await decisionsRes.json();
      const byThesis: Record<string, TradingGovernanceDecision> = {};
      for (const d of (decisionsData.decisions || []) as TradingGovernanceDecision[]) {
        if (d.thesisId && !byThesis[d.thesisId]) byThesis[d.thesisId] = d;
      }
      setDecisions(byThesis);
    } catch (err: any) {
      setError(err?.message || "Failed to load strategies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runReview = useCallback(async (thesisId: string) => {
    setError(null);
    setNotice(null);
    setReviewing(thesisId);
    try {
      const res = await fetch(`/api/trading/theses/${thesisId}/governance`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      const decision: TradingGovernanceDecision | undefined = body.governanceDecision;
      if (decision) {
        setDecisions((prev) => ({ ...prev, [thesisId]: decision }));
      }
      setNotice("Governance review complete.");
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Review failed.");
    } finally {
      setReviewing(null);
    }
  }, [refresh]);

  const active = useMemo(() => theses.filter((t) => !t.archivedAt), [theses]);
  const needsReview = useMemo(
    () =>
      active.filter(
        (t) =>
          !t.governanceDecision ||
          t.governanceDecision === "REQUIRES_REVISION",
      ),
    [active],
  );
  const reviewed = useMemo(
    () =>
      active.filter(
        (t) => t.governanceDecision && t.governanceDecision !== "REQUIRES_REVISION",
      ),
    [active],
  );

  const renderRow = (thesis: TradeThesis) => {
    const verdictKey = decisions[thesis.id]?.decision || thesis.governanceDecision;
    const meta = verdictKey ? VERDICT_META[verdictKey] : undefined;
    const dec = decisions[thesis.id];
    const isReviewing = reviewing === thesis.id;
    return (
      <div
        key={thesis.id}
        className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
      >
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14px] font-semibold text-white">{thesis.symbol}</span>
              <span
                className={`text-[10.5px] uppercase tracking-[0.06em] rounded-full px-2 py-0.5 ${
                  thesis.direction === "long"
                    ? "bg-emerald-400/15 text-emerald-300"
                    : "bg-red-400/15 text-red-300"
                }`}
              >
                {thesis.direction}
              </span>
              {meta ? (
                <span
                  className={`text-[10.5px] uppercase tracking-[0.06em] rounded-full px-2 py-0.5 ${meta.cls}`}
                >
                  {meta.label}
                </span>
              ) : (
                <span className="text-[10.5px] uppercase tracking-[0.06em] rounded-full px-2 py-0.5 bg-white/10 text-white/50">
                  Not reviewed
                </span>
              )}
              {thesis.primaryTimeframe && (
                <span className="text-[11px] text-white/50">· {thesis.primaryTimeframe}</span>
              )}
            </div>
            <div className="mt-1.5 text-[12px] text-white/60 max-w-[80ch] leading-snug">
              {thesis.reason.slice(0, 220)}
              {thesis.reason.length > 220 ? "…" : ""}
            </div>
            {meta?.hint && (
              <div className="mt-2 text-[11.5px] text-white/50 italic">
                {meta.hint}
              </div>
            )}
            {dec?.reason && (
              <div className="mt-2 rounded-md border border-white/[0.06] bg-white/[0.02] p-2 text-[11.5px] text-white/70 leading-snug">
                {dec.reason}
              </div>
            )}
            {dec?.checklist && dec.checklist.length > 0 && (
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {dec.checklist.map((item) => (
                  <div
                    key={item.key}
                    className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-white/80">{item.label}</span>
                      <span
                        className={`text-[9.5px] uppercase tracking-[0.06em] rounded-full px-1.5 py-0.5 ${CHECK_CLS[item.result] || "bg-white/10 text-white/50"}`}
                      >
                        {item.result}
                      </span>
                    </div>
                    {item.evidence && (
                      <div className="mt-1 text-[11px] text-white/50 leading-snug">
                        {item.evidence}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {dec?.requiredActions && dec.requiredActions.length > 0 && (
              <div className="mt-2">
                <div className="text-[10.5px] uppercase tracking-[0.08em] text-orange-300/70 mb-0.5">
                  Required actions
                </div>
                <ul className="space-y-0.5">
                  {dec.requiredActions.map((a, i) => (
                    <li key={i} className="text-[11.5px] text-white/70 leading-snug">
                      · {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {dec?.supportingEvidence && dec.supportingEvidence.length > 0 && (
              <div className="mt-2">
                <div className="text-[10.5px] uppercase tracking-[0.08em] text-white/40 mb-0.5">
                  Evidence
                </div>
                <ul className="space-y-0.5">
                  {dec.supportingEvidence.slice(0, 5).map((e, i) => (
                    <li key={i} className="text-[11.5px] text-white/55 leading-snug">
                      · {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {dec?.nextReviewConditions && dec.nextReviewConditions.length > 0 && (
              <div className="mt-2">
                <div className="text-[10.5px] uppercase tracking-[0.08em] text-white/40 mb-0.5">
                  Re-review when
                </div>
                <ul className="space-y-0.5">
                  {dec.nextReviewConditions.map((c, i) => (
                    <li key={i} className="text-[11.5px] text-white/55 leading-snug">
                      · {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => void runReview(thesis.id)}
            disabled={isReviewing}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 text-black font-medium px-3 py-1.5 text-[12.5px] hover:bg-cyan-300 disabled:opacity-50 transition-colors active:opacity-80"
          >
            <Sparkles size={12} />
            {isReviewing ? "Reviewing…" : meta ? "Re-review" : "Run review"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <StageShell
      eyebrow="Validation"
      title="Governance review"
      description="ZAR reviews every strategy against market context, statistical edge, risk math, and systemic weakness. You'll see a verdict and reason you can act on."
      onRefresh={() => void refresh()}
      refreshing={loading}
    >
      {notice && <NoticeBanner kind="success">{notice}</NoticeBanner>}
      {error && <NoticeBanner kind="error">{error}</NoticeBanner>}

      {active.length === 0 ? (
        <EmptyBox>
          You need at least one strategy to review. Head back to the Strategy stage and build one.
        </EmptyBox>
      ) : (
        <>
          {needsReview.length > 0 && (
            <div className="mb-5">
              <GroupHeading label="Waiting for review" count={needsReview.length} />
              <div className="space-y-2">{needsReview.map(renderRow)}</div>
            </div>
          )}
          {reviewed.length > 0 && (
            <div>
              <GroupHeading label="Reviewed" count={reviewed.length} />
              <div className="space-y-2">{reviewed.map(renderRow)}</div>
            </div>
          )}
        </>
      )}
    </StageShell>
  );
}
