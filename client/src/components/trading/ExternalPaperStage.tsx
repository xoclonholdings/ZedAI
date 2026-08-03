import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";

import type { ExternalPaperReport, TradingSignal } from "@shared/trading-training-types";
import type { PaperTrade } from "@shared/trading-types";

import { EmptyBox, NoticeBanner, StageShell } from "./stage-atoms";

interface WebullStatus {
  configured?: boolean;
  connected?: boolean;
  note?: string;
  saved?: {
    appKey?: boolean;
    appKeyLast4?: string;
    appSecret?: boolean;
    accessToken?: boolean;
    endpoint?: string;
    accountId?: string;
    environment?: string;
  };
}

interface WebullForm {
  appKey: string;
  appSecret: string;
  accessToken: string;
  endpoint: string;
  accountId: string;
  environment: string;
}

interface WebullOrderForm {
  thesisId: string;
  symbol: string;
  direction: "long" | "short";
  market: string;
  assetClass: string;
  timeframe: string;
  setupName: string;
  entry: string;
  stop: string;
  target: string;
  size: string;
  riskAmount: string;
  managementStyle: NonNullable<PaperTrade["managementStyle"]>;
  entryReason: string;
}

export default function ExternalPaperStage() {
  const [report, setReport] = useState<ExternalPaperReport | null>(null);
  const [status, setStatus] = useState<WebullStatus | null>(null);
  const [form, setForm] = useState<WebullForm>({
    appKey: "",
    appSecret: "",
    accessToken: "",
    endpoint: "",
    accountId: "",
    environment: "sandbox",
  });
  const [orderForm, setOrderForm] = useState<WebullOrderForm>({
    thesisId: "",
    symbol: "",
    direction: "long",
    market: "US",
    assetClass: "stock",
    timeframe: "",
    setupName: "",
    entry: "",
    stop: "",
    target: "",
    size: "1",
    riskAmount: "",
    managementStyle: "bracket",
    entryReason: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [proposalSignal, setProposalSignal] = useState<TradingSignal | null>(null);
  const [proposalSummary, setProposalSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportRes, statusRes] = await Promise.all([
        fetch("/api/trading/external-paper", { credentials: "include" }),
        fetch("/api/trading/webull/status", { credentials: "include" }),
      ]);
      if (!reportRes.ok) {
        const body = await reportRes.json().catch(() => ({}));
        throw new Error(body?.error || `Could not load external-paper progress (HTTP ${reportRes.status})`);
      }
      setReport((await reportRes.json()).report);
      if (!statusRes.ok) {
        const body = await statusRes.json().catch(() => ({}));
        throw new Error(body?.error || `Could not load Webull status (HTTP ${statusRes.status})`);
      }
      const nextStatus = (await statusRes.json()).status;
      setStatus(nextStatus);
      setForm((current) => ({
        ...current,
        endpoint: nextStatus?.saved?.endpoint || "",
        accountId: nextStatus?.saved?.accountId || "",
        environment: nextStatus?.saved?.environment || "sandbox",
      }));
    } catch (err: any) {
      setError(err?.message || "Failed to load external paper");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveWebull = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/trading/webull/credentials", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setStatus(body.status);
      setNotice(
        body.status?.connected
          ? "Webull paper account connected."
          : "Webull credentials saved. Add the paper account ID to mark the account connected.",
      );
      setForm((current) => ({ ...current, appSecret: "", accessToken: "" }));
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Could not save Webull connection");
    } finally {
      setSaving(false);
    }
  };

  const testWebull = async () => {
    setTesting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/trading/webull/test", {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.result?.message || body?.error || `HTTP ${res.status}`);
      setStatus(body.status);
      setForm((current) => ({
        ...current,
        accountId: body.status?.saved?.accountId || current.accountId,
        endpoint: body.status?.saved?.endpoint || current.endpoint,
        environment: body.status?.saved?.environment || current.environment,
      }));
      setNotice(body.result?.message || "Webull test succeeded.");
    } catch (err: any) {
      setError(err?.message || "Webull test failed");
    } finally {
      setTesting(false);
    }
  };

  const proposeWebullPaperOrder = async () => {
    setProposing(true);
    setError(null);
    setNotice(null);
    setProposalSummary(null);
    try {
      const res = await fetch("/api/trading/webull/propose", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: orderForm.symbol,
          market: orderForm.market,
          assetClass: orderForm.assetClass,
          asset: orderForm.assetClass,
          directionPreference: "auto",
          timeframe: orderForm.timeframe || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setProposalSignal(body.signal || null);
      if (body.action === "no_trade") {
        setProposalSummary(body.reason || "ZAR found no trade worth staging right now.");
        setNotice(body.reason || "No Webull paper trade proposed.");
        return;
      }
      setProposalSummary(
        body.recommendedSymbol?.reason ||
          (body.marketData?.source
            ? `Live data: ${body.marketData.source} at ${body.marketData?.price ?? "n/a"}.`
            : body.basis || null),
      );
      setOrderForm((current) => ({
        ...current,
        thesisId: body.thesisId || "",
        symbol: body.symbol || current.symbol,
        direction: body.direction || current.direction,
        market: body.market || current.market,
        assetClass: body.asset || current.assetClass,
        timeframe: body.timeframe || current.timeframe,
        setupName: body.setupType || current.setupName,
        entry: String(body.entry ?? ""),
        stop: String(body.stop ?? ""),
        target: String(body.target ?? ""),
        size: String(body.size ?? "1"),
        riskAmount: String(body.riskAmount ?? ""),
        managementStyle: body.managementStyle || "bracket",
        entryReason: body.thesis || body.entryPlan || "",
      }));
      setNotice(`ZAR proposed a Webull ${body.action?.toUpperCase() || body.direction} setup for ${body.symbol}. Review and stage it.`);
    } catch (err: any) {
      setError(err?.message || "Could not build Webull paper proposal");
    } finally {
      setProposing(false);
    }
  };

  const submitWebullPaperOrder = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/trading/webull/paper-orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderForm),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setNotice(`Webull paper order staged: ${body.trade?.symbol || orderForm.symbol.toUpperCase()}.`);
      setOrderForm((current) => ({
        ...current,
        thesisId: "",
        symbol: "",
        entry: "",
        stop: "",
        target: "",
        riskAmount: "",
        setupName: "",
        entryReason: "",
      }));
      setProposalSignal(null);
      setProposalSummary(null);
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Could not stage Webull paper order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <StageShell
      eyebrow="External paper"
      title="External paper trading"
      description="ZAR repeats the proof on a Webull paper account: real platform mechanics and live data, no money, before any funded risk."
      onRefresh={() => void refresh()}
      refreshing={loading}
    >
      {error && <NoticeBanner kind="error">{error}</NoticeBanner>}
      {notice && <NoticeBanner kind="success">{notice}</NoticeBanner>}
      {!report ? (
        error ? null : <EmptyBox>Loading external paper…</EmptyBox>
      ) : (
        <div className="space-y-4">
          <WebullConnectCard
            status={status}
            form={form}
            setForm={setForm}
            saving={saving}
            onSave={() => void saveWebull()}
            testing={testing}
            onTest={() => void testWebull()}
          />

          <WebullPaperOrderCard
            connected={Boolean(status?.connected)}
            form={orderForm}
            setForm={setOrderForm}
            saving={saving}
            proposing={proposing}
            signal={proposalSignal}
            summary={proposalSummary}
            onPropose={() => void proposeWebullPaperOrder()}
            onSubmit={() => void submitWebullPaperOrder()}
          />

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
              {report.passed ? "proven" : report.providerConnected ? "in progress" : "connect Webull"}
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
            <Stat label="Provider" value={report.providerConnected ? "Connected" : "-"} />
          </div>

          {!report.providerConnected && (
            <p className="text-[11px] text-white/40 leading-snug">
              External paper trading does not start until Webull is connected. ZAR will not label this
              stage connected unless a paper account is actually configured.
            </p>
          )}
        </div>
      )}
    </StageShell>
  );
}

