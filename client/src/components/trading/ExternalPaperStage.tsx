import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";

import type { ExternalPaperReport } from "@shared/trading-training-types";

import { EmptyBox, NoticeBanner, StageShell } from "./stage-atoms";

interface WebullStatus {
  configured?: boolean;
  connected?: boolean;
  note?: string;
}

interface WebullForm {
  appKey: string;
  appSecret: string;
  endpoint: string;
  accountId: string;
  environment: string;
}

export default function ExternalPaperStage() {
  const [report, setReport] = useState<ExternalPaperReport | null>(null);
  const [status, setStatus] = useState<WebullStatus | null>(null);
  const [form, setForm] = useState<WebullForm>({
    appKey: "",
    appSecret: "",
    endpoint: "",
    accountId: "",
    environment: "sandbox",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [reportRes, statusRes] = await Promise.all([
        fetch("/api/trading/external-paper", { credentials: "include" }),
        fetch("/api/trading/webull/status", { credentials: "include" }),
      ]);
      if (reportRes.ok) setReport((await reportRes.json()).report);
      if (statusRes.ok) setStatus((await statusRes.json()).status);
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
      setForm((current) => ({ ...current, appSecret: "" }));
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Could not save Webull connection");
    } finally {
      setSaving(false);
    }
  };

  return (
    <StageShell
      eyebrow="External paper"
      title="External paper trading"
      description="Zed repeats the proof on a Webull paper account: real platform mechanics and live data, no money, before any funded risk."
      onRefresh={() => void refresh()}
      refreshing={loading}
    >
      {error && <NoticeBanner kind="error">{error}</NoticeBanner>}
      {notice && <NoticeBanner kind="success">{notice}</NoticeBanner>}
      {!report ? (
        <EmptyBox>Loading...</EmptyBox>
      ) : (
        <div className="space-y-4">
          <WebullConnectCard
            status={status}
            form={form}
            setForm={setForm}
            saving={saving}
            onSave={() => void saveWebull()}
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
              External paper trading does not start until Webull is connected. Zed will not label this
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
}: {
  status: WebullStatus | null;
  form: WebullForm;
  setForm: Dispatch<SetStateAction<WebullForm>>;
  saving: boolean;
  onSave: () => void;
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

      <div className="mt-3 flex justify-end">
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
