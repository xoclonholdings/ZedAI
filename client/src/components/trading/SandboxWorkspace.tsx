import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, X } from "lucide-react";

import type { PaperTrade, TradingPerformanceReport } from "@shared/trading-types";

/**
 * The Sandbox stage workspace — the paper-trading workflow.
 *
 * This is the one working Trading stage today. It shows:
 *   - A compact performance strip (win rate, expectancy, R:R, P&L)
 *   - Open paper trades with a Close button
 *   - A "Log a new paper trade" call-to-action that opens the form
 *   - Recent closed trades with outcome badges
 *
 * The form authorizes through the governance layer server-side, so a
 * trade that violates the user's rules gets rejected before it's
 * stored. Errors from that layer surface inline (not silently dropped).
 */

type Panel = "list" | "log" | "close";

interface CloseTarget {
  trade: PaperTrade;
  exitPrice: string;
  exitReason: string;
  lessons: string;
}

const EMPTY_LOG_FORM = {
  symbol: "",
  direction: "long" as "long" | "short",
  market: "US",
  assetClass: "stock" as PaperTrade["assetClass"],
  timeframe: "",
  setupName: "",
  entry: "",
  stop: "",
  target: "",
  size: "1",
  riskAmount: "",
  entryReason: "",
  // Filled by Zed's proposal so governance can link the thesis + context.
  thesisId: "",
  session: "",
  referencePrice: "",
};

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function money(v?: number): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}

function pct(v?: number): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return "—";
  return `${Math.round(v * 100)}%`;
}

function rr(v?: number | null): string {
  if (!v || !Number.isFinite(v)) return "—";
  return `${v.toFixed(2)}R`;
}

