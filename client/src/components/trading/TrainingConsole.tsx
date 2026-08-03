import { useCallback, useEffect, useRef, useState } from "react";
import { KeyRound, Link2, Plug, Upload, X } from "lucide-react";

import type {
  IntegrationProviderInfo,
  MaterialUploadResult,
  TradingIntegration,
} from "@shared/trading-training-types";

import { EmptyBox, NoticeBanner, StageShell, inputClass } from "./stage-atoms";
import TradovateConnect from "./TradovateConnect";

const STATUS_LABEL: Record<string, string> = {
  connected: "connected",
  configured: "signed in",
  error: "needs attention",
  disconnected: "not connected",
};

/**
 * How you feed and connect ZAR for training:
 *   - Upload material (files) so ZAR ingests it into its knowledge.
 *   - Connect providers (Webull, Tradovate, Polymarket, and custom)
 *     that the trading stages can use.
 *
 * The paste-a-note flow and the "what ZAR has learned" library live
 * in LearnStage; this console adds file ingestion and connections.
 */

const STATUS_CLS: Record<string, string> = {
  connected: "bg-emerald-400/15 text-emerald-300",
  configured: "bg-cyan-400/15 text-cyan-300",
  error: "bg-red-400/15 text-red-300",
  disconnected: "bg-white/10 text-white/40",
};

