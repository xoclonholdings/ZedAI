import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Inbox as InboxIcon, LineChart, Link2, Lock } from "lucide-react";

import { apiRequest } from "@/lib/queryClient";
import { IntegrationGapCard, type IntegrationGap } from "@/components/connect/IntegrationGapCard";
import { SecretsVault } from "@/components/connect/SecretsVault";
import type {
  IntegrationProvider,
  IntegrationProviderInfo,
  TradingIntegration,
} from "@shared/trading-training-types";

interface ConnectCategorySummary {
  id: string;
  label: string;
  connected: boolean;
  accountCount: number;
  status: string;
}

const STATUS_CLS: Record<string, string> = {
  connected: "bg-emerald-400/15 text-emerald-300",
  configured: "bg-cyan-400/15 text-cyan-300",
  error: "bg-red-400/15 text-red-300",
  disconnected: "bg-white/10 text-white/40",
};

// The only accounts a regular user connects directly, per-user, are
// trading/market-data (TradingIntegrationsStore, /api/trading/integrations).
// Everything else (email, social, CRM, payments, ...) is configured once,
// admin-wide, in Settings > Advanced > Integrations - shown below as
// read-only status via /api/connect/categories, with editing left to
// whoever has admin access.
const CATEGORIES: Array<{ label: string; providers: IntegrationProvider[] }> = [
  { label: "Trading Brokers", providers: ["lucid", "tradovate", "webull"] },
  { label: "Prediction Markets", providers: ["kalshi", "polymarket"] },
  { label: "Other Accounts", providers: ["custom"] },
];

/**
 * The real Connect surface, reachable from Nexus's "Connect" domain.
 *
 * Combines two real backends: the per-user trading/market-data accounts
 * (/api/trading/integrations, the only accounts an individual user connects
 * directly) and a read-only summary of the admin-wide integrations
 * (/api/connect/categories) - email, social publishing, CRM, payments,
 * accounting, cloud storage, deployment, telephony, firewall, business
 * operations - so this page reflects everything ZAR can actually act
 * through, not just trading accounts.
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

  const { data: connectCategories } = useQuery<{ categories: ConnectCategorySummary[]; isAdmin: boolean }>({
    queryKey: ["/api/connect/categories"],
  });

  const queryClient = useQueryClient();
  const { data: gapsData } = useQuery<{ gaps: IntegrationGap[] }>({
    queryKey: ["/api/connect/gaps"],
  });
  const gaps = gapsData?.gaps ?? [];
  const [secretsPrefill, setSecretsPrefill] = useState<string | undefined>(undefined);

  const dismissGap = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/connect/gaps/${id}/dismiss`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/connect/gaps"] }),
  });

  function openSecretsForGap(gap: IntegrationGap) {
    setSecretsPrefill(`${gap.label} access`);
    document.getElementById("secrets-vault")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
          className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-fuchsia-500/10 via-purple-500/10 to-black p-4 text-left transition-colors hover:border-white/20"
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

        <button
          type="button"
          onClick={() => navigate("/inbox")}
          className="mb-6 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-black p-4 text-left transition-colors hover:border-white/20"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-300">
            <InboxIcon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-white">Email Inbox</div>
            <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
              Read what's come in and see what ZAR flagged for attention.
            </p>
          </div>
          <ChevronRight size={16} className="shrink-0 text-white/40" />
        </button>

        {gaps.length > 0 && (
          <div className="mb-6 space-y-2.5">
            {gaps.map((gap) => (
              <IntegrationGapCard
                key={gap.id}
                gap={gap}
                isAdmin={Boolean(connectCategories?.isAdmin)}
                onManage={() => navigate("/admin")}
                onAddCredentials={() => openSecretsForGap(gap)}
                onDismiss={() => dismissGap.mutate(gap.id)}
              />
            ))}
          </div>
        )}

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

        {connectCategories && connectCategories.categories.length > 0 && (
          <section className="mt-6">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">
              Business &amp; Platform Integrations
            </div>
            <div className="space-y-2">
              {connectCategories.categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-white">{category.label}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9.5px] uppercase tracking-[0.06em] ${
                          category.connected ? STATUS_CLS.connected : STATUS_CLS.disconnected
                        }`}
                      >
                        {category.connected ? `connected${category.accountCount > 1 ? ` (${category.accountCount})` : ""}` : category.status}
                      </span>
                    </div>
                  </div>
                  {connectCategories.isAdmin ? (
                    <button
                      type="button"
                      onClick={() => navigate("/admin")}
                      className="shrink-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11.5px] text-white/70 transition-colors hover:text-white"
                    >
                      Manage
                    </button>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 text-[10.5px] text-white/35">
                      <Lock size={11} />
                      Admin-managed
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <SecretsVault prefillLabel={secretsPrefill} />
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