export default function SandboxWorkspace() {
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [performance, setPerformance] = useState<TradingPerformanceReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("list");
  const [logForm, setLogForm] = useState(EMPTY_LOG_FORM);
  const [closeTarget, setCloseTarget] = useState<CloseTarget | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [suggesting, setSuggesting] = useState<boolean>(false);
  const [dataStatus, setDataStatus] = useState<{
    live: boolean;
    source: string | null;
    note: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/trading/market-data/status", { credentials: "include" });
        if (res.ok && !cancelled) {
          const s = await res.json();
          setDataStatus({ live: !!s.live, source: s.source, note: s.note });
        }
      } catch {
        /* leave unknown */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tradesRes, perfRes] = await Promise.all([
        fetch("/api/trading/paper-trades", { credentials: "include" }),
        fetch("/api/trading/performance", { credentials: "include" }),
      ]);
      if (tradesRes.ok) {
        const data = await tradesRes.json();
        setTrades(data.trades || []);
      }
      if (perfRes.ok) {
        const data = await perfRes.json();
        setPerformance(data.report || null);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load trades");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openTrades = useMemo(() => trades.filter((t) => t.status === "open"), [trades]);
  const closedTrades = useMemo(
    () => trades.filter((t) => t.status === "closed").slice(0, 10),
    [trades],
  );

  const submitLog = useCallback(async () => {
    setError(null);
    setNotice(null);
    if (!logForm.symbol.trim() || !logForm.entryReason.trim()) {
      setError("Symbol and thesis are required.");
      return;
    }
    if (!logForm.entry || !logForm.stop || !logForm.target) {
      setError("Entry, stop, and target are all required.");
      return;
    }
    const entry = num(logForm.entry);
    const stop = num(logForm.stop);
    const risk = num(logForm.riskAmount) || Math.abs(entry - stop) * num(logForm.size);

    setSubmitting(true);
    try {
      const res = await fetch("/api/trading/paper-trades", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: logForm.symbol.trim().toUpperCase(),
          direction: logForm.direction,
          market: logForm.market,
          assetClass: logForm.assetClass,
          timeframe: logForm.timeframe.trim() || undefined,
          setupName: logForm.setupName.trim() || undefined,
          entry,
          stop,
          target: num(logForm.target),
          size: num(logForm.size) || 1,
          riskAmount: risk,
          entryReason: logForm.entryReason.trim(),
          thesisId: logForm.thesisId || undefined,
          session: logForm.session || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = body?.authorization?.reason || body?.error || `HTTP ${res.status}`;
        throw new Error(detail);
      }
      setLogForm(EMPTY_LOG_FORM);
      setPanel("list");
      setNotice(`Paper trade logged: ${body.trade?.symbol} ${body.trade?.direction}.`);
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Could not log the trade.");
    } finally {
      setSubmitting(false);
    }
  }, [logForm, refresh]);

  // Zed proposes the COMPLETE trade for the symbol you name — direction,
  // thesis, market structure, liquidity read, and the concrete
  // entry/stop/target/size/risk numbers, all sized to clear governance.
  // It also links a persisted thesis so nothing comes back UNKNOWN. You
  // just approve. Levels anchor to the reference price if you gave one,
  // otherwise a labelled paper reference (no live feed wired in yet).
  const suggest = useCallback(async () => {
    setError(null);
    setNotice(null);
    if (!logForm.symbol.trim()) {
      setError("Enter a symbol first — Zed will build the whole trade for it.");
      return;
    }
    setSuggesting(true);
    try {
      const res = await fetch("/api/trading/strategies/propose", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: logForm.symbol.trim().toUpperCase(),
          asset: logForm.assetClass,
          market: logForm.market,
          timeframe: logForm.timeframe.trim() || undefined,
          directionPreference: "auto",
          referencePrice: logForm.referencePrice ? num(logForm.referencePrice) : undefined,
        }),
      });
      const s = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(s?.error || `HTTP ${res.status}`);
      const reason = [
        s.thesis,
        s.entryPlan ? `Entry: ${s.entryPlan}` : "",
        s.stopPlan ? `Stop: ${s.stopPlan}` : "",
        s.targetPlan ? `Target: ${s.targetPlan}` : "",
        s.invalidation ? `Invalidation: ${String(s.invalidation).replace(/\n/g, "; ")}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      setLogForm((f) => ({
        ...f,
        direction: s.direction === "short" ? "short" : "long",
        timeframe: s.timeframe || f.timeframe,
        setupName: "Zed proposal",
        entry: s.entry != null ? String(s.entry) : f.entry,
        stop: s.stop != null ? String(s.stop) : f.stop,
        target: s.target != null ? String(s.target) : f.target,
        size: s.size != null ? String(s.size) : f.size,
        riskAmount: s.riskAmount != null ? String(s.riskAmount) : f.riskAmount,
        entryReason: reason || f.entryReason,
        thesisId: s.thesisId || "",
        session: s.session || "",
      }));
      const md = s.marketData;
      if (md?.live) {
        const when = md.asOf ? new Date(md.asOf).toLocaleString() : "just now";
        setNotice(
          `Zed built the full trade on LIVE data — ${md.source} $${md.price} (as of ${when}). Review and tap Approve & log.`,
        );
      } else if (s.pricedFromReference) {
        setNotice("Zed built the full trade at your reference price. Review and tap Approve & log.");
      } else {
        setNotice(
          "No live feed was reachable, so Zed used a paper reference price. Enter a reference price above for real levels, or tap Approve & log.",
        );
      }
    } catch (err: any) {
      setError(err?.message || "Zed could not build the trade. Try again.");
    } finally {
      setSuggesting(false);
    }
  }, [
    logForm.symbol,
    logForm.assetClass,
    logForm.market,
    logForm.timeframe,
    logForm.referencePrice,
  ]);

  const submitClose = useCallback(async () => {
    if (!closeTarget) return;
    setError(null);
    if (!closeTarget.exitPrice.trim()) {
      setError("Exit price is required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/trading/paper-trades/${closeTarget.trade.id}/close`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exitPrice: num(closeTarget.exitPrice),
          exitReason: closeTarget.exitReason.trim() || undefined,
          lessonsLearned: closeTarget.lessons
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      setCloseTarget(null);
      setNotice(`Trade closed. Journaled to your review.`);
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Could not close the trade.");
    } finally {
      setSubmitting(false);
    }
  }, [closeTarget, refresh]);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5">
      <header className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-400/80 mb-1">
            Sandbox
          </div>
          <h2 className="text-[17px] font-semibold text-white tracking-[-0.01em]">
            Paper trading
          </h2>
          <p className="mt-1 text-[12.5px] text-white/50 max-w-full sm:max-w-[62ch] leading-snug">
            Name a symbol and Zed builds the whole trade — direction, thesis, structure,
            and the entry / stop / target / size / risk, sized to pass governance. You just
            approve. Nothing here is real money — Zed is proving the strategy.
          </p>
          {dataStatus && (
            <div
              title={dataStatus.note}
              className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                dataStatus.live
                  ? "bg-emerald-400/15 text-emerald-300"
                  : "bg-amber-400/15 text-amber-300"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  dataStatus.live ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
              {dataStatus.live
                ? `Live market data · ${dataStatus.source}`
                : "No live feed — using paper reference"}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-white/60 hover:text-white/90 hover:bg-white/[0.08] transition-colors"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setPanel(panel === "log" ? "list" : "log")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 text-black font-medium px-3 py-1.5 text-[13px] hover:bg-cyan-300 transition-colors active:opacity-80"
          >
            <Plus size={13} />
            {panel === "log" ? "Cancel" : "New trade"}
          </button>
        </div>
      </header>

      {notice && (
        <div className="mb-4 rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-3 py-2 text-[12.5px] text-emerald-200">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-400/30 bg-red-400/5 px-3 py-2 text-[12.5px] text-red-200">
          {error}
        </div>
      )}

      {performance && (
        <div className="mb-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <PerfPill label="Total trades" value={String(performance.totalTrades)} />
          <PerfPill label="Win rate" value={pct(performance.winRate)} />
          <PerfPill label="Expectancy" value={money(performance.expectancy)} />
          <PerfPill label="Avg R:R" value={rr(performance.averageRewardRisk)} />
        </div>
      )}

      {panel === "log" && (
        <LogTradeForm
          form={logForm}
          onChange={setLogForm}
          onSubmit={submitLog}
          submitting={submitting}
          onSuggest={suggest}
          suggesting={suggesting}
          onCancel={() => setPanel("list")}
        />
      )}

      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">
        Open trades ({openTrades.length})
      </div>
      {openTrades.length === 0 ? (
        <div className="mb-5 rounded-lg border border-dashed border-white/10 p-5 text-center text-[12.5px] text-white/40">
          No open trades yet. Tap New trade and let Zed propose one.
        </div>
      ) : (
        <div className="mb-5 space-y-2">
          {openTrades.map((t) => (
            <TradeCard
              key={t.id}
              trade={t}
              onClose={() =>
                setCloseTarget({
                  trade: t,
                  exitPrice: "",
                  exitReason: "",
                  lessons: "",
                })
              }
            />
          ))}
        </div>
      )}

      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">
        Recent closed ({closedTrades.length})
      </div>
      {closedTrades.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 p-5 text-center text-[12.5px] text-white/40">
          Nothing closed yet.
        </div>
      ) : (
        <div className="space-y-2">
          {closedTrades.map((t) => (
            <ClosedTradeRow key={t.id} trade={t} />
          ))}
        </div>
      )}

      {closeTarget && (
        <CloseDialog
          target={closeTarget}
          onChange={setCloseTarget}
          onSubmit={submitClose}
          submitting={submitting}
          onCancel={() => setCloseTarget(null)}
        />
      )}
    </section>
  );
}

function PerfPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.08em] text-white/40">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold text-white tabular-nums">{value}</div>
    </div>
  );
}

function TradeCard({ trade, onClose }: { trade: PaperTrade; onClose: () => void }) {
  const rrPlanned = Math.abs(trade.target - trade.entry) / Math.max(Math.abs(trade.entry - trade.stop), 0.000001);
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14.5px] font-semibold text-white">{trade.symbol}</span>
            <span
              className={`text-[10.5px] uppercase tracking-[0.06em] rounded-full px-2 py-0.5 ${
                trade.direction === "long"
                  ? "bg-emerald-400/15 text-emerald-300"
                  : "bg-red-400/15 text-red-300"
              }`}
            >
              {trade.direction}
            </span>
            {trade.setupName && (
              <span className="text-[11px] text-white/50">· {trade.setupName}</span>
            )}
          </div>
          <div className="mt-1 text-[11.5px] text-white/60 leading-snug">
            Entry ${trade.entry} · Stop ${trade.stop} · Target ${trade.target} · {rrPlanned.toFixed(2)}R planned
          </div>
          {trade.entryReason && (
            <div className="mt-1.5 text-[11.5px] text-white/50 italic max-w-[62ch]">
              "{trade.entryReason.slice(0, 200)}"
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg bg-cyan-400 text-black font-medium px-3 py-1.5 text-[12.5px] hover:bg-cyan-300 transition-colors active:opacity-80"
        >
          Close trade
        </button>
      </div>
    </div>
  );
}

