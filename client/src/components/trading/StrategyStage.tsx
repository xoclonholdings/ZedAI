import { useCallback, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";

import type { TradeThesis } from "@shared/trading-types";

import {
  EmptyBox,
  FormField,
  NoticeBanner,
  StageShell,
  inputClass,
  textareaClass,
} from "./stage-atoms";

/**
 * The Strategy stage — turn what you learned into a repeatable,
 * versioned trade thesis. Each thesis captures market structure,
 * liquidity, entry / stop / target plans, and invalidation
 * conditions so the same setup gets executed the same way twice.
 *
 * Every thesis is auto-run through governance on create (server
 * side) — the verdict shows up on the row so users can see what
 * changed since last look without re-running.
 */

const MARKETS = ["US", "Crypto", "Forex", "Futures", "Options"];
const ASSET_CLASSES = ["stock", "etf", "option", "future", "crypto", "forex"] as const;
const DIRECTIONS = ["long", "short"] as const;

const EMPTY_FORM = {
  market: "US",
  assetClass: "stock" as (typeof ASSET_CLASSES)[number],
  symbol: "",
  direction: "long" as "long" | "short",
  primaryTimeframe: "",
  reason: "",
  marketStructure: "",
  liquidityAnalysis: "",
  entryPlan: "",
  stopPlan: "",
  targetPlan: "",
  riskReward: "",
  invalidationConditions: "",
  confidenceScore: "60",
};

function friendlyVerdict(v?: string): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    APPROVED: { label: "Approved", cls: "bg-emerald-400/15 text-emerald-300" },
    AUTHORIZED: { label: "Approved", cls: "bg-emerald-400/15 text-emerald-300" },
    CONDITIONALLY_APPROVED: {
      label: "Conditional",
      cls: "bg-yellow-400/15 text-yellow-200",
    },
    AUTHORIZED_WITH_CONDITIONS: {
      label: "Conditional",
      cls: "bg-yellow-400/15 text-yellow-200",
    },
    PAPER_TRADE_ONLY: {
      label: "Paper only",
      cls: "bg-cyan-400/15 text-cyan-300",
    },
    REQUIRES_REVISION: {
      label: "Needs revision",
      cls: "bg-orange-400/15 text-orange-300",
    },
    REJECTED: { label: "Rejected", cls: "bg-red-400/15 text-red-300" },
    DENIED: { label: "Rejected", cls: "bg-red-400/15 text-red-300" },
  };
  return v && map[v]
    ? map[v]
    : { label: "Not reviewed", cls: "bg-white/10 text-white/50" };
}

