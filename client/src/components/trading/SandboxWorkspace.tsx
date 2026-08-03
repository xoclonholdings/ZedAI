import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, ShieldCheck, SlidersHorizontal, X } from "lucide-react";

import { zarErrorMessage } from "@shared/error-contract";
import type {
  PaperTrade,
  PaperTradingGovernanceCheckSetting,
  PaperTradingGovernanceSettings,
  PaperTradingGovernanceMode,
  TradingPerformanceReport,
} from "@shared/trading-types";
import type { TradingSignal, BacktestReport } from "@shared/trading-training-types";

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
type PaperGovernancePatch = {
  mode?: PaperTradingGovernanceMode;
  checks?: Record<string, PaperTradingGovernanceCheckSetting>;
  thresholds?: Partial<PaperTradingGovernanceSettings["thresholds"]>;
};

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
  managementStyle: "bracket" as NonNullable<PaperTrade["managementStyle"]>,
  entryReason: "",
  // Filled by ZAR's proposal so governance can link the thesis + context.
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

function responseError(body: any, fallback: string): string {
  return zarErrorMessage(body?.errorDetail, body?.error || fallback);
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
  const [resolving, setResolving] = useState<boolean>(false);
  const [signal, setSignal] = useState<TradingSignal | null>(null);
  const [lookupSymbol, setLookupSymbol] = useState<string>("");
  const [lookupResult, setLookupResult] = useState<
    { symbol: string; price: number; source: string; signal: TradingSignal | null } | null
  >(null);
  const [lookingUp, setLookingUp] = useState<boolean>(false);
  const [backtest, setBacktest] = useState<BacktestReport | null>(null);
  const [backtesting, setBacktesting] = useState<boolean>(false);
  const [toolsOpen, setToolsOpen] = useState<boolean>(false);
  const [governanceOpen, setGovernanceOpen] = useState<boolean>(false);

  const runBacktest = useCallback(async () => {
    const sym = lookupSymbol.trim().toUpperCase();
    if (!sym) return;
    setBacktesting(true);
    setBacktest(null);
    setError(null);
    try {
      const res = await fetch("/api/trading/backtest", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: sym }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(responseError(body, `HTTP ${res.status}`));
      setBacktest(body.report);
    } catch (err: any) {
      setError(err?.message || "Backtest failed");
    } finally {
      setBacktesting(false);
    }
  }, [lookupSymbol]);

  const checkSignal = useCallback(async () => {
    const sym = lookupSymbol.trim().toUpperCase();
    if (!sym) return;
    setLookingUp(true);
    setLookupResult(null);
    try {
      const res = await fetch(
        `/api/trading/market-data/signal?symbol=${encodeURIComponent(sym)}`,
        { credentials: "include" },
      );
      const body = await res.json().catch(() => ({}));
      if (body.live) {
        setLookupResult({ symbol: sym, price: body.price, source: body.source, signal: body.signal });
      } else {
        setLookupResult({ symbol: sym, price: 0, source: "", signal: null });
      }
    } catch {
      setLookupResult({ symbol: sym, price: 0, source: "", signal: null });
    } finally {
      setLookingUp(false);
    }
  }, [lookupSymbol]);
  const [dataStatus, setDataStatus] = useState<{
    live: boolean;
    source: string | null;
    note: string;
  } | null>(null);
  const [storage, setStorage] = useState<{ durable: boolean; note: string } | null>(null);
  const [governanceSettings, setGovernanceSettings] =
    useState<PaperTradingGovernanceSettings | null>(null);
  const [savingGovernance, setSavingGovernance] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [dataRes, storageRes, governanceRes] = await Promise.all([
          fetch("/api/trading/market-data/status", { credentials: "include" }),
          fetch("/api/trading/storage-status", { credentials: "include" }),
          fetch("/api/trading/governance/paper-settings", { credentials: "include" }),
        ]);
        if (dataRes.ok && !cancelled) {
          const s = await dataRes.json();
          setDataStatus({ live: !!s.live, source: s.source, note: s.note });
        }
        if (storageRes.ok && !cancelled) {
          const s = await storageRes.json();
          setStorage({ durable: !!s.durable, note: s.note });
        }
        if (governanceRes.ok && !cancelled) {
          const s = await governanceRes.json();
          setGovernanceSettings(s.settings || null);
        }
      } catch {
        /* leave unknown */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveGovernanceSettings = useCallback(async (patch: PaperGovernancePatch) => {
    setSavingGovernance(true);
    setError(null);
    try {
      const res = await fetch("/api/trading/governance/paper-settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(responseError(body, `HTTP ${res.status}`));
      setGovernanceSettings(body.settings || null);
    } catch (err: any) {
      setError(err?.message || "Could not save paper governance settings.");
    } finally {
      setSavingGovernance(false);
    }
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
      } else {
        const body = await tradesRes.json().catch(() => ({}));
        throw new Error(responseError(body, `Could not load trades (HTTP ${tradesRes.status})`));
      }
      if (perfRes.ok) {
        const data = await perfRes.json();
        setPerformance(data.report || null);
      } else {
        const body = await perfRes.json().catch(() => ({}));
        throw new Error(responseError(body, `Could not load performance (HTTP ${perfRes.status})`));
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

  // Check open trades against live prices; ZAR closes any that hit their
  // target (win) or stop (loss). This is what proves the proposals.
  const resolveVsLive = useCallback(async () => {
    setError(null);
    setNotice(null);
    setResolving(true);
    try {
      const res = await fetch("/api/trading/paper-trades/resolve", {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(responseError(body, `HTTP ${res.status}`));
      setNotice(body.note || "Checked open trades against live prices.");
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Could not check live prices.");
    } finally {
      setResolving(false);
    }
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
          managementStyle: logForm.managementStyle,
          entryReason: logForm.entryReason.trim(),
          thesisId: logForm.thesisId || undefined,
          session: logForm.session || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = responseError(body, body?.authorization?.reason || `HTTP ${res.status}`);
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

  // ZAR proposes the COMPLETE trade for the symbol you name — direction,
  // thesis, market structure, liquidity read, and the concrete
  // entry/stop/target/size/risk numbers, all sized to clear governance.
  // It also links a persisted thesis so nothing comes back UNKNOWN. You
  // just approve. Levels anchor to the reference price if you gave one,
  // otherwise a labelled paper reference (no live feed wired in yet).
  const suggest = useCallback(async () => {
    setError(null);
    setNotice(null);
    setSuggesting(true);
    try {
      // Symbol is optional — leave it blank and ZAR scans live data to
      // pick one itself.
      const res = await fetch("/api/trading/strategies/propose", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: logForm.symbol.trim().toUpperCase() || undefined,
          asset: logForm.assetClass,
          market: logForm.market,
          timeframe: logForm.timeframe.trim() || undefined,
          directionPreference: "auto",
          referencePrice: logForm.referencePrice ? num(logForm.referencePrice) : undefined,
        }),
      });
      const s = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(responseError(s, `HTTP ${res.status}`));
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
        symbol: s.symbol || f.symbol,
        direction: s.direction === "short" ? "short" : "long",
        timeframe: s.timeframe || f.timeframe,
        setupName: s.setupType || "ZAR proposal",
        entry: s.entry != null ? String(s.entry) : f.entry,
        stop: s.stop != null ? String(s.stop) : f.stop,
        target: s.target != null ? String(s.target) : f.target,
        size: s.size != null ? String(s.size) : f.size,
        riskAmount: s.riskAmount != null ? String(s.riskAmount) : f.riskAmount,
        entryReason: reason || f.entryReason,
        thesisId: s.thesisId || "",
        session: s.session || "",
      }));
      setSignal(s.signal || null);
      const picked = s.recommendedSymbol
        ? `ZAR picked ${s.recommendedSymbol.symbol}. `
        : "";
      const md = s.marketData;
      if (md?.live) {
        const when = md.asOf ? new Date(md.asOf).toLocaleString() : "just now";
        setNotice(
          `${picked}Built on LIVE data — ${md.source} $${md.price} (as of ${when}). Review and tap Approve & log.`,
        );
      } else if (s.pricedFromReference) {
        setNotice(`${picked}Built at your reference price. Review and tap Approve & log.`);
      } else {
        setNotice(
          `${picked}No live feed was reachable, so ZAR used a paper reference price. Enter a reference price above for real levels, or tap Approve & log.`,
        );
      }
    } catch (err: any) {
      setError(err?.message || "ZAR could not build the trade. Try again.");
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
        throw new Error(responseError(body, `HTTP ${res.status}`));
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
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-400/80 mb-1">
            Sandbox
          </div>
          <h2 className="text-[17px] font-semibold text-white tracking-[-0.01em]">
            Paper trading
          </h2>
          <p className="mt-1 text-[12.5px] text-white/50 max-w-full sm:max-w-[62ch] leading-snug">
            Build, approve, and track simulated trades. ZAR handles the trade build; paper governance is user controlled.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {dataStatus && (
              <div
                title={dataStatus.note}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
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
            {storage && (
              <div
                title={storage.note}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  storage.durable
                    ? "bg-emerald-400/15 text-emerald-300"
                    : "bg-red-400/15 text-red-300"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    storage.durable ? "bg-emerald-400" : "bg-red-400"
                  }`}
                />
                {storage.durable ? "Saved to your account" : "Not saving — no database"}
              </div>
            )}
            {governanceSettings && (
              <div
                title="Paper-trade governance setting"
                className="inline-flex items-center gap-1.5 rounded-full bg-cyan-400/10 px-2.5 py-1 text-[11px] font-medium text-cyan-200"
              >
                <ShieldCheck size={11} />
                Governance: {governanceSettings.mode}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {governanceSettings && (
            <button
              type="button"
              onClick={() => setGovernanceOpen((value) => !value)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.05] px-3 py-1.5 text-[12.5px] text-cyan-100 hover:bg-cyan-400/[0.1] transition-colors"
            >
              <SlidersHorizontal size={12} />
              Governance
            </button>
          )}
          <button
            type="button"
            onClick={() => void resolveVsLive()}
            disabled={resolving || loading}
            title="Check open trades against live prices and close any that hit target or stop"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/[0.06] px-3 py-1.5 text-[12.5px] text-emerald-200 hover:bg-emerald-400/[0.12] disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={12} className={resolving ? "animate-spin" : ""} />
            {resolving ? "Checking…" : "Check live prices"}
          </button>
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

      {governanceOpen && governanceSettings && (
        <PaperGovernanceControls
          settings={governanceSettings}
          saving={savingGovernance}
          onSave={(patch) => void saveGovernanceSettings(patch)}
        />
      )}

      {/* Signal read + backtest for any symbol — tucked behind a toggle. */}
      <div className="mb-5 rounded-lg border border-white/10 bg-white/[0.02] p-3">
        <button
          type="button"
          onClick={() => setToolsOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-[11px] uppercase tracking-[0.08em] text-white/40 hover:text-white/70"
        >
          <span>Signal &amp; backtest — check any symbol</span>
          <span className="text-white/30">{toolsOpen ? "Hide" : "Open"}</span>
        </button>
        {toolsOpen && (
        <>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <input
            type="text"
            value={lookupSymbol}
            onChange={(e) => setLookupSymbol(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") void checkSignal();
            }}
            placeholder="AAPL"
            className="w-28 text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 uppercase"
          />
          <button
            type="button"
            onClick={() => void checkSignal()}
            disabled={lookingUp || !lookupSymbol.trim()}
            className="rounded-lg bg-cyan-400 text-black font-medium px-3 py-1.5 text-[12.5px] hover:bg-cyan-300 disabled:opacity-50"
          >
            {lookingUp ? "Reading…" : "Read signal"}
          </button>
          <button
            type="button"
            onClick={() => void runBacktest()}
            disabled={backtesting || !lookupSymbol.trim()}
            title="Test ZAR's signal strategy over ~2 years of this symbol's price history"
            className="rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1.5 text-[12.5px] text-white/80 hover:bg-white/[0.1] disabled:opacity-50"
          >
            {backtesting ? "Backtesting…" : "Backtest 2y"}
          </button>
          {lookupResult && (
            <span className="text-[11.5px] text-white/50 truncate">
              {lookupResult.signal
                ? `${lookupResult.symbol} $${lookupResult.price} · ${lookupResult.source}`
                : `No live signal for ${lookupResult.symbol}`}
            </span>
          )}
        </div>
        {lookupResult?.signal && <div className="mt-3"><SignalPanel signal={lookupResult.signal} /></div>}
        {backtest && <BacktestPanel report={backtest} />}
        </>
        )}
      </div>

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
          signal={signal}
          onCancel={() => setPanel("list")}
        />
      )}

      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">
        Open trades ({openTrades.length})
      </div>
      {openTrades.length === 0 ? (
        <div className="mb-5 rounded-lg border border-dashed border-white/10 p-5 text-center text-[12.5px] text-white/40">
          No open trades yet. Tap New trade and let ZAR propose one.
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

function ExecutionBadge({ trade }: { trade: PaperTrade }) {
  if (!trade.executionMode || trade.executionMode === "internal") return null;
  const isLive = trade.executionMode === "live";
  const label = isLive
    ? `LIVE · ${trade.executionProvider || "broker"}`
    : `paper · ${trade.executionProvider || "broker"}`;
  return (
    <span
      title={isLive ? "Executed on the real, funded account" : "Executed on the broker's paper/sandbox account"}
      className={`text-[10.5px] uppercase tracking-[0.06em] rounded-full px-2 py-0.5 ${
        isLive ? "bg-red-500/20 text-red-200" : "bg-amber-400/15 text-amber-200"
      }`}
    >
      {label}
    </span>
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
            <ExecutionBadge trade={trade} />
            {trade.setupName && (
              <span className="text-[11px] text-white/50">· {trade.setupName}</span>
            )}
          </div>
          <div className="mt-1 text-[11.5px] text-white/60 leading-snug">
            Entry ${trade.entry} · Stop ${trade.stop} · Target ${trade.target} · {rrPlanned.toFixed(2)}R planned
          </div>
          <div className="mt-1 text-[10.5px] uppercase tracking-[0.06em] text-white/35">
            ZAR manages: {(trade.managementStyle || "bracket").replace("_", " ")}
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

const EXECUTION_QUALITY_TONE: Record<string, string> = {
  excellent: "bg-emerald-400/15 text-emerald-300",
  good: "bg-cyan-400/15 text-cyan-200",
  needs_work: "bg-amber-400/15 text-amber-200",
  poor: "bg-red-400/15 text-red-300",
};

const RULE_COMPLIANCE_TONE: Record<string, string> = {
  clean: "bg-emerald-400/15 text-emerald-300",
  minor_violations: "bg-amber-400/15 text-amber-200",
  major_violations: "bg-red-400/15 text-red-300",
};

function ClosedTradeRow({ trade }: { trade: PaperTrade }) {
  const [open, setOpen] = useState(false);
  const report = trade.reviewReport;
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <button
        type="button"
        onClick={() => report && setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 flex-wrap text-left"
      >
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
          <ExecutionBadge trade={trade} />
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
        <div className="flex items-center gap-2">
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
          {report && (
            <span className="text-[10.5px] uppercase tracking-[0.06em] text-cyan-300/80">
              {open ? "Hide review" : "Review"}
            </span>
          )}
        </div>
      </button>
      {open && report && (
        <div className="mt-2.5 space-y-2 border-t border-white/[0.06] pt-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[10px] uppercase tracking-[0.06em] rounded-full px-2 py-0.5 ${EXECUTION_QUALITY_TONE[report.executionQuality] || "bg-white/10 text-white/60"}`}>
              Execution: {report.executionQuality.replace("_", " ")}
            </span>
            <span className={`text-[10px] uppercase tracking-[0.06em] rounded-full px-2 py-0.5 ${RULE_COMPLIANCE_TONE[report.ruleCompliance] || "bg-white/10 text-white/60"}`}>
              Rules: {report.ruleCompliance.replace("_", " ")}
            </span>
          </div>
          {report.mistakes.length > 0 && (
            <ReviewList label="Rule violations" items={report.mistakes} />
          )}
          {report.lessonsLearned.length > 0 && (
            <ReviewList label="Lessons learned" items={report.lessonsLearned} />
          )}
          <ReviewList label="Recommended improvements" items={report.recommendedImprovements} />
        </div>
      )}
    </div>
  );
}

function ReviewList({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.06em] text-white/40 mb-1">{label}</div>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-[11.5px] text-white/70 leading-snug pl-3 relative before:absolute before:left-0 before:content-['–']">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

const PAPER_GOVERNANCE_CHECKS = [
  ["market_context", "Market"],
  ["trend_alignment", "Trend"],
  ["market_structure", "Structure"],
  ["liquidity_conditions", "Liquidity"],
  ["session", "Session"],
  ["news_filter", "News"],
  ["trade_thesis", "Thesis"],
  ["entry_rules", "Entry"],
  ["exit_rules", "Exit"],
  ["risk_limits", "Risk"],
  ["position_size", "Size"],
  ["correlation", "Correlation"],
  ["drawdown_limits", "Drawdown"],
  ["system_health", "System"],
  ["risk_reward", "R:R"],
] as const;

function PaperGovernanceControls({
  settings,
  saving,
  onSave,
}: {
  settings: PaperTradingGovernanceSettings;
  saving: boolean;
  onSave: (patch: PaperGovernancePatch) => void;
}) {
  const modeText =
    settings.mode === "off"
      ? "Paper trades log without blocking. Checklist is recorded only."
      : settings.mode === "warn"
        ? "Checklist failures warn but do not block paper trades."
        : "Blocking checklist failures stop paper trades.";

  const setMode = (mode: PaperTradingGovernanceMode) => onSave({ mode });
  const toggleEnabled = (key: string) => {
    const current = settings.checks[key] || { enabled: true, blocking: false };
    onSave({ checks: { [key]: { ...current, enabled: !current.enabled } } });
  };
  const toggleBlocking = (key: string) => {
    const current = settings.checks[key] || { enabled: true, blocking: false };
    onSave({ checks: { [key]: { ...current, blocking: !current.blocking, enabled: true } } });
  };
  const setThreshold = (key: keyof PaperTradingGovernanceSettings["thresholds"], value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    onSave({ thresholds: { [key]: parsed } });
  };

  return (
    <div className="mb-5 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.025] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck size={14} className="text-cyan-300" />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/60">
              Paper governance
            </div>
            <div className="text-[11.5px] text-white/45">{modeText}</div>
          </div>
        </div>
        <div className="inline-flex rounded-lg border border-white/10 bg-black/20 p-0.5">
          {(["enforce", "warn", "off"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setMode(mode)}
              disabled={saving}
              className={`rounded-md px-2.5 py-1 text-[11.5px] font-medium capitalize transition-colors ${
                settings.mode === mode
                  ? "bg-cyan-400 text-black"
                  : "text-white/55 hover:bg-white/[0.06] hover:text-white/80"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ThresholdInput
          label="Max drawdown"
          value={settings.thresholds.maxNegativeDrawdown}
          onChange={(value) => setThreshold("maxNegativeDrawdown", value)}
          disabled={saving}
        />
        <ThresholdInput
          label="Risk limit"
          value={settings.thresholds.maxRiskPerPaperTrade}
          onChange={(value) => setThreshold("maxRiskPerPaperTrade", value)}
          disabled={saving}
        />
        <ThresholdInput
          label="Min R:R"
          value={settings.thresholds.minimumRiskReward}
          onChange={(value) => setThreshold("minimumRiskReward", value)}
          disabled={saving}
        />
        <ThresholdInput
          label="Sample size"
          value={settings.thresholds.requiredSampleSize}
          onChange={(value) => setThreshold("requiredSampleSize", value)}
          disabled={saving}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PAPER_GOVERNANCE_CHECKS.map(([key, label]) => {
          const check = settings.checks[key] || { enabled: true, blocking: false };
          return (
            <div
              key={key}
              className="rounded-md border border-white/[0.08] bg-black/20 px-2 py-1.5"
            >
              <div className="mb-1 text-[10.5px] font-medium text-white/70">{label}</div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleEnabled(key)}
                  disabled={saving}
                  className={`rounded px-2 py-0.5 text-[10.5px] ${
                    check.enabled
                      ? "bg-emerald-400/15 text-emerald-200"
                      : "bg-white/[0.06] text-white/45"
                  }`}
                >
                  {check.enabled ? "On" : "Off"}
                </button>
                <button
                  type="button"
                  onClick={() => toggleBlocking(key)}
                  disabled={saving || settings.mode !== "enforce"}
                  className={`rounded px-2 py-0.5 text-[10.5px] ${
                    settings.mode === "enforce" && check.blocking
                      ? "bg-red-400/15 text-red-200"
                      : "bg-white/[0.06] text-white/45"
                  }`}
                >
                  Block
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ThresholdInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="block rounded-md border border-white/[0.08] bg-black/20 px-2 py-1.5">
      <span className="block text-[10px] font-medium uppercase tracking-[0.06em] text-white/45">
        {label}
      </span>
      <input
        type="number"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full bg-transparent text-[12.5px] font-semibold tabular-nums text-white outline-none disabled:opacity-50"
      />
    </label>
  );
}

function LogTradeForm({
  form,
  onChange,
  onSubmit,
  submitting,
  onSuggest,
  suggesting,
  signal,
  onCancel,
}: {
  form: typeof EMPTY_LOG_FORM;
  onChange: (next: typeof EMPTY_LOG_FORM) => void;
  onSubmit: () => void | Promise<void>;
  submitting: boolean;
  onSuggest: () => void | Promise<void>;
  suggesting: boolean;
  signal: TradingSignal | null;
  onCancel: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const set =
    <K extends keyof typeof EMPTY_LOG_FORM>(key: K) =>
    (v: (typeof EMPTY_LOG_FORM)[K]) =>
      onChange({ ...form, [key]: v });

  return (
    <div className="mb-5 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-[13px] font-semibold text-white">New paper trade — ZAR proposes, you approve</div>
        <button
          type="button"
          onClick={onCancel}
          className="text-white/50 hover:text-white/80"
          aria-label="Cancel"
        >
          <X size={16} />
        </button>
      </div>

      {/* ZAR builds the whole trade for the symbol you name. */}
      <div className="mb-4 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.04] px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[12px] text-cyan-100/90 max-w-[46ch] leading-snug">
            Not sure what to trade? Leave the symbol blank and ZAR scans live data to
            pick one, then fills in everything — direction, thesis, structure, and the
            entry / stop / target / size / risk. You just approve.
          </div>
          <button
            type="button"
            onClick={() => void onSuggest()}
            disabled={suggesting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 text-black font-medium px-3 py-1.5 text-[12.5px] hover:bg-cyan-300 disabled:opacity-50 transition-colors"
          >
            {suggesting
              ? "ZAR is building…"
              : form.symbol.trim()
                ? "ZAR, build this trade"
                : "ZAR, pick & build a trade"}
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

      {signal && <SignalPanel signal={signal} />}

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
      </div>

      <button
        type="button"
        onClick={() => setDetailsOpen((v) => !v)}
        className="mt-3 flex items-center gap-1 text-[11px] uppercase tracking-[0.08em] text-white/40 hover:text-white/70"
      >
        {detailsOpen ? "Hide" : "More"} details (setup, timeframe, risk, management)
      </button>
      {detailsOpen && (
        <div className="mt-2 grid gap-3 grid-cols-2 sm:grid-cols-3">
          <FormField label="ZAR manages">
            <select
              value={form.managementStyle}
              onChange={(e) => set("managementStyle")(e.target.value as NonNullable<PaperTrade["managementStyle"]>)}
              className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            >
              <option value="bracket" className="bg-neutral-900">Bracket</option>
              <option value="stop_only" className="bg-neutral-900">Stop only</option>
              <option value="target_only" className="bg-neutral-900">Target only</option>
              <option value="manual" className="bg-neutral-900">Manual</option>
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
      )}

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setReasoningOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 text-[11.5px] text-white/60 hover:text-white/90"
        >
          <span className="truncate text-left">
            {form.entryReason.trim()
              ? form.entryReason.trim().split("\n")[0].slice(0, 90)
              : "Why are you taking this trade? (required)"}
          </span>
          <span className="shrink-0 text-[10.5px] uppercase tracking-[0.06em] text-cyan-300/80">
            {reasoningOpen ? "Hide" : form.entryReason.trim() ? "Edit" : "Add"}
          </span>
        </button>
        {reasoningOpen && (
          <textarea
            value={form.entryReason}
            onChange={(e) => set("entryReason")(e.target.value)}
            rows={4}
            autoFocus
            placeholder="Trend continuation off the 20 EMA. Bought after intraday consolidation, tight risk, expected move to prior swing high."
            className="mt-2 w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 leading-snug resize-y placeholder:text-white/30"
          />
        )}
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

function BacktestPanel({ report }: { report: BacktestReport }) {
  const tone =
    report.edge === "positive"
      ? "border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-200"
      : report.edge === "negative"
        ? "border-red-400/30 bg-red-400/[0.06] text-red-200"
        : "border-white/10 bg-white/[0.03] text-white/70";
  return (
    <div className={`mt-3 rounded-lg border p-3 ${tone}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[13px] font-semibold">
          Backtest · {report.symbol} · {report.edge} edge
        </div>
        <div className="text-[10.5px] opacity-70">
          {report.fromDate} → {report.toDate} · {report.source}
        </div>
      </div>
      <p className="mt-1 text-[11.5px] leading-snug opacity-90">{report.summary}</p>
      <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
        <BtStat label="Trades" value={String(report.totalTrades)} />
        <BtStat label="Win rate" value={`${report.winRate}%`} />
        <BtStat label="Expectancy" value={`${report.expectancyR}R`} />
        <BtStat label="Net" value={`${report.netR}R`} />
        <BtStat label="Profit factor" value={String(report.profitFactor)} />
        <BtStat label="Max DD" value={`${report.maxDrawdownR}R`} />
        <BtStat label="Gross exp." value={`${report.grossExpectancyR}R`} />
        <BtStat label="Cost/trade" value={`${report.costPerTradeR}R`} />
      </div>
      <p className="mt-2 text-[10.5px] opacity-60 leading-snug">
        Net of costs — {report.slippageBps}bps slippage/fill + {report.commissionR}R commission
        ({report.costPerTradeR}R per trade). Daily bars, so intraday-order effects aren't modeled.
      </p>
    </div>
  );
}

function BtStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-[0.06em] opacity-50">{label}</div>
      <div className="mt-0.5 text-[13px] font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function SignalPanel({ signal }: { signal: TradingSignal }) {
  const tone =
    signal.signal === "buy"
      ? "border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-200"
      : signal.signal === "sell"
        ? "border-red-400/30 bg-red-400/[0.06] text-red-200"
        : "border-white/10 bg-white/[0.03] text-white/70";
  const voteTone = (v: string) =>
    v === "bullish" ? "text-emerald-300" : v === "bearish" ? "text-red-300" : "text-white/40";
  return (
    <div className={`mb-4 rounded-lg border p-3 ${tone}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[13px] font-semibold uppercase tracking-[0.06em]">
          Signal: {signal.signal} · {signal.strength}%
        </div>
        <div className="text-[11px] opacity-80">
          {signal.bullish} bullish / {signal.bearish} bearish
        </div>
      </div>
      <p className="mt-1 text-[11.5px] leading-snug opacity-90">{signal.summary}</p>
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
        {signal.votes.map((v) => (
          <div key={v.name} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-white/70">{v.name}</span>
            <span className={`font-medium ${voteTone(v.verdict)}`}>{v.verdict}</span>
          </div>
        ))}
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
