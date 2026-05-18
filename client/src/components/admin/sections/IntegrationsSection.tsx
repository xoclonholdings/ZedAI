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
      <div>
        <h2 className="text-lg font-semibold">Integrations</h2>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(integrationMeta) as IntegrationKey[]).map((key) => {
          const meta = integrationMeta[key];
          const Icon = meta.icon as LucideIcon;
          const isActive = active === key;
          return (
            <button
              key={key}
              onClick={() => {
                setActive(key);
                setEditingAccount(null);
              }}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs transition-all ${
                isActive
                  ? "border-cyan-400/40 bg-white/10 text-white"
                  : "border-white/10 bg-black/20 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={12} className={isActive ? "text-cyan-300" : ""} />
              <span>{meta.label}</span>
            </button>
          );
        })}
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
    </>
  );
}