export default function StrategyStage() {
  const [theses, setTheses] = useState<TradeThesis[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/trading/theses", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setTheses(
          [...(data.theses || [])].sort((a: TradeThesis, b: TradeThesis) =>
            a.createdAt < b.createdAt ? 1 : -1,
          ),
        );
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load strategies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submit = useCallback(async () => {
    setError(null);
    setNotice(null);
    const missing = [
      "symbol",
      "reason",
      "marketStructure",
      "liquidityAnalysis",
      "entryPlan",
      "stopPlan",
      "targetPlan",
      "invalidationConditions",
    ].filter((k) => !String(form[k as keyof typeof form] || "").trim());
    if (missing.length > 0) {
      setError(`Fill in: ${missing.join(", ")}`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/trading/theses", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          market: form.market,
          assetClass: form.assetClass,
          symbol: form.symbol.trim().toUpperCase(),
          direction: form.direction,
          primaryTimeframe: form.primaryTimeframe.trim() || undefined,
          reason: form.reason.trim(),
          marketStructure: form.marketStructure.trim(),
          liquidityAnalysis: form.liquidityAnalysis.trim(),
          entryPlan: form.entryPlan.trim(),
          stopPlan: form.stopPlan.trim(),
          targetPlan: form.targetPlan.trim(),
          riskReward: form.riskReward.trim() ? Number(form.riskReward) : undefined,
          invalidationConditions: form.invalidationConditions
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          confidenceScore: Number(form.confidenceScore) || 50,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setForm(EMPTY_FORM);
      setShowForm(false);
      setNotice("Strategy saved. Zed auto-ran a governance review — verdict is on the row.");
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Could not save strategy.");
    } finally {
      setSubmitting(false);
    }
  }, [form, refresh]);

  const active = theses.filter((t) => !t.archivedAt);

  return (
    <StageShell
      eyebrow="Strategy"
      title="Your trading strategies"
      description="Every strategy captures market structure, liquidity, entry / stop / target plans, and invalidation. Once saved, Zed runs a governance review automatically — you'll see the verdict on the row."
      onRefresh={() => void refresh()}
      refreshing={loading}
      action={
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 text-black font-medium px-3 py-1.5 text-[13px] hover:bg-cyan-300 transition-colors active:opacity-80"
        >
          <Plus size={13} />
          {showForm ? "Cancel" : "New strategy"}
        </button>
      }
    >
      {notice && <NoticeBanner kind="success">{notice}</NoticeBanner>}
      {error && <NoticeBanner kind="error">{error}</NoticeBanner>}

      {showForm && (
        <div className="mb-5 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-[13px] font-semibold text-white">New strategy</div>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-white/50 hover:text-white/80"
              aria-label="Cancel"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            <FormField label="Market">
              <select
                value={form.market}
                onChange={(e) => setForm({ ...form, market: e.target.value })}
                className={inputClass}
              >
                {MARKETS.map((m) => (
                  <option key={m} value={m} className="bg-neutral-900">{m}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Asset">
              <select
                value={form.assetClass}
                onChange={(e) =>
                  setForm({ ...form, assetClass: e.target.value as (typeof ASSET_CLASSES)[number] })
                }
                className={inputClass}
              >
                {ASSET_CLASSES.map((a) => (
                  <option key={a} value={a} className="bg-neutral-900">
                    {a.toUpperCase()}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Symbol">
              <input
                type="text"
                value={form.symbol}
                onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
                placeholder="AAPL"
                className={`${inputClass} uppercase`}
              />
            </FormField>
            <FormField label="Direction">
              <select
                value={form.direction}
                onChange={(e) => setForm({ ...form, direction: e.target.value as "long" | "short" })}
                className={inputClass}
              >
                {DIRECTIONS.map((d) => (
                  <option key={d} value={d} className="bg-neutral-900">{d}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Timeframe">
              <input
                type="text"
                value={form.primaryTimeframe}
                onChange={(e) => setForm({ ...form, primaryTimeframe: e.target.value })}
                placeholder="daily / 4h / 1h"
                className={inputClass}
              />
            </FormField>
            <FormField label="R:R (optional)">
              <input
                type="number"
                step="0.1"
                value={form.riskReward}
                onChange={(e) => setForm({ ...form, riskReward: e.target.value })}
                placeholder="2.5"
                className={inputClass}
              />
            </FormField>
            <FormField label="Confidence (0-100)">
              <input
                type="number"
                min="0"
                max="100"
                value={form.confidenceScore}
                onChange={(e) => setForm({ ...form, confidenceScore: e.target.value })}
                className={inputClass}
              />
            </FormField>
          </div>

          <div className="mt-3">
            <FormField label="Why this trade? (thesis)">
              <textarea
                rows={2}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Trend continuation off support after sweep of prior low."
                className={textareaClass}
              />
            </FormField>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <FormField label="Market structure">
              <textarea
                rows={2}
                value={form.marketStructure}
                onChange={(e) => setForm({ ...form, marketStructure: e.target.value })}
                placeholder="Higher highs, higher lows on the 4h. Pullback into demand."
                className={textareaClass}
              />
            </FormField>
            <FormField label="Liquidity analysis">
              <textarea
                rows={2}
                value={form.liquidityAnalysis}
                onChange={(e) => setForm({ ...form, liquidityAnalysis: e.target.value })}
                placeholder="Resting stops below yesterday's low were swept during the Asia session."
                className={textareaClass}
              />
            </FormField>
            <FormField label="Entry plan">
              <textarea
                rows={2}
                value={form.entryPlan}
                onChange={(e) => setForm({ ...form, entryPlan: e.target.value })}
                placeholder="Limit at 100.50 after confirmation candle on the 1h."
                className={textareaClass}
              />
            </FormField>
            <FormField label="Stop plan">
              <textarea
                rows={2}
                value={form.stopPlan}
                onChange={(e) => setForm({ ...form, stopPlan: e.target.value })}
                placeholder="Below 99.00 (the sweep low) — invalidates the structure."
                className={textareaClass}
              />
            </FormField>
            <FormField label="Target plan">
              <textarea
                rows={2}
                value={form.targetPlan}
                onChange={(e) => setForm({ ...form, targetPlan: e.target.value })}
                placeholder="Prior swing high at 103.00. Scale 50% at 102, trail the rest."
                className={textareaClass}
              />
            </FormField>
            <FormField label="Invalidation (one per line)">
              <textarea
                rows={2}
                value={form.invalidationConditions}
                onChange={(e) =>
                  setForm({ ...form, invalidationConditions: e.target.value })
                }
                placeholder={"Break below 99\nDaily close below the 20 EMA\nGap down > 2%"}
                className={textareaClass}
              />
            </FormField>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/70 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting}
              className="rounded-lg bg-cyan-400 text-black font-medium px-3.5 py-1.5 text-[13px] hover:bg-cyan-300 disabled:opacity-50 transition-colors"
            >
              {submitting ? "Saving…" : "Save strategy"}
            </button>
          </div>
        </div>
      )}

      {active.length === 0 ? (
        <EmptyBox>No strategies yet. Tap New strategy to build one.</EmptyBox>
      ) : (
        <div className="space-y-2">
          {active.map((t) => {
            const verdict = friendlyVerdict(t.governanceDecision);
            return (
              <div
                key={t.id}
                className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-semibold text-white">
                        {t.symbol}
                      </span>
                      <span
                        className={`text-[10.5px] uppercase tracking-[0.06em] rounded-full px-2 py-0.5 ${
                          t.direction === "long"
                            ? "bg-emerald-400/15 text-emerald-300"
                            : "bg-red-400/15 text-red-300"
                        }`}
                      >
                        {t.direction}
                      </span>
                      <span
                        className={`text-[10.5px] uppercase tracking-[0.06em] rounded-full px-2 py-0.5 ${verdict.cls}`}
                      >
                        {verdict.label}
                      </span>
                      {t.primaryTimeframe && (
                        <span className="text-[11px] text-white/50">· {t.primaryTimeframe}</span>
                      )}
                      {t.riskReward && (
                        <span className="text-[11px] text-white/50">
                          · {t.riskReward.toFixed(1)}R
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 text-[12px] text-white/60 max-w-[80ch] leading-snug">
                      {t.reason.slice(0, 200)}
                      {t.reason.length > 200 ? "…" : ""}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </StageShell>
  );
}
