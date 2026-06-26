import { useEffect, useState } from "react";
import { type LucideIcon } from "lucide-react";

import { integrationMeta, type IntegrationKey } from "@/components/admin/types";

import { AiHostPanel, type AiHostTestState } from "./integrations/AiHostPanel";
import { CustomIntegrationsPanel } from "./integrations/CustomIntegrationsPanel";
import { MultiAccountPanel } from "./integrations/MultiAccountPanel";
import { SimpleIntegrationPanel } from "./integrations/SimpleIntegrationPanel";
import {
  ACCOUNT_INTEGRATIONS,
  ACCOUNT_TEMPLATES,
  EmptyIntegrationCard,
  type CustomIntegrationDraft,
  type IntegrationsSettings,
  type SaveStatus,
} from "./integrations/shared";

const INTEGRATION_GROUPS: Array<{
  title: string;
  description: string;
  keys: IntegrationKey[];
}> = [
  {
    title: "Core System",
    description: "Model hosting, releases, repo access, firewall, and custom extensions.",
    keys: ["aiHost", "deployment", "github", "firewall", "custom"],
  },
  {
    title: "Communication",
    description: "Email, Google, phone, and voice inputs for ZED operations.",
    keys: ["email", "google", "telephony", "voiceTranscription"],
  },
  {
    title: "Business Ops",
    description: "Revenue, customers, payroll, files, campaigns, and business execution.",
    keys: [
      "businessOperations",
      "payments",
      "crm",
      "accounting",
      "gusto",
      "cloudStorage",
      "socialPublishing",
    ],
  },
  {
    title: "Trading & Finance",
    description: "Analysis-only market tooling for Phase 1 trading intelligence.",
    keys: ["tradingView", "marketData", "kalshi"],
  },
];

