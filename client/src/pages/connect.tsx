import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Inbox as InboxIcon, Landmark, Link2, Lock } from "lucide-react";

import { apiRequest } from "@/lib/queryClient";
import { IntegrationGapCard, type IntegrationGap } from "@/components/connect/IntegrationGapCard";
import { SecretsVault } from "@/components/connect/SecretsVault";
import { buildApiUrl } from "@/lib/apiClient";

interface ConnectCategorySummary {
  id: string;
  label: string;
  connected: boolean;
  accountCount: number;
  status: string;
}

interface CapabilityIntegrationSummary {
  id: string;
  connected: boolean;
  requiredBy: string[];
}

const CAPABILITY_INTEGRATION_LABELS: Record<string, string> = {
  model_provider: "Intelligence provider",
  web_search: "Current-source search",
  zillion_capital: "ZILLION Capital gateway",
};

const STATUS_CLS: Record<string, string> = {
  connected: "bg-emerald-400/15 text-emerald-300",
  disconnected: "bg-white/10 text-white/40",
};

export default function ConnectPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [secretsPrefill, setSecretsPrefill] = useState<string | undefined>();

  const { data: connectCategories } = useQuery<{
    categories: ConnectCategorySummary[];
    isAdmin: boolean;
  }>({ queryKey: ["/api/connect/categories"] });
  const { data: gapsData } = useQuery<{ gaps: IntegrationGap[] }>({
    queryKey: ["/api/connect/gaps"],
  });
  const { data: capabilityIntegrations } = useQuery<{ integrations: CapabilityIntegrationSummary[] }>({
    queryKey: ["/api/connect/capabilities"],
  });

  const dismissGap = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/connect/gaps/${id}/dismiss`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/connect/gaps"] }),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-10">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-black p-5 backdrop-blur-md">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
          <Link2 size={18} className="text-cyan-300" />
          Connect
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Business and platform credentials remain managed by ZCOS. Broker and market-data connections are owned by ZILLION Prosper.
        </p>
      </section>

      <a
        href={buildApiUrl("/api/capital/launch?path=%2Ftrading")}
        className="zar-glass flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-all hover:shadow-[0_0_22px_rgba(217,70,239,0.25)]"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-400/15 text-fuchsia-300">
          <Landmark size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-white">Capital connections</div>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
            Open brokers, market data, paper trading, and governed execution in ZILLION Prosper.
          </p>
        </div>
        <ChevronRight size={16} className="shrink-0 text-white/40" />
      </a>

      <button
        type="button"
        onClick={() => navigate("/inbox")}
        className="zar-glass flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-all hover:shadow-[0_0_22px_rgba(103,232,249,0.25)]"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-300">
          <InboxIcon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-white">Email Inbox</div>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
            Read incoming messages and what ZAR flagged for attention.
          </p>
        </div>
        <ChevronRight size={16} className="shrink-0 text-white/40" />
      </button>

      {(gapsData?.gaps || []).map((gap) => (
        <IntegrationGapCard
          key={gap.id}
          gap={gap}
          isAdmin={Boolean(connectCategories?.isAdmin)}
          onManage={() => navigate("/admin")}
          onAddCredentials={() => {
            setSecretsPrefill(`${gap.label} access`);
            document.getElementById("secrets-vault")?.scrollIntoView({ behavior: "smooth" });
          }}
          onDismiss={() => dismissGap.mutate(gap.id)}
        />
      ))}

      {capabilityIntegrations && capabilityIntegrations.integrations.length > 0 && (
        <section>
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            ZCOS Capability Requirements
          </div>
          <div className="space-y-2">
            {capabilityIntegrations.integrations.map((integration) => (
              <div key={integration.id} className="zar-glass flex items-center justify-between gap-3 rounded-xl p-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-white">
                    {CAPABILITY_INTEGRATION_LABELS[integration.id] || integration.id}
                  </div>
                  <div className="mt-0.5 truncate text-[10.5px] text-white/35">
                    Required by {integration.requiredBy.join(", ")}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9.5px] uppercase ${integration.connected ? STATUS_CLS.connected : STATUS_CLS.disconnected}`}>
                  {integration.connected ? "connected" : "not connected"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {connectCategories && connectCategories.categories.length > 0 && (
        <section>
          <div className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Business &amp; Platform Integrations
          </div>
          <div className="space-y-2">
            {connectCategories.categories.map((category) => (
              <div key={category.id} className="zar-glass flex items-center justify-between gap-2 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-white">{category.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[9.5px] uppercase ${category.connected ? STATUS_CLS.connected : STATUS_CLS.disconnected}`}>
                    {category.connected ? `connected${category.accountCount > 1 ? ` (${category.accountCount})` : ""}` : category.status}
                  </span>
                </div>
                {connectCategories.isAdmin ? (
                  <button className="zar-button rounded-lg px-2.5 py-1 text-[11.5px]" onClick={() => navigate("/admin")}>
                    Manage
                  </button>
                ) : (
                  <span className="flex items-center gap-1 text-[10.5px] text-white/35">
                    <Lock size={11} /> Admin-managed
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
