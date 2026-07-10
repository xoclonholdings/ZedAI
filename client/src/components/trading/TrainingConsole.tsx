import { useCallback, useEffect, useRef, useState } from "react";
import { Link2, Plug, Upload, X } from "lucide-react";

import type {
  IntegrationProviderInfo,
  MaterialUploadResult,
  TradingIntegration,
} from "@shared/trading-training-types";

import { EmptyBox, NoticeBanner, StageShell, inputClass } from "./stage-atoms";

/**
 * How you feed and connect Zed for training:
 *   - Upload material (files) so Zed ingests it into its knowledge.
 *   - Connect providers (TopStep, TradingView, Lucid, Tradovate,
 *     custom) — the real connection layer live sync will use.
 *
 * The paste-a-note flow and the "what Zed has learned" library live
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

  const loadIntegrations = useCallback(async () => {
    try {
      const res = await fetch("/api/trading/integrations", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
        setIntegrations(data.integrations || []);
      }
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    void loadIntegrations();
  }, [loadIntegrations]);

  const upload = useCallback(async () => {
    setError(null);
    setNotice(null);
    setResult(null);
    if (files.length === 0) {
      setError("Choose at least one file to feed Zed.");
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
      setNotice("Zed ingested your material. Run the test when you're ready.");
      onFed?.();
    } catch (err: any) {
      setError(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [files, source, onFed]);

  return (
    <StageShell
      eyebrow="Train Zed"
      title="Feed & connect"
      description="Upload material for Zed to ingest, and connect the providers it should reach. Zed learns from everything you give it here."
    >
      {notice && <NoticeBanner kind="success">{notice}</NoticeBanner>}
      {error && <NoticeBanner kind="error">{error}</NoticeBanner>}

      {/* Feed Zed material (files) */}
      <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.03] p-4">
        <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-white">
          <Upload size={15} className="text-cyan-300" />
          Upload material for Zed
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
          <label className="block">
            <div className="text-[11px] uppercase tracking-[0.08em] text-white/50 mb-1">Source label</div>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Trades By Sci / TopStep rulebook"
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
            {uploading ? "Feeding Zed…" : "Feed Zed"}
          </button>
        </div>
        {result && (
          <div className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.04] p-3 text-[12px] text-emerald-100">
            Ingested {result.totals.sources} source{result.totals.sources === 1 ? "" : "s"} →{" "}
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

      {/* Connections */}
      <div className="mt-5">
        <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-white/50">
          <Plug size={13} className="text-cyan-300" />
          Accounts Zed can sign into
        </div>
        <p className="mb-2 text-[11.5px] text-white/40 leading-snug">
          Just your username and password — the same way you log in. Zed signs in and works in the account for you. No API keys or setup.
        </p>
        {providers.length === 0 ? (
          <EmptyBox>Loading providers…</EmptyBox>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {providers.map((info) => (
              <ProviderCard
                key={info.provider}
                info={info}
                integration={integrations.find((i) => i.provider === info.provider)}
                onChanged={loadIntegrations}
              />
            ))}
          </div>
        )}
      </div>
    </StageShell>
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
      await fetch(`/api/trading/integrations/${info.provider}`, {
        method: "DELETE",
        credentials: "include",
      });
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
            Your login stays private — Zed uses it to sign in for you.
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