export default function IntegrationsSection() {
  const [draft, setDraft] = useState<IntegrationsSettings | null>(null);
  const [active, setActive] = useState<IntegrationKey>("aiHost");
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [aiHostStatus, setAiHostStatus] = useState<any>(null);
  const [aiHostTest, setAiHostTest] = useState<AiHostTestState>({ status: "idle" });
  const [editingAccount, setEditingAccount] = useState<string | null>(null);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setDraft(data.integrations);
      }
    } catch {
      /* ignore — surface via save status when the user retries */
    }
    setLoading(false);
  }

  async function fetchAiHostStatus() {
    try {
      const res = await fetch("/api/admin/system-status", { credentials: "include" });
      if (res.ok) setAiHostStatus(await res.json());
    } catch {
      /* ignore — the panel will just show "unknown" */
    }
  }

  useEffect(() => {
    void fetchSettings();
    void fetchAiHostStatus();
  }, []);

  async function save() {
    if (!draft) return;
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/admin/settings/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ [active]: draft[active] }),
      });
      if (!res.ok) throw new Error("save failed");
      const updated = await res.json();
      setDraft((prev: any) => ({ ...prev, [active]: updated[active] }));
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
    }
  }

  async function saveCustom(items: CustomIntegrationDraft[]) {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/admin/settings/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ custom: items }),
      });
      if (!res.ok) throw new Error("save failed");
      const updated = await res.json();
      setDraft((prev: any) => ({ ...prev, custom: updated.custom || [] }));
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
    }
  }

  function updateActiveField(key: string, value: any) {
    setDraft((prev: any) => ({
      ...prev,
      [active]: { ...prev?.[active], [key]: value },
    }));
    setSaveStatus("idle");
  }

  function updateAccount(accountId: string, patch: any) {
    setDraft((prev: any) => ({
      ...prev,
      [active]: {
        ...prev?.[active],
        accounts: (prev?.[active]?.accounts || []).map((a: any) =>
          a.id === accountId ? { ...a, ...patch } : a,
        ),
      },
    }));
    setSaveStatus("idle");
  }

  function addAccount() {
    const id = `${active}-${Date.now()}`;
    const template = ACCOUNT_TEMPLATES[active as keyof typeof ACCOUNT_TEMPLATES];
    if (!template) return;
    const newAccount = { ...template, id };
    setDraft((prev: any) => ({
      ...prev,
      [active]: {
        ...prev?.[active],
        accounts: [...(prev?.[active]?.accounts || []), newAccount],
      },
    }));
    setEditingAccount(id);
    setSaveStatus("idle");
  }

  function removeAccount(accountId: string) {
    if (!window.confirm("Remove this account?")) return;
    setDraft((prev: any) => ({
      ...prev,
      [active]: {
        ...prev?.[active],
        accounts: (prev?.[active]?.accounts || []).filter((a: any) => a.id !== accountId),
      },
    }));
    setEditingAccount(null);
    setSaveStatus("idle");
  }

  async function testAiHost() {
    setAiHostTest({ status: "testing" });
    try {
      const res = await fetch("/api/admin/ai-host/test", {
        method: "POST",
        credentials: "include",
      });
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        /* upstream may return non-JSON on failure */
      }
      if (!res.ok) {
        setAiHostTest({
          status: "error",
          detail: data?.error || `HTTP ${res.status}`,
          payload: data,
        });
        return;
      }
      if (data?.chat?.status === "ok") {
        setAiHostTest({ status: "ok", detail: data.chat.reply, payload: data });
      } else {
        setAiHostTest({
          status: "error",
          detail: data?.chat?.error || "Provider returned an error.",
          payload: data,
        });
      }
      await fetchAiHostStatus();
    } catch (e: any) {
      setAiHostTest({
        status: "error",
        detail: e?.message || "Network error",
      });
    }
  }

  const selectedDraft = draft?.[active];

  return (
    <>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Integrations</h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Connect ZED to the systems it can operate with. Use setup links where available; secrets stay server-side.
        </p>
      </div>

      <div className="space-y-3">
        {INTEGRATION_GROUPS.map((group) => (
          <div key={group.title} className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="mb-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {group.title}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {group.description}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {group.keys.map((key) => (
                <IntegrationCard
                  key={key}
                  integrationKey={key}
                  active={active === key}
                  draft={draft}
                  onSelect={() => {
                    setActive(key);
                    setEditingAccount(null);
                    setSaveStatus("idle");
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">{integrationMeta[active].label}</div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {integrationMeta[active].description}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {integrationStatusLabel(active, draft)}
          </span>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground py-8 text-sm">Loading…</div>
        ) : active === "aiHost" ? (
          <AiHostPanel status={aiHostStatus} test={aiHostTest} onTest={testAiHost} />
        ) : active === "custom" ? (
          <CustomIntegrationsPanel
            items={(draft?.custom || []) as CustomIntegrationDraft[]}
            onChange={(items) => setDraft((prev: any) => ({ ...prev, custom: items }))}
            onSave={() => saveCustom((draft?.custom || []) as CustomIntegrationDraft[])}
            saveStatus={saveStatus}
          />
        ) : ACCOUNT_INTEGRATIONS.has(active) ? (
          <MultiAccountPanel
            integrationKey={active}
            draft={selectedDraft}
            editingAccount={editingAccount}
            onSetEditing={setEditingAccount}
            onToggleEnabled={(v) => updateActiveField("enabled", v)}
            onAdd={addAccount}
            onRemove={removeAccount}
            onAccountUpdate={updateAccount}
            onSave={save}
            saveStatus={saveStatus}
          />
        ) : !selectedDraft ? (
          <EmptyIntegrationCard />
        ) : (
          <SimpleIntegrationPanel
            draft={selectedDraft}
            onUpdate={updateActiveField}
            onSave={save}
            saveStatus={saveStatus}
          />
        )}
      </div>
    </>
  );
}

function IntegrationCard({
  integrationKey,
  active,
  draft,
  onSelect,
}: {
  integrationKey: IntegrationKey;
  active: boolean;
  draft: IntegrationsSettings | null;
  onSelect: () => void;
}) {
  const meta = integrationMeta[integrationKey];
  const Icon = meta.icon as LucideIcon;
  const enabled = integrationEnabled(integrationKey, draft);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-h-[76px] items-start gap-2 rounded-xl border p-3 text-left transition-all ${
        active
          ? "border-cyan-400/40 bg-white/10 text-white"
          : "border-white/10 bg-black/20 text-muted-foreground hover:border-white/20 hover:text-foreground"
      }`}
    >
      <Icon size={15} className={active ? "mt-0.5 text-cyan-300" : "mt-0.5"} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">{meta.label}</span>
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${enabled ? "bg-emerald-400" : "bg-white/20"}`}
          />
        </span>
        <span className="mt-1 line-clamp-2 block text-[11px] leading-relaxed text-muted-foreground">
          {meta.description}
        </span>
      </span>
    </button>
  );
}

function integrationEnabled(key: IntegrationKey, draft: IntegrationsSettings | null): boolean {
  if (key === "custom") return !!draft?.custom?.length;
  if (key === "aiHost") return true;
  return !!draft?.[key]?.enabled;
}

function integrationStatusLabel(key: IntegrationKey, draft: IntegrationsSettings | null): string {
  if (key === "custom") return `${draft?.custom?.length || 0} custom`;
  if (key === "aiHost") return "system";
  const selected = draft?.[key];
  if (!selected) return "not loaded";
  if (selected.status) return selected.status;
  if (ACCOUNT_INTEGRATIONS.has(key)) return `${selected.accounts?.length || 0} connected`;
  return selected.enabled ? "enabled" : "disabled";
}
