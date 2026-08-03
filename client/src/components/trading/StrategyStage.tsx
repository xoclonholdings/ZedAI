import { useCallback, useEffect, useState } from "react";
import { Archive, ChevronDown, ChevronUp, Pencil, Plus, Sparkles, X } from "lucide-react";

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
  const [generating, setGenerating] = useState<boolean>(false);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/trading/theses", { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Could not load strategies (HTTP ${res.status})`);
      }
      const data = await res.json();
      setTheses(
        [...(data.theses || [])].sort((a: TradeThesis, b: TradeThesis) =>
          a.createdAt < b.createdAt ? 1 : -1,
        ),
      );
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
    const payload = {
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
    };
    try {
      // Editing an existing strategy is a versioned revision (PATCH);
      // a new one is a create (POST) that auto-runs governance.
      const res = await fetch(
        editingId ? `/api/trading/theses/${editingId}` : "/api/trading/theses",
        {
          method: editingId ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setForm(EMPTY_FORM);
      setShowForm(false);
      setNotice(
        editingId
          ? "Strategy updated. Re-run its governance review in the Validation stage."
          : "Strategy saved. ZAR auto-ran a governance review — verdict is on the row.",
      );
      setEditingId(null);
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Could not save strategy.");
    } finally {
      setSubmitting(false);
    }
  }, [form, editingId, refresh]);

  const generate = useCallback(async () => {
    setError(null);
    setNotice(null);
    const symbol = form.symbol.trim().toUpperCase();
    if (!symbol) {
      setError("Enter a symbol first, then let ZAR generate the strategy.");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/trading/strategies/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          asset: form.assetClass,
          market: form.market,
          directionPreference:
            form.direction === "long" || form.direction === "short" ? form.direction : "auto",
          timeframe: form.primaryTimeframe.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      // Populate every field — the user can still edit anything before saving.
      setForm({
        market: body.market ?? form.market,
        assetClass: body.asset ?? form.assetClass,
        symbol: (body.symbol ?? symbol).toUpperCase(),
        direction: body.direction === "short" ? "short" : "long",
        primaryTimeframe: body.timeframe ?? form.primaryTimeframe,
        reason: body.thesis ?? "",
        marketStructure: body.marketStructure ?? "",
        liquidityAnalysis: body.liquidityAnalysis ?? "",
        entryPlan: body.entryPlan ?? "",
        stopPlan: body.stopPlan ?? "",
        targetPlan: body.targetPlan ?? "",
        riskReward:
          typeof body.riskReward === "number" ? String(body.riskReward) : form.riskReward,
        invalidationConditions: body.invalidation ?? "",
        confidenceScore:
          typeof body.confidence === "number" ? String(body.confidence) : form.confidenceScore,
      });
      setNotice(
        body.basis ||
          "ZAR drafted this strategy. Review and edit every field before saving — nothing is saved automatically.",
      );
    } catch (err: any) {
      setError(err?.message || "ZAR could not generate a strategy. Try again.");
    } finally {
      setGenerating(false);
    }
  }, [form]);

  const startNew = useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
    setNotice(null);
    setShowForm(true);
  }, []);

  const startEdit = useCallback((t: TradeThesis) => {
    setEditingId(t.id);
    setForm({
      market: t.market || "US",
      assetClass: (t.assetClass as (typeof ASSET_CLASSES)[number]) || "stock",
      symbol: t.symbol || "",
      direction: t.direction === "short" ? "short" : "long",
      primaryTimeframe: t.primaryTimeframe || "",
      reason: t.reason || "",
      marketStructure: t.marketStructure || "",
      liquidityAnalysis: t.liquidityAnalysis || "",
      entryPlan: t.entryPlan || "",
      stopPlan: t.stopPlan || "",
      targetPlan: t.targetPlan || "",
      riskReward: t.riskReward != null ? String(t.riskReward) : "",
      invalidationConditions: (t.invalidationConditions || []).join("\n"),
      confidenceScore: String(t.confidenceScore ?? 60),
    });
    setError(null);
    setNotice(null);
    setShowForm(true);
  }, []);

  const cancelForm = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }, []);

  const archive = useCallback(
    async (id: string) => {
      setError(null);
      setNotice(null);
      setArchivingId(id);
      try {
        const res = await fetch(`/api/trading/theses/${id}/archive`, {
          method: "POST",
          credentials: "include",
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        setNotice("Strategy archived.");
        if (editingId === id) cancelForm();
        await refresh();
      } catch (err: any) {
        setError(err?.message || "Could not archive strategy.");
      } finally {
        setArchivingId(null);
      }
    },
    [editingId, cancelForm, refresh],
  );

  const active = theses.filter((t) => !t.archivedAt);

  return (
    <StageShell
      eyebrow="Strategy"
      title="Your trading strategies"
      description="Every strategy captures market structure, liquidity, entry / stop / target plans, and invalidation. Once saved, ZAR runs a governance review automatically — you'll see the verdict on the row."
      onRefresh={() => void refresh()}
      refreshing={loading}
      action={
        <button
          type="button"
          onClick={() => (showForm ? cancelForm() : startNew())}
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
            <div className="text-[13px] font-semibold text-white">
              {editingId ? "Edit strategy" : "New strategy"}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void generate()}
                disabled={generating}
                title="Let ZAR draft this strategy from its learned framework"
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-[12px] font-medium text-cyan-200 hover:bg-cyan-400/20 disabled:opacity-50 transition-colors"
              >
                <Sparkles size={13} />
                {generating ? "Generating…" : "Generate strategy"}
              </button>
              <button
                type="button"
                onClick={cancelForm}
                className="text-white/50 hover:text-white/80"
                aria-label="Cancel"
              >
                <X size={16} />
              </button>
            </div>
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
              onClick={cancelForm}
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
              {submitting ? "Saving…" : editingId ? "Save changes" : "Save strategy"}
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
            const expanded = expandedId === t.id;
            return (
              <div
                key={t.id}
                className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : t.id)}
                    className="min-w-0 text-left flex-1"
                  >
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
                      <span className="text-[11px] text-white/40">
                        · conf {t.confidenceScore}
                      </span>
                    </div>
                    {!expanded && (
                      <div className="mt-1.5 text-[12px] text-white/60 max-w-[80ch] leading-snug">
                        {t.reason.slice(0, 200)}
                        {t.reason.length > 200 ? "…" : ""}
                      </div>
                    )}
                  </button>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : t.id)}
                      className="rounded-lg border border-white/10 bg-white/[0.04] p-1.5 text-white/50 hover:text-white/90 transition-colors"
                      aria-label={expanded ? "Collapse" : "Expand"}
                    >
                      {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(t)}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[11.5px] text-white/70 hover:text-white transition-colors"
                    >
                      <Pencil size={12} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void archive(t.id)}
                      disabled={archivingId === t.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[11.5px] text-white/50 hover:text-red-300 disabled:opacity-50 transition-colors"
                    >
                      <Archive size={12} /> {archivingId === t.id ? "…" : "Archive"}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-2 border-t border-white/[0.06] pt-3">
                    <DetailField label="Why this trade? (thesis)" value={t.reason} full />
                    <DetailField label="Market structure" value={t.marketStructure} />
                    <DetailField label="Liquidity analysis" value={t.liquidityAnalysis} />
                    <DetailField label="Entry plan" value={t.entryPlan} />
                    <DetailField label="Stop plan" value={t.stopPlan} />
                    <DetailField label="Target plan" value={t.targetPlan} />
                    <DetailField
                      label="Invalidation"
                      value={(t.invalidationConditions || []).join("\n")}
                      full
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </StageShell>
  );
}

function DetailField({
  label,
  value,
  full,
}: {
  label: string;
  value?: string;
  full?: boolean;
}) {
  if (!value || !value.trim()) return null;
  return (
    <div className={full ? "sm:col-span-2" : undefined}>
      <div className="text-[10.5px] uppercase tracking-[0.08em] text-white/40 mb-0.5">
        {label}
      </div>
      <div className="text-[12px] text-white/70 leading-snug whitespace-pre-line">
        {value}
      </div>
    </div>
  );
}
