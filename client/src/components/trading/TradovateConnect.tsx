import { useCallback, useEffect, useState } from "react";
import { Boxes } from "lucide-react";

import { inputClass } from "./stage-atoms";

interface TradovateStatus {
  configured: boolean;
  environment: "demo" | "live";
  missing: string[];
  connected: boolean;
  accounts: Array<{ id: number; name: string; type: string }>;
  note: string;
}

/**
 * Connect a Tradovate account — demo for external paper trading, live for
 * the funded/live stage. Credentials are stored server-side and never
 * shown again; "Save & test" confirms the connection actually works.
 */
export default function TradovateConnect() {
  const [status, setStatus] = useState<TradovateStatus | null>(null);
  const [env, setEnv] = useState<"demo" | "live">("demo");
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/trading/tradovate/status", { credentials: "include" });
      if (res.ok) {
        const s = (await res.json()).status as TradovateStatus;
        setStatus(s);
        setEnv(s.environment);
      }
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/trading/tradovate/credentials", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment: env, ...values }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const s = (await res.json()).status as TradovateStatus;
      setStatus(s);
      setValues((v) => ({ ...v, password: "", sec: "" }));
    } catch (err: any) {
      setError(err?.message || "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const field = (key: string, label: string, secret = false) => (
    <label className="block">
      <div className="text-[10.5px] uppercase tracking-[0.08em] text-white/50 mb-1">{label}</div>
      <input
        type={secret ? "password" : "text"}
        value={values[key] || ""}
        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
        placeholder={status?.configured && secret ? "•••• saved — leave blank to keep" : ""}
        className={inputClass}
      />
    </label>
  );

  return (
    <div className="mt-5">
      <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-white/50">
        <Boxes size={13} className="text-cyan-300" />
        Tradovate (futures execution)
      </div>
      <p className="mb-2 text-[11.5px] text-white/40 leading-snug">
        Real order routing. Use <b>demo</b> for external paper trading and <b>live</b> for the funded/live
        stage. Needs an API application from your Tradovate account (App ID, CID, Secret).
      </p>

      {status && (
        <div
          className={`mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
            status.connected
              ? "bg-emerald-400/15 text-emerald-300"
              : status.configured
                ? "bg-amber-400/15 text-amber-300"
                : "bg-white/10 text-white/50"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              status.connected ? "bg-emerald-400" : status.configured ? "bg-amber-400" : "bg-white/40"
            }`}
          />
          {status.connected
            ? `Connected · ${status.environment} · ${status.accounts.length} account(s)`
            : status.configured
              ? `Saved but not connected · ${status.note}`
              : "Not connected"}
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
        <label className="block">
          <div className="text-[10.5px] uppercase tracking-[0.08em] text-white/50 mb-1">Environment</div>
          <select
            value={env}
            onChange={(e) => setEnv(e.target.value as "demo" | "live")}
            className={inputClass}
          >
            <option value="demo" className="bg-neutral-900">Demo (paper)</option>
            <option value="live" className="bg-neutral-900">Live (funded)</option>
          </select>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {field("username", "Username")}
          {field("password", "Password", true)}
          {field("appId", "App ID")}
          {field("cid", "CID")}
          {field("sec", "Secret", true)}
        </div>
        {error && <div className="text-[11.5px] text-red-300">{error}</div>}
        {status?.missing && status.missing.length > 0 && !status.configured && (
          <div className="text-[11px] text-white/40">Still needed: {status.missing.join(", ")}.</div>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="rounded-lg bg-cyan-400 text-black font-medium px-3.5 py-1.5 text-[13px] hover:bg-cyan-300 disabled:opacity-50"
          >
            {busy ? "Saving & testing…" : "Save & test"}
          </button>
        </div>
      </div>
    </div>
  );
}