export default function TrainingConsole({ onFed }: { onFed?: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [source, setSource] = useState("Uploaded material");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<MaterialUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [providers, setProviders] = useState<IntegrationProviderInfo[]>([]);
  const [integrations, setIntegrations] = useState<TradingIntegration[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [tab, setTab] = useState<"feed" | "accounts" | "data" | "execution">("feed");
  const [durable, setDurable] = useState<boolean>(true);

  const loadIntegrations = useCallback(async () => {
    try {
      const res = await fetch("/api/trading/integrations", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
        setIntegrations(data.integrations || []);
        setDurable(data.durable !== false);
      }
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    void loadIntegrations();
  }, [loadIntegrations]);

  useEffect(() => {
    if (!selected && providers.length > 0) setSelected(providers[0].provider);
  }, [providers, selected]);

  const selectedInfo = providers.find((p) => p.provider === selected);
  const connectedCount = integrations.filter((i) => i.status !== "disconnected").length;

  const upload = useCallback(async () => {
    setError(null);
    setNotice(null);
    setResult(null);
    if (files.length === 0) {
      setError("Choose at least one file to add.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      fd.append("source", source.trim() || "Uploaded material");
      const res = await fetch("/api/trading/knowledge/upload", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setResult(body as MaterialUploadResult);
      setFiles([]);
      if (fileRef.current) fileRef.current.value = "";
      setNotice("ZAR added your material. Run the test when you're ready.");
      onFed?.();
    } catch (err: any) {
      setError(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [files, source, onFed]);

  return (
    <StageShell
      eyebrow="Train ZAR"
      title="Train & connect"
      description="Upload material for ZAR to learn from, and connect the providers it should reach."
    >
      {notice && <NoticeBanner kind="success">{notice}</NoticeBanner>}
      {error && <NoticeBanner kind="error">{error}</NoticeBanner>}

      {/* One section at a time — tabs instead of five stacked panels. */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {(
          [
            ["feed", "Train ZAR"],
            ["accounts", "Accounts"],
            ["data", "Data keys"],
            ["execution", "Execution"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
              tab === id
                ? "bg-cyan-400 text-black font-medium"
                : "bg-white/[0.05] text-white/60 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "feed" && (
      <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.03] p-4">
        <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-white">
          <Upload size={15} className="text-cyan-300" />
          Upload material for ZAR
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
          <label className="block">
            <div className="text-[11px] uppercase tracking-[0.08em] text-white/50 mb-1">Source label</div>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Strategy rulebook / market notes"
              className={inputClass}
            />
          </label>
          <label className="block">
            <div className="text-[11px] uppercase tracking-[0.08em] text-white/50 mb-1">
              Files (PDF, CSV, DOCX, TXT)
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              className="block w-full text-[12.5px] text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-400 file:px-3 file:py-1.5 file:text-black file:font-medium hover:file:bg-cyan-300"
            />
          </label>
        </div>
        {files.length > 0 && (
          <div className="mt-2 text-[11.5px] text-white/50">
            {files.length} file{files.length === 1 ? "" : "s"} selected: {files.map((f) => f.name).join(", ")}
          </div>
        )}
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => void upload()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 text-black font-medium px-3.5 py-1.5 text-[13px] hover:bg-cyan-300 disabled:opacity-50 transition-colors"
          >
            <Upload size={13} />
            {uploading ? "Adding to ZAR…" : "Add material"}
          </button>
        </div>
        {result && (
          <div className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.04] p-3 text-[12px] text-emerald-100">
            Added {result.totals.sources} source{result.totals.sources === 1 ? "" : "s"} →{" "}
            {result.totals.concepts} concepts, {result.totals.rules} rules.
            <ul className="mt-1.5 space-y-0.5 text-emerald-200/80">
              {result.ingested.map((i) => (
                <li key={i.entryId}>
                  · {i.title} ({i.category})
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      )}

      {/* Connections */}
      {tab === "accounts" && (
      <div>
        <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-white/50">
          <Plug size={13} className="text-cyan-300" />
          Trading connections
        </div>
        <p className="mb-2 text-[11.5px] text-white/40 leading-snug">
          Connect only the services that support a live integration. Webull is the primary paper-trading connection.
        </p>
        {!durable && (
          <div className="mb-2 rounded-lg border border-amber-400/30 bg-amber-400/[0.06] px-3 py-2 text-[11.5px] text-amber-100 leading-snug">
            Heads up — connections can't be saved permanently right now, so they may not stick after a restart. Once the database is connected they'll persist for good.
          </div>
        )}
        {providers.length === 0 ? (
          <EmptyBox>Loading providers…</EmptyBox>
        ) : (
          <>
            <label className="block">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-[0.08em] text-white/50">
                  Choose an account
                </span>
                <span className="text-[10.5px] text-white/35">
                  {connectedCount} of {providers.length} connected
                </span>
              </div>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className={inputClass}
              >
                {providers.map((info) => {
                  const st = integrations.find((i) => i.provider === info.provider)?.status;
                  const label = STATUS_LABEL[st || "disconnected"];
                  return (
                    <option key={info.provider} value={info.provider} className="bg-neutral-900">
                      {info.label} — {label}
                    </option>
                  );
                })}
              </select>
            </label>
            {selectedInfo && (
              <div className="mt-2.5">
                <ProviderCard
                  key={selectedInfo.provider}
                  info={selectedInfo}
                  integration={integrations.find((i) => i.provider === selectedInfo.provider)}
                  onChanged={loadIntegrations}
                />
              </div>
            )}
          </>
        )}
      </div>
      )}

      {tab === "data" && <MarketDataKeysPanel />}
      {tab === "execution" && (
        <>
          <ExecutionAdaptersPanel />
          <TradovateConnect />
        </>
      )}
    </StageShell>
  );
}

interface ExecutionAdapterStatus {
  provider: string;
  label: string;
  configured: boolean;
  connected: boolean;
  mode: string;
  missing: string[];
  capabilities: {
    assets: string[];
    placeOrders: boolean;
  };
  accounts: Array<{ id: string; label: string; type: string }>;
  note: string;
}

function ExecutionAdaptersPanel() {
  const [adapters, setAdapters] = useState<ExecutionAdapterStatus[]>([]);
  const [query, setQuery] = useState("");
  const [markets, setMarkets] = useState<Array<{ id: string; slug: string; title: string }>>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/trading/execution/adapters", { credentials: "include" });
      if (res.ok) setAdapters((await res.json()).adapters || []);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const searchMarkets = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/trading/execution/polymarket/markets?query=${encodeURIComponent(query)}`, {
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      setMarkets(body.markets || []);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5">
      <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-white/50">
        <Plug size={13} className="text-cyan-300" />
        Execution adapters
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {adapters.map((adapter) => (
          <div key={adapter.provider} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[13px] font-semibold text-white">{adapter.label}</div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] ${
                  adapter.connected
                    ? "bg-emerald-400/15 text-emerald-300"
                    : adapter.configured
                      ? "bg-cyan-400/15 text-cyan-300"
                      : "bg-white/10 text-white/45"
                }`}
              >
                {adapter.connected ? "ready" : adapter.configured ? "configured" : "missing keys"}
              </span>
            </div>
            <div className="mt-1 text-[11.5px] text-white/45 leading-snug">{adapter.note}</div>
            <div className="mt-2 text-[10.5px] text-white/35">
              {adapter.capabilities.assets.join(", ")} · orders {adapter.capabilities.placeOrders ? "enabled" : "disabled"}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <div className="mb-2 text-[12px] font-semibold text-white">Polymarket US market lookup</div>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search events"
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => void searchMarkets()}
            disabled={busy}
            className="rounded-lg bg-cyan-400 px-3 py-1.5 text-[13px] font-medium text-black disabled:opacity-50"
          >
            {busy ? "Searching..." : "Search"}
          </button>
        </div>
        {markets.length > 0 && (
          <div className="mt-2 space-y-1">
            {markets.slice(0, 5).map((market) => (
              <div key={market.id || market.slug} className="rounded-lg bg-black/20 px-2.5 py-1.5 text-[11.5px] text-white/65">
                {market.title}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface KeyStatus {
  vendor: "finnhub" | "alphavantage" | "twelvedata";
  label: string;
  configured: boolean;
  source: "saved" | "env" | null;
}

const VENDOR_HINTS: Record<string, string> = {
  finnhub: "finnhub.io/register — free key",
  alphavantage: "alphavantage.co/support/#api-key — free key",
  twelvedata: "twelvedata.com — free key",
};

/**
 * Lets the user paste a data-vendor API key so ZAR's live feed is more
 * reliable, without touching Render env vars. Keys are stored server-side
 * and never returned — the UI only shows whether each is configured.
 */
function MarketDataKeysPanel() {
  const [keys, setKeys] = useState<KeyStatus[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [live, setLive] = useState<{ live: boolean; source: string | null; note: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [keysRes, statusRes] = await Promise.all([
        fetch("/api/trading/market-data/keys", { credentials: "include" }),
        fetch("/api/trading/market-data/status", { credentials: "include" }),
      ]);
      if (keysRes.ok) setKeys((await keysRes.json()).keys || []);
      if (statusRes.ok) {
        const s = await statusRes.json();
        setLive({ live: !!s.live, source: s.source, note: s.note });
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
    setSaved(null);
    try {
      const res = await fetch("/api/trading/market-data/keys", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setValues({});
      setSaved("Saved. ZAR will use it on the next proposal.");
      await load();
    } catch (err: any) {
      setError(err?.message || "Could not save keys");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5">
      <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-white/50">
        <KeyRound size={13} className="text-cyan-300" />
        Market data API keys
      </div>
      <p className="mb-2 text-[11.5px] text-white/40 leading-snug">
        Optional. ZAR reads live prices from a free public feed already; adding a vendor
        key makes it more reliable. Keys are stored securely and never shown again.
      </p>

      {live && (
        <div
          title={live.note}
          className={`mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
            live.live ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-300"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${live.live ? "bg-emerald-400" : "bg-amber-400"}`} />
          {live.live ? `Live feed reachable · ${live.source}` : "No live feed reachable"}
        </div>
      )}

      <div className="space-y-2">
        {keys.map((k) => (
          <div key={k.vendor} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-white">{k.label}</span>
              <span
                className={`text-[9.5px] uppercase tracking-[0.06em] rounded-full px-2 py-0.5 ${
                  k.configured ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-white/40"
                }`}
              >
                {k.configured ? (k.source === "env" ? "set (env)" : "saved") : "not set"}
              </span>
            </div>
            <input
              type="password"
              value={values[k.vendor] || ""}
              onChange={(e) => setValues((v) => ({ ...v, [k.vendor]: e.target.value }))}
              placeholder={k.configured ? "•••• saved — leave blank to keep" : "paste API key"}
              className={inputClass}
            />
            <div className="mt-1 text-[10.5px] text-white/35">{VENDOR_HINTS[k.vendor]}</div>
          </div>
        ))}
      </div>

      {error && <div className="mt-2 text-[11.5px] text-red-300">{error}</div>}
      {saved && <div className="mt-2 text-[11.5px] text-emerald-300">{saved}</div>}

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[10.5px] text-white/35 leading-snug max-w-[46ch]">
          Tradovate futures data &amp; order routing is a separate integration — connect the
          Tradovate login in the account dropdown above; the live futures feed is coming soon.
        </p>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || Object.values(values).every((v) => !v.trim())}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 text-black font-medium px-3.5 py-1.5 text-[13px] hover:bg-cyan-300 disabled:opacity-40 transition-colors"
        >
          {busy ? "Saving…" : "Save keys"}
        </button>
      </div>
    </div>
  );
}

function ProviderCard({
  info,
  integration,
  onChanged,
}: {
  info: IntegrationProviderInfo;
  integration?: TradingIntegration;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = integration?.status || "disconnected";
  const connected = status !== "disconnected";

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trading/integrations/${info.provider}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setValues({});
      setOpen(false);
      onChanged();
    } catch (err: any) {
      setError(err?.message || "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trading/integrations/${info.provider}/test`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      onChanged();
    } catch (err: any) {
      setError(err?.message || "Test failed");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trading/integrations/${info.provider}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Could not disconnect (HTTP ${res.status})`);
      }
      onChanged();
    } catch (err: any) {
      setError(err?.message || "Failed to disconnect");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link2 size={13} className="text-cyan-300 shrink-0" />
            <span className="text-[13.5px] font-semibold text-white">{info.label}</span>
            <span className={`text-[9.5px] uppercase tracking-[0.06em] rounded-full px-2 py-0.5 ${STATUS_CLS[status]}`}>
              {status}
            </span>
          </div>
          <p className="mt-1 text-[11.5px] text-white/50 leading-snug">{info.purpose}</p>
          <p className="mt-1 text-[10.5px] text-white/35">
            Credentials stay server-side and are never shown again.
          </p>
          {integration?.lastResult && (
            <p className="mt-1 text-[11px] text-white/55">{integration.lastResult}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11.5px] text-white/70 hover:text-white transition-colors"
        >
          {open ? "Close" : connected ? "Edit" : "Connect"}
        </button>
      </div>

      {connected && !open && (
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={() => void test()}
            disabled={busy}
            className="rounded-lg bg-cyan-400 text-black font-medium px-2.5 py-1 text-[11.5px] hover:bg-cyan-300 disabled:opacity-50"
          >
            {busy ? "Testing…" : "Test"}
          </button>
          <button
            type="button"
            onClick={() => void disconnect()}
            disabled={busy}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11.5px] text-white/60 hover:text-red-300 disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      )}

      {open && (
        <div className="mt-3 space-y-2 border-t border-white/[0.06] pt-3">
          {info.fields.map((field) => (
            <label key={field.key} className="block">
              <div className="text-[10.5px] uppercase tracking-[0.08em] text-white/50 mb-1">
                {field.label}
                {field.optional ? " (optional)" : ""}
              </div>
              <input
                type={field.secret ? "password" : "text"}
                value={values[field.key] || ""}
                onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                placeholder={field.secret && integration?.hasCredential ? "•••• saved — leave blank to keep" : ""}
                className={inputClass}
              />
            </label>
          ))}
          {error && <div className="text-[11.5px] text-red-300">{error}</div>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11.5px] text-white/60"
            >
              <X size={12} className="inline" /> Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="rounded-lg bg-cyan-400 text-black font-medium px-3 py-1 text-[11.5px] hover:bg-cyan-300 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save connection"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