function WebullConnectCard({
  status,
  form,
  setForm,
  saving,
  onSave,
  testing,
  onTest,
}: {
  status: WebullStatus | null;
  form: WebullForm;
  setForm: Dispatch<SetStateAction<WebullForm>>;
  saving: boolean;
  onSave: () => void;
  testing: boolean;
  onTest: () => void;
}) {
  const connected = Boolean(status?.connected);
  const configured = Boolean(status?.configured);
  return (
    <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.03] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[13px] font-semibold text-white">Webull paper connection</div>
          <p className="mt-1 text-[11.5px] leading-snug text-white/50">
            {status?.note || "Add Webull OpenAPI credentials and the paper account ID."}
          </p>
          {status?.saved && (
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10.5px] text-white/45">
              {status.saved.appKey && <span className="rounded-full bg-white/10 px-2 py-0.5">App key saved {status.saved.appKeyLast4 ? `...${status.saved.appKeyLast4}` : ""}</span>}
              {status.saved.appSecret && <span className="rounded-full bg-white/10 px-2 py-0.5">Secret saved</span>}
              {status.saved.accessToken && <span className="rounded-full bg-white/10 px-2 py-0.5">Access token saved</span>}
              {status.saved.accountId && <span className="rounded-full bg-white/10 px-2 py-0.5">Account {status.saved.accountId}</span>}
              {status.saved.environment && <span className="rounded-full bg-white/10 px-2 py-0.5">{status.saved.environment}</span>}
            </div>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] ${
            connected
              ? "bg-emerald-400/15 text-emerald-300"
              : configured
                ? "bg-cyan-400/15 text-cyan-300"
                : "bg-amber-400/15 text-amber-300"
          }`}
        >
          {connected ? "connected" : configured ? "configured" : "not connected"}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Input label="App key" value={form.appKey} onChange={(appKey) => setForm((v) => ({ ...v, appKey }))} />
        <Input label="App secret" type="password" value={form.appSecret} onChange={(appSecret) => setForm((v) => ({ ...v, appSecret }))} />
        <Input label="Access token" type="password" value={form.accessToken} onChange={(accessToken) => setForm((v) => ({ ...v, accessToken }))} placeholder="optional for 2FA accounts" />
        <Input label="Paper account ID" value={form.accountId} onChange={(accountId) => setForm((v) => ({ ...v, accountId }))} />
        <Input label="Endpoint" value={form.endpoint} onChange={(endpoint) => setForm((v) => ({ ...v, endpoint }))} placeholder="optional" />
        <label className="block sm:col-span-2">
          <div className="mb-1 text-[10.5px] uppercase tracking-[0.08em] text-white/50">Environment</div>
          <select
            value={form.environment}
            onChange={(event) => setForm((v) => ({ ...v, environment: event.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-[12.5px] text-white outline-none focus:border-cyan-400/50"
          >
            <option value="sandbox" className="bg-neutral-900">Sandbox / paper</option>
            <option value="production" className="bg-neutral-900">Production</option>
          </select>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onTest}
          disabled={testing}
          className="rounded-lg border border-cyan-400/25 bg-cyan-400/[0.08] px-3 py-1.5 text-[12.5px] font-medium text-cyan-100 hover:bg-cyan-400/[0.14] disabled:opacity-50"
        >
          {testing ? "Testing..." : "Test Webull"}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-cyan-400 px-3 py-1.5 text-[12.5px] font-medium text-black hover:bg-cyan-300 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Webull connection"}
        </button>
      </div>
    </div>
  );
}

function WebullPaperOrderCard({
  connected,
  form,
  setForm,
  saving,
  proposing,
  signal,
  summary,
  onPropose,
  onSubmit,
}: {
  connected: boolean;
  form: WebullOrderForm;
  setForm: Dispatch<SetStateAction<WebullOrderForm>>;
  saving: boolean;
  proposing: boolean;
  signal: TradingSignal | null;
  summary: string | null;
  onPropose: () => void;
  onSubmit: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reasoningOpen, setReasoningOpen] = useState(false);
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[13px] font-semibold text-white">Webull paper proposal</div>
          <p className="mt-1 text-[11.5px] leading-snug text-white/50">
            ZAR builds the full Webull paper setup from live data. You review, then stage it.
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] ${connected ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-white/40"}`}>
          {connected ? "ready" : "connect first"}
        </span>
      </div>

      <div className="mt-3 rounded-lg border border-cyan-400/15 bg-cyan-400/[0.04] p-3">
        <button
          type="button"
          onClick={onPropose}
          disabled={!connected || proposing}
          className="rounded-lg bg-cyan-400 px-3 py-1.5 text-[12.5px] font-medium text-black hover:bg-cyan-300 disabled:opacity-40"
        >
          {proposing ? "ZAR is building..." : form.symbol.trim() ? "ZAR, build this Webull trade" : "ZAR, pick & build a Webull trade"}
        </button>
        {summary && <p className="mt-2 text-[11.5px] leading-snug text-white/60">{summary}</p>}
        {signal && <div className="mt-2"><SignalPanel signal={signal} /></div>}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Input label="Symbol" value={form.symbol} onChange={(symbol) => setForm((v) => ({ ...v, symbol }))} placeholder="AAPL" />
        <label className="block">
          <div className="mb-1 text-[10.5px] uppercase tracking-[0.08em] text-white/50">Direction</div>
          <select
            value={form.direction}
            onChange={(event) => setForm((v) => ({ ...v, direction: event.target.value as "long" | "short" }))}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-[12.5px] text-white outline-none focus:border-cyan-400/50"
          >
            <option value="long" className="bg-neutral-900">Long</option>
            <option value="short" className="bg-neutral-900">Short</option>
          </select>
        </label>
        <Input label="Entry" value={form.entry} onChange={(entry) => setForm((v) => ({ ...v, entry }))} />
        <Input label="Stop" value={form.stop} onChange={(stop) => setForm((v) => ({ ...v, stop }))} />
        <Input label="Target" value={form.target} onChange={(target) => setForm((v) => ({ ...v, target }))} />
        <Input label="Size" value={form.size} onChange={(size) => setForm((v) => ({ ...v, size }))} />
      </div>

      <button
        type="button"
        onClick={() => setDetailsOpen((v) => !v)}
        className="mt-3 flex items-center gap-1 text-[11px] uppercase tracking-[0.08em] text-white/40 hover:text-white/70"
      >
        {detailsOpen ? "Hide" : "More"} details (setup, timeframe, risk, management)
      </button>
      {detailsOpen && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Input label="Risk amount" value={form.riskAmount} onChange={(riskAmount) => setForm((v) => ({ ...v, riskAmount }))} />
          <Input label="Asset class" value={form.assetClass} onChange={(assetClass) => setForm((v) => ({ ...v, assetClass }))} />
          <Input label="Timeframe" value={form.timeframe} onChange={(timeframe) => setForm((v) => ({ ...v, timeframe }))} />
          <Input label="Setup" value={form.setupName} onChange={(setupName) => setForm((v) => ({ ...v, setupName }))} />
          <label className="block sm:col-span-2">
            <div className="mb-1 text-[10.5px] uppercase tracking-[0.08em] text-white/50">ZAR manages</div>
            <select
              value={form.managementStyle}
              onChange={(event) => setForm((v) => ({ ...v, managementStyle: event.target.value as NonNullable<PaperTrade["managementStyle"]> }))}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-[12.5px] text-white outline-none focus:border-cyan-400/50"
            >
              <option value="bracket" className="bg-neutral-900">Bracket: target + stop</option>
              <option value="stop_only" className="bg-neutral-900">Stop only</option>
              <option value="target_only" className="bg-neutral-900">Target only</option>
              <option value="manual" className="bg-neutral-900">Manual close</option>
            </select>
          </label>
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
              : "Why is ZAR taking this trade? (required)"}
          </span>
          <span className="shrink-0 text-[10.5px] uppercase tracking-[0.06em] text-cyan-300/80">
            {reasoningOpen ? "Hide" : form.entryReason.trim() ? "Edit" : "Add"}
          </span>
        </button>
        {reasoningOpen && (
          <textarea
            value={form.entryReason}
            onChange={(event) => setForm((v) => ({ ...v, entryReason: event.target.value }))}
            rows={4}
            autoFocus
            placeholder="Why ZAR is taking this Webull paper trade"
            className="mt-2 min-h-20 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-[12.5px] text-white outline-none placeholder:text-white/25 focus:border-cyan-400/50"
          />
        )}
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!connected || saving}
          className="rounded-lg bg-cyan-400 px-3 py-1.5 text-[12.5px] font-medium text-black hover:bg-cyan-300 disabled:opacity-40"
        >
          {saving ? "Staging..." : "Stage Webull paper order"}
        </button>
      </div>
    </div>
  );
}

function SignalPanel({ signal }: { signal: TradingSignal }) {
  const cls =
    signal.signal === "buy"
      ? "border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-100"
      : signal.signal === "sell"
        ? "border-red-400/30 bg-red-400/[0.08] text-red-100"
        : "border-amber-400/30 bg-amber-400/[0.08] text-amber-100";
  return (
    <div className={`rounded-lg border p-2 ${cls}`}>
      <div className="text-[12px] font-semibold uppercase tracking-[0.06em]">
        Signal: {signal.signal} · {signal.strength}%
      </div>
      <p className="mt-1 text-[11.5px] leading-snug opacity-90">{signal.summary}</p>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[10.5px] uppercase tracking-[0.08em] text-white/50">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 text-[12.5px] text-white outline-none placeholder:text-white/25 focus:border-cyan-400/50"
      />
    </label>
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
