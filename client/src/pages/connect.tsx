import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ChevronRight, LineChart, Link2 } from "lucide-react";

import type {
  IntegrationProvider,
  IntegrationProviderInfo,
  TradingIntegration,
} from "@shared/trading-training-types";

const STATUS_CLS: Record<string, string> = {
  connected: "bg-emerald-400/15 text-emerald-300",
  configured: "bg-cyan-400/15 text-cyan-300",
  error: "bg-red-400/15 text-red-300",
  disconnected: "bg-white/10 text-white/40",
};

// Every real per-user connectable account in the app today is a trading/
// market-data provider (TradingIntegrationsStore) - there's no per-user
// backend yet for email, calendar, social, or storage accounts (those only
// exist as a single admin-wide config, not something an individual user
// connects). Grouping what's real into sub-categories rather than
// inventing categories the backend can't back.
const CATEGORIES: Array<{ label: string; providers: IntegrationProvider[] }> = [
  { label: "Trading Brokers", providers: ["lucid", "tradovate", "webull"] },
  { label: "Prediction Markets", providers: ["kalshi", "polymarket"] },
  { label: "Other Accounts", providers: ["custom"] },
];

/**
 * The real Connect surface, reachable from Nexus's "Connect" domain.
 *
 * Talks to the same per-user integrations backend the Trading workspace's
 * Accounts tab already uses (/api/trading/integrations) - the only
 * production-real "connect an external account" system in the app today.
 * Connecting or disconnecting here is reflected there too, since both
 * read and write the same account state.
 */
export default function ConnectPage() {
  const [, navigate] = useLocation();
  const [providers, setProviders] = useState<IntegrationProviderInfo[]>([]);
  const [integrations, setIntegrations] = useState<TradingIntegration[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/trading/integrations", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
        setIntegrations(data.integrations || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const connectedCount = integrations.filter((i) => i.status !== "disconnected").length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
        <header className="mb-6">
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
            Connected accounts
          </h2>
          <p className="mt-1.5 max-w-full text-[13.5px] leading-snug text-white/50 sm:max-w-[62ch]">
            Give ZAR access to accounts it can act in for you. Credentials stay
            server-side and are never shown again.{" "}
            {connectedCount > 0 && `${connectedCount} connected.`}
          </p>
        </header>

        <button
          type="button"
          onClick={() => navigate("/trading")}
          className="mb-6 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-fuchsia-500/10 via-purple-500/10 to-black p-4 text-left transition-colors hover:border-white/20"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-400/15 text-fuchsia-300">
            <LineChart size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-white">Trading Intelligence</div>
            <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
              Theses, journals, paper trades, and performance built on these connections.
            </p>
          </div>
          <ChevronRight size={16} className="shrink-0 text-white/40" />
        </button>

        {loading ? (
          <p className="text-[13px] text-white/40">Loading...</p>
        ) : (
          <div className="space-y-6">
            {CATEGORIES.map((category) => {
              const categoryProviders = category.providers
                .map((id) => providers.find((p) => p.provider === id))
                .filter((p): p is IntegrationProviderInfo => Boolean(p));
              if (categoryProviders.length === 0) return null;
              return (
                <section key={category.label}>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">
                    {category.label}
                  </div>
                  <div className="space-y-2.5">
                    {categoryProviders.map((info) => (
                      <ProviderCard
                        key={info.provider}
                        info={info}
                        integration={integrations.find((i) => i.provider === info.provider)}
                        onChanged={load}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <p className="mt-6 text-center text-[11.5px] leading-snug text-white/30">
          More account categories (email, calendar, social, storage) aren't
          connectable per-user yet - only trading/market-data accounts are today.
        </p>
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
            <Link2 size={13} className="shrink-0 text-cyan-300" />
            <span className="text-[13.5px] font-semibold text-white">{info.label}</span>
            <span className={`rounded-full px-2 py-0.5 text-[9.5px] uppercase tracking-[0.06em] ${STATUS_CLS[status]}`}>
              {status}
            </span>
          </div>
          <p className="mt-1 text-[11.5px] leading-snug text-white/50">{info.purpose}</p>
          {integration?.lastResult && (
            <p className="mt-1 text-[11px] text-white/55">{integration.lastResult}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11.5px] text-white/70 transition-colors hover:text-white"
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
            className="rounded-lg bg-cyan-400 px-2.5 py-1 text-[11.5px] font-medium text-black transition-colors hover:bg-cyan-300 disabled:opacity-50"
          >
            {busy ? "Testing…" : "Test"}
          </button>
          <button
            type="button"
            onClick={() => void disconnect()}
            disabled={busy}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11.5px] text-white/70 transition-colors hover:text-red-300 disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      )}

      {open && (
        <div className="mt-3 space-y-2 border-t border-white/[0.06] pt-3">
          {info.fields.map((field) => (
            <input
              key={field.key}
              type={field.secret ? "password" : "text"}
              value={values[field.key] || ""}
              onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
              placeholder={`${field.label}${field.optional ? " (optional)" : ""}`}
              autoComplete={field.secret ? "new-password" : "off"}
              className="w-full min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            />
          ))}
          {error && <p className="text-[12px] text-red-300">{error}</p>}
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="w-full rounded-lg bg-cyan-400 px-3 py-1.5 text-[13px] font-medium text-black transition-colors hover:bg-cyan-300 disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