function ClosedTradeRow({ trade }: { trade: PaperTrade }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
      <div className="min-w-0 flex items-center gap-2 flex-wrap">
        <span className="text-[13.5px] font-medium text-white">{trade.symbol}</span>
        <span
          className={`text-[10px] uppercase tracking-[0.06em] rounded-full px-2 py-0.5 ${
            trade.direction === "long"
              ? "bg-emerald-400/10 text-emerald-300/80"
              : "bg-red-400/10 text-red-300/80"
          }`}
        >
          {trade.direction}
        </span>
        {trade.outcome && (
          <span
            className={`text-[10px] uppercase tracking-[0.06em] rounded-full px-2 py-0.5 ${
              trade.outcome === "win"
                ? "bg-emerald-400/15 text-emerald-300"
                : trade.outcome === "loss"
                  ? "bg-red-400/15 text-red-300"
                  : "bg-white/10 text-white/60"
            }`}
          >
            {trade.outcome}
          </span>
        )}
        <span className="text-[11.5px] text-white/50">
          in ${trade.entry} → out ${trade.exitPrice}
        </span>
      </div>
      <span
        className={`text-[13px] font-semibold tabular-nums ${
          (trade.realizedPnl || 0) > 0
            ? "text-emerald-300"
            : (trade.realizedPnl || 0) < 0
              ? "text-red-300"
              : "text-white/60"
        }`}
      >
        {money(trade.realizedPnl)}
      </span>
    </div>
  );
}

function LogTradeForm({
  form,
  onChange,
  onSubmit,
  submitting,
  onSuggest,
  suggesting,
  onCancel,
}: {
  form: typeof EMPTY_LOG_FORM;
  onChange: (next: typeof EMPTY_LOG_FORM) => void;
  onSubmit: () => void | Promise<void>;
  submitting: boolean;
  onSuggest: () => void | Promise<void>;
  suggesting: boolean;
  onCancel: () => void;
}) {
  const set =
    <K extends keyof typeof EMPTY_LOG_FORM>(key: K) =>
    (v: (typeof EMPTY_LOG_FORM)[K]) =>
      onChange({ ...form, [key]: v });

  return (
    <div className="mb-5 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-[13px] font-semibold text-white">New paper trade — Zed proposes, you approve</div>
        <button
          type="button"
          onClick={onCancel}
          className="text-white/50 hover:text-white/80"
          aria-label="Cancel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Zed builds the whole trade for the symbol you name. */}
      <div className="mb-4 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.04] px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[12px] text-cyan-100/90 max-w-[46ch] leading-snug">
            Enter a symbol and Zed fills in everything — direction, thesis, structure,
            and the entry / stop / target / size / risk. You just approve.
          </div>
          <button
            type="button"
            onClick={() => void onSuggest()}
            disabled={suggesting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 text-black font-medium px-3 py-1.5 text-[12.5px] hover:bg-cyan-300 disabled:opacity-50 transition-colors"
          >
            {suggesting ? "Zed is building…" : "Zed, build this trade"}
          </button>
        </div>
        <label className="mt-2 flex items-center gap-2">
          <span className="text-[10.5px] uppercase tracking-[0.08em] text-cyan-100/60 whitespace-nowrap">
            Reference price (optional)
          </span>
          <input
            type="number"
            step="0.01"
            value={form.referencePrice}
            onChange={(e) => set("referencePrice")(e.target.value)}
            placeholder="live quote — leave blank for a paper reference"
            className="min-w-0 flex-1 text-[12.5px] text-white bg-black/30 border border-white/10 rounded-lg px-2.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 tabular-nums placeholder:text-white/25"
          />
        </label>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <FormField label="Symbol">
          <input
            type="text"
            value={form.symbol}
            onChange={(e) =>
              onChange({ ...form, symbol: e.target.value.toUpperCase(), thesisId: "" })
            }
            placeholder="AAPL"
            className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 uppercase"
          />
        </FormField>
        <FormField label="Direction">
          <select
            value={form.direction}
            onChange={(e) => set("direction")(e.target.value as "long" | "short")}
            className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
          >
            <option value="long" className="bg-neutral-900">Long</option>
            <option value="short" className="bg-neutral-900">Short</option>
          </select>
        </FormField>
        <FormField label="Setup (optional)">
          <input
            type="text"
            value={form.setupName}
            onChange={(e) => set("setupName")(e.target.value)}
            placeholder="Breakout / pullback"
            className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
          />
        </FormField>
        <FormField label="Entry">
          <input
            type="number"
            step="0.01"
            value={form.entry}
            onChange={(e) => set("entry")(e.target.value)}
            placeholder="100.50"
            className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 tabular-nums"
          />
        </FormField>
        <FormField label="Stop">
          <input
            type="number"
            step="0.01"
            value={form.stop}
            onChange={(e) => set("stop")(e.target.value)}
            placeholder="99.00"
            className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 tabular-nums"
          />
        </FormField>
        <FormField label="Target">
          <input
            type="number"
            step="0.01"
            value={form.target}
            onChange={(e) => set("target")(e.target.value)}
            placeholder="103.00"
            className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 tabular-nums"
          />
        </FormField>
        <FormField label="Size (shares)">
          <input
            type="number"
            step="1"
            value={form.size}
            onChange={(e) => set("size")(e.target.value)}
            placeholder="100"
            className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 tabular-nums"
          />
        </FormField>
        <FormField label="Risk ($, auto)">
          <input
            type="number"
            step="0.01"
            value={form.riskAmount}
            onChange={(e) => set("riskAmount")(e.target.value)}
            placeholder="150"
            className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 tabular-nums"
          />
        </FormField>
        <FormField label="Timeframe">
          <input
            type="text"
            value={form.timeframe}
            onChange={(e) => set("timeframe")(e.target.value)}
            placeholder="daily / 4h / 1h"
            className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
          />
        </FormField>
      </div>

      <div className="mt-3">
        <div className="text-[11.5px] uppercase tracking-[0.08em] text-white/50 mb-1">
          Why are you taking this trade? (thesis)
        </div>
        <textarea
          value={form.entryReason}
          onChange={(e) => set("entryReason")(e.target.value)}
          rows={3}
          placeholder="Trend continuation off the 20 EMA. Bought after intraday consolidation, tight risk, expected move to prior swing high."
          className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 leading-snug resize-y placeholder:text-white/30"
        />
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/70 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void onSubmit()}
          disabled={submitting}
          className="rounded-lg bg-cyan-400 text-black font-medium px-3.5 py-1.5 text-[13px] hover:bg-cyan-300 disabled:opacity-50 transition-colors active:opacity-80"
        >
          {submitting ? "Logging…" : "Approve & log"}
        </button>
      </div>
    </div>
  );
}

function CloseDialog({
  target,
  onChange,
  onSubmit,
  submitting,
  onCancel,
}: {
  target: CloseTarget;
  onChange: (next: CloseTarget) => void;
  onSubmit: () => void | Promise<void>;
  submitting: boolean;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-950 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.08em] text-white/40">
              Close paper trade
            </div>
            <div className="text-[15.5px] font-semibold text-white mt-0.5">
              {target.trade.symbol} · {target.trade.direction}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-white/50 hover:text-white/80"
            aria-label="Cancel"
          >
            <X size={16} />
          </button>
        </div>
        <div className="text-[11.5px] text-white/50 mb-3">
          Entry ${target.trade.entry} · Stop ${target.trade.stop} · Target ${target.trade.target}
        </div>

        <FormField label="Exit price">
          <input
            type="number"
            step="0.01"
            autoFocus
            value={target.exitPrice}
            onChange={(e) => onChange({ ...target, exitPrice: e.target.value })}
            className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 tabular-nums"
          />
        </FormField>
        <div className="mt-3">
          <FormField label="Why did you exit? (optional)">
            <input
              type="text"
              value={target.exitReason}
              onChange={(e) => onChange({ ...target, exitReason: e.target.value })}
              placeholder="Hit target / stop / manual close"
              className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            />
          </FormField>
        </div>
        <div className="mt-3">
          <div className="text-[11.5px] uppercase tracking-[0.08em] text-white/50 mb-1">
            One lesson from this trade
          </div>
          <textarea
            value={target.lessons}
            onChange={(e) => onChange({ ...target, lessons: e.target.value })}
            rows={2}
            placeholder="Held through the noise; scaled out too early; risk was right-sized."
            className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 leading-snug resize-y placeholder:text-white/30"
          />
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/70 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={submitting}
            className="rounded-lg bg-cyan-400 text-black font-medium px-3.5 py-1.5 text-[13px] hover:bg-cyan-300 disabled:opacity-50 transition-colors active:opacity-80"
          >
            {submitting ? "Closing…" : "Close trade"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-[0.08em] text-white/50 mb-1">{label}</div>
      {children}
    </label>
  );
}
