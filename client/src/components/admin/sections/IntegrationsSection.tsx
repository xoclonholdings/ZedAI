import { useEffect, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  integrationMeta,
  StatusDot,
  type IntegrationKey,
} from "@/components/admin/types";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface IntegrationsSettings {
  [key: string]: any;
}

/** Which integrations now use the multi-account pattern. */
const ACCOUNT_INTEGRATIONS = new Set<IntegrationKey>(["github", "email", "google"]);

interface CustomIntegrationField {
  key: string;
  value: string;
  isSecret?: boolean;
}
interface CustomIntegrationDraft {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  fields: CustomIntegrationField[];
}

export default function IntegrationsSection() {
  const [draft, setDraft] = useState<IntegrationsSettings | null>(null);
  const [active, setActive] = useState<IntegrationKey>("aiHost");
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [aiHostStatus, setAiHostStatus] = useState<any>(null);
  const [aiHostTest, setAiHostTest] = useState<{
    status: "idle" | "testing" | "ok" | "error";
    detail?: string;
    payload?: any;
  }>({ status: "idle" });
  const [editingAccount, setEditingAccount] = useState<string | null>(null);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setDraft(data.integrations);
      }
    } catch {}
    setLoading(false);
  }

  async function fetchAiHostStatus() {
    try {
      const res = await fetch("/api/admin/system-status", { credentials: "include" });
      if (res.ok) setAiHostStatus(await res.json());
    } catch {}
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
      } catch {}
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
          onChange={(items) =>
            setDraft((prev: any) => ({ ...prev, custom: items }))
          }
          onSave={async () => {
            setSaveStatus("saving");
            try {
              const res = await fetch("/api/admin/settings/integrations", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ custom: draft?.custom || [] }),
              });
              if (!res.ok) throw new Error("save failed");
              const updated = await res.json();
              setDraft((prev: any) => ({ ...prev, custom: updated.custom || [] }));
              setSaveStatus("saved");
              setTimeout(() => setSaveStatus("idle"), 2000);
            } catch {
              setSaveStatus("error");
            }
          }}
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
          integrationKey={active}
          draft={selectedDraft}
          onUpdate={updateActiveField}
          onSave={save}
          saveStatus={saveStatus}
        />
      )}
    </>
  );
}

const ACCOUNT_TEMPLATES = {
  github: {
    label: "New repo",
    owner: "",
    repo: "",
    defaultBranch: "main",
    token: "",
    hasToken: false,
  },
  email: {
    label: "New sender",
    provider: "smtp",
    fromName: "ZED",
    fromAddress: "",
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    username: "",
    password: "",
    hasPassword: false,
  },
  google: {
    label: "New Google account",
    email: "",
    clientId: "",
    clientSecret: "",
    refreshToken: "",
    hasCredentials: false,
    scopes: ["https://www.googleapis.com/auth/gmail.send"],
  },
} as const;

function EmptyIntegrationCard() {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-6 text-center text-sm text-muted-foreground">
      Not available yet.
    </div>
  );
}

function MultiAccountPanel({
  integrationKey,
  draft,
  editingAccount,
  onSetEditing,
  onToggleEnabled,
  onAdd,
  onRemove,
  onAccountUpdate,
  onSave,
  saveStatus,
}: {
  integrationKey: IntegrationKey;
  draft: any;
  editingAccount: string | null;
  onSetEditing: (id: string | null) => void;
  onToggleEnabled: (v: boolean) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onAccountUpdate: (id: string, patch: any) => void;
  onSave: () => void;
  saveStatus: SaveStatus;
}) {
  const accounts = draft?.accounts || [];
  const meta = integrationMeta[integrationKey];

  return (
    <div className="space-y-3">
      {/* Top bar: enabled toggle + add */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
        <button
          type="button"
          onClick={() => onToggleEnabled(!draft?.enabled)}
          className="flex items-center gap-2 text-sm"
        >
          <span
            className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
              draft?.enabled ? "justify-end bg-emerald-500/60" : "justify-start bg-white/15"
            }`}
          >
            <span className="h-4 w-4 rounded-full bg-white shadow" />
          </span>
          <span>{draft?.enabled ? "Enabled" : "Disabled"}</span>
        </button>
        <Button
          size="sm"
          onClick={onAdd}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 h-8"
        >
          <Plus size={13} className="mr-1" />
          Add {accountLabelSingular(integrationKey)}
        </Button>
      </div>

      {/* Accounts list */}
      {accounts.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-black/20 p-6 text-center">
          <p className="text-sm text-foreground">No {accountLabelPlural(integrationKey)} yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tap <strong>Add {accountLabelSingular(integrationKey)}</strong> to wire one up.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((acc: any) => (
            <AccountRow
              key={acc.id}
              integrationKey={integrationKey}
              account={acc}
              expanded={editingAccount === acc.id}
              onToggle={() =>
                onSetEditing(editingAccount === acc.id ? null : acc.id)
              }
              onUpdate={(patch) => onAccountUpdate(acc.id, patch)}
              onRemove={() => onRemove(acc.id)}
            />
          ))}
        </div>
      )}

      {/* Save bar */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          onClick={onSave}
          className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          {saveStatus === "saving"
            ? "Saving…"
            : saveStatus === "saved"
              ? "Saved"
              : saveStatus === "error"
                ? "Save failed"
                : "Save"}
        </Button>
      </div>
    </div>
  );
}

function accountLabelSingular(key: IntegrationKey) {
  if (key === "github") return "repo";
  if (key === "email") return "sender";
  if (key === "google") return "Google account";
  return "account";
}
function accountLabelPlural(key: IntegrationKey) {
  if (key === "github") return "repos";
  if (key === "email") return "senders";
  if (key === "google") return "Google accounts";
  return "accounts";
}

function AccountRow({
  integrationKey,
  account,
  expanded,
  onToggle,
  onUpdate,
  onRemove,
}: {
  integrationKey: IntegrationKey;
  account: any;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (patch: any) => void;
  onRemove: () => void;
}) {
  const secretFilled =
    integrationKey === "github"
      ? !!account.hasToken
      : integrationKey === "email"
        ? !!account.hasPassword
        : integrationKey === "google"
          ? !!account.hasCredentials
          : false;

  const primary =
    integrationKey === "github"
      ? `${account.owner || "?"}/${account.repo || "?"}`
      : integrationKey === "email"
        ? account.fromAddress || account.username || "—"
        : integrationKey === "google"
          ? account.email || "—"
          : "—";

  return (
    <div className="rounded-xl border border-white/10 bg-black/30">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center">
          {secretFilled ? (
            <CheckCircle2 size={14} className="text-emerald-300" />
          ) : (
            <XCircle size={14} className="text-yellow-300" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{account.label || "Untitled"}</div>
          <div className="text-[11px] text-muted-foreground font-mono truncate">{primary}</div>
        </div>
        <Pencil size={13} className="text-muted-foreground" />
      </button>

      {expanded && (
        <div className="space-y-2.5 border-t border-white/10 px-3 pt-2.5 pb-3">
          {integrationKey === "github" && (
            <GitHubAccountForm account={account} onUpdate={onUpdate} />
          )}
          {integrationKey === "email" && (
            <EmailAccountForm account={account} onUpdate={onUpdate} />
          )}
          {integrationKey === "google" && (
            <GoogleAccountForm account={account} onUpdate={onUpdate} />
          )}
          <div className="flex justify-between items-center pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-red-300 hover:text-red-200 hover:bg-red-500/10 h-7 text-xs"
            >
              <Trash2 size={12} className="mr-1" />
              Remove
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onToggle} className="h-7 text-xs">
              <X size={12} className="mr-1" />
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1 block">
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function GitHubAccountForm({
  account,
  onUpdate,
}: {
  account: any;
  onUpdate: (patch: any) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <FieldRow label="Label">
        <Input
          value={account.label || ""}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="border-white/10 bg-black/30 text-sm h-9"
          placeholder="Personal repos"
        />
      </FieldRow>
      <FieldRow label="Default branch">
        <Input
          value={account.defaultBranch || ""}
          onChange={(e) => onUpdate({ defaultBranch: e.target.value })}
          className="border-white/10 bg-black/30 text-sm h-9"
          placeholder="main"
        />
      </FieldRow>
      <FieldRow label="Owner">
        <Input
          value={account.owner || ""}
          onChange={(e) => onUpdate({ owner: e.target.value })}
          className="border-white/10 bg-black/30 text-sm h-9 font-mono"
          placeholder="xoclonholdings"
        />
      </FieldRow>
      <FieldRow label="Repo">
        <Input
          value={account.repo || ""}
          onChange={(e) => onUpdate({ repo: e.target.value })}
          className="border-white/10 bg-black/30 text-sm h-9 font-mono"
          placeholder="ZedAI"
        />
      </FieldRow>
      <div className="col-span-2">
        <FieldRow label={account.hasToken ? "Token (saved)" : "Token"}>
          <Input
            type="password"
            value={account.token || ""}
            onChange={(e) => onUpdate({ token: e.target.value })}
            className="border-white/10 bg-black/30 text-sm h-9 font-mono"
            placeholder={account.hasToken ? "•••••• — paste to replace" : "ghp_…"}
          />
        </FieldRow>
      </div>
    </div>
  );
}

function EmailAccountForm({
  account,
  onUpdate,
}: {
  account: any;
  onUpdate: (patch: any) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <FieldRow label="Label">
        <Input
          value={account.label || ""}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="border-white/10 bg-black/30 text-sm h-9"
          placeholder="Personal Gmail"
        />
      </FieldRow>
      <FieldRow label="Provider">
        <select
          value={account.provider || "smtp"}
          onChange={(e) => onUpdate({ provider: e.target.value })}
          className="w-full h-9 rounded-md border border-white/10 bg-black/30 px-2 text-sm"
        >
          <option value="smtp">SMTP</option>
          <option value="gmail">Gmail</option>
          <option value="outlook">Outlook</option>
          <option value="icloud">iCloud</option>
          <option value="custom">Custom</option>
        </select>
      </FieldRow>
      <FieldRow label="From name">
        <Input
          value={account.fromName || ""}
          onChange={(e) => onUpdate({ fromName: e.target.value })}
          className="border-white/10 bg-black/30 text-sm h-9"
          placeholder="ZED"
        />
      </FieldRow>
      <FieldRow label="From address">
        <Input
          type="email"
          value={account.fromAddress || ""}
          onChange={(e) => onUpdate({ fromAddress: e.target.value })}
          className="border-white/10 bg-black/30 text-sm h-9"
          placeholder="zed@example.com"
        />
      </FieldRow>
      <FieldRow label="SMTP host">
        <Input
          value={account.smtpHost || ""}
          onChange={(e) => onUpdate({ smtpHost: e.target.value })}
          className="border-white/10 bg-black/30 text-sm h-9 font-mono"
          placeholder="smtp.gmail.com"
        />
      </FieldRow>
      <FieldRow label="Port">
        <Input
          type="number"
          value={account.smtpPort || 587}
          onChange={(e) => onUpdate({ smtpPort: Number(e.target.value) || 587 })}
          className="border-white/10 bg-black/30 text-sm h-9 font-mono"
        />
      </FieldRow>
      <FieldRow label="Username">
        <Input
          value={account.username || ""}
          onChange={(e) => onUpdate({ username: e.target.value })}
          className="border-white/10 bg-black/30 text-sm h-9 font-mono"
        />
      </FieldRow>
      <FieldRow label={account.hasPassword ? "Password (saved)" : "Password"}>
        <Input
          type="password"
          value={account.password || ""}
          onChange={(e) => onUpdate({ password: e.target.value })}
          className="border-white/10 bg-black/30 text-sm h-9 font-mono"
          placeholder={account.hasPassword ? "•••••• — paste to replace" : "app password"}
        />
      </FieldRow>
    </div>
  );
}

function GoogleAccountForm({
  account,
  onUpdate,
}: {
  account: any;
  onUpdate: (patch: any) => void;
}) {
  const toggleScope = (scope: string) => {
    const next = (account.scopes || []).includes(scope)
      ? (account.scopes || []).filter((s: string) => s !== scope)
      : [...(account.scopes || []), scope];
    onUpdate({ scopes: next });
  };
  const COMMON_SCOPES: Array<{ key: string; label: string }> = [
    { key: "https://www.googleapis.com/auth/gmail.send", label: "Gmail send" },
    { key: "https://www.googleapis.com/auth/gmail.readonly", label: "Gmail read" },
    { key: "https://www.googleapis.com/auth/calendar", label: "Calendar" },
    { key: "https://www.googleapis.com/auth/drive.readonly", label: "Drive read" },
  ];
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <FieldRow label="Label">
          <Input
            value={account.label || ""}
            onChange={(e) => onUpdate({ label: e.target.value })}
            className="border-white/10 bg-black/30 text-sm h-9"
            placeholder="Personal Gmail"
          />
        </FieldRow>
        <FieldRow label="Google email">
          <Input
            type="email"
            value={account.email || ""}
            onChange={(e) => onUpdate({ email: e.target.value })}
            className="border-white/10 bg-black/30 text-sm h-9"
            placeholder="you@gmail.com"
          />
        </FieldRow>
      </div>
      <FieldRow label="Client ID">
        <Input
          value={account.clientId || ""}
          onChange={(e) => onUpdate({ clientId: e.target.value })}
          className="border-white/10 bg-black/30 text-sm h-9 font-mono"
          placeholder="123...apps.googleusercontent.com"
        />
      </FieldRow>
      <FieldRow label={account.hasCredentials ? "Client secret (saved)" : "Client secret"}>
        <Input
          type="password"
          value={account.clientSecret || ""}
          onChange={(e) => onUpdate({ clientSecret: e.target.value })}
          className="border-white/10 bg-black/30 text-sm h-9 font-mono"
          placeholder={account.hasCredentials ? "•••••• — paste to replace" : "GOCSPX-…"}
        />
      </FieldRow>
      <FieldRow label={account.hasCredentials ? "Refresh token (saved)" : "Refresh token"}>
        <Input
          type="password"
          value={account.refreshToken || ""}
          onChange={(e) => onUpdate({ refreshToken: e.target.value })}
          className="border-white/10 bg-black/30 text-sm h-9 font-mono"
          placeholder={account.hasCredentials ? "•••••• — paste to replace" : "1//…"}
        />
      </FieldRow>
      <FieldRow label="Scopes">
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {COMMON_SCOPES.map((s) => {
            const on = (account.scopes || []).includes(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggleScope(s.key)}
                className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
                  on
                    ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                    : "border-white/10 bg-black/20 text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </FieldRow>
    </div>
  );
}

function SimpleIntegrationPanel({
  integrationKey,
  draft,
  onUpdate,
  onSave,
  saveStatus,
}: {
  integrationKey: IntegrationKey;
  draft: any;
  onUpdate: (key: string, value: any) => void;
  onSave: () => void;
  saveStatus: SaveStatus;
}) {
  const meta = integrationMeta[integrationKey];
  const otherFields = Object.entries(draft).filter(
    ([key]) => !["enabled", "status", "notes", "accounts"].includes(key),
  );
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2 pb-1">
        <button
          type="button"
          onClick={() => onUpdate("enabled", !draft.enabled)}
          className="flex items-center gap-2 text-sm"
        >
          <span
            className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
              draft.enabled ? "justify-end bg-emerald-500/60" : "justify-start bg-white/15"
            }`}
          >
            <span className="h-4 w-4 rounded-full bg-white shadow" />
          </span>
          <span>{draft.enabled ? "Enabled" : "Disabled"}</span>
        </button>
        {"status" in draft && (
          <Badge
            variant="secondary"
            className="zed-glass border-white/10 text-[9px] uppercase tracking-[0.16em]"
          >
            {draft.status}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {otherFields.map(([key, value]) => {
          if (typeof value === "boolean") {
            return (
              <FieldRow key={key} label={humanize(key)}>
                <button
                  type="button"
                  onClick={() => onUpdate(key, !value)}
                  className="flex h-9 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-2 text-xs"
                >
                  <span
                    className={`flex h-4 w-7 items-center rounded-full p-0.5 ${
                      value ? "justify-end bg-emerald-500/60" : "justify-start bg-white/15"
                    }`}
                  >
                    <span className="h-3 w-3 rounded-full bg-white" />
                  </span>
                  <span>{value ? "On" : "Off"}</span>
                </button>
              </FieldRow>
            );
          }
          const isPort = key.toLowerCase().includes("port");
          const isSecret =
            key.toLowerCase().includes("token") ||
            key.toLowerCase().includes("password") ||
            key.toLowerCase().includes("apikey");
          return (
            <FieldRow key={key} label={humanize(key)}>
              <Input
                type={isSecret ? "password" : "text"}
                value={String(value ?? "")}
                onChange={(e) =>
                  onUpdate(key, isPort ? Number(e.target.value) || 0 : e.target.value)
                }
                className="border-white/10 bg-black/30 text-sm h-9"
                placeholder={isSecret ? "stored server-side or paste to replace" : ""}
              />
            </FieldRow>
          );
        })}
      </div>

      <Button
        onClick={onSave}
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
      >
        {saveStatus === "saving"
          ? "Saving…"
          : saveStatus === "saved"
            ? "Saved"
            : saveStatus === "error"
              ? "Save failed"
              : "Save"}
      </Button>
    </div>
  );
}

function humanize(s: string): string {
  return s.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

function AiHostPanel({
  status,
  test,
  onTest,
}: {
  status: any;
  test: {
    status: "idle" | "testing" | "ok" | "error";
    detail?: string;
    payload?: any;
  };
  onTest: () => void;
}) {
  const isOnline = status?.ollama?.status === "online";
  const providerLabel = status?.ollama?.provider || "—";
  const models: string[] = status?.ollama?.models || [];
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <Bot size={14} className="text-purple-300" />
          AI Host
        </div>
        <Button
          size="sm"
          variant="outline"
          className="zed-glass border-white/10 h-8"
          onClick={onTest}
          disabled={test.status === "testing"}
        >
          <RefreshCw
            size={13}
            className={`mr-1 ${test.status === "testing" ? "animate-spin" : ""}`}
          />
          {test.status === "testing" ? "Testing…" : "Test"}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusDot online={isOnline} />
        <span className="capitalize">{status?.ollama?.status || "unknown"}</span>
        <Badge
          variant="secondary"
          className="zed-glass border-white/10 text-[10px] uppercase tracking-[0.16em]"
        >
          {providerLabel}
        </Badge>
        {models.length > 0 && (
          <span className="font-mono text-xs text-muted-foreground truncate">
            {models[0]}
            {models.length > 1 ? ` +${models.length - 1}` : ""}
          </span>
        )}
      </div>
      {test.status === "ok" && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200">
          {test.detail}
        </div>
      )}
      {test.status === "error" && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-200 space-y-1.5">
          <pre className="whitespace-pre-wrap break-all font-mono leading-5">
            {test.detail || "Unknown error"}
          </pre>
          {test.payload && (
            <details>
              <summary className="cursor-pointer text-[10px] uppercase tracking-[0.18em] text-red-300/80">
                raw response
              </summary>
              <pre className="mt-1 overflow-x-auto rounded bg-black/40 p-2 text-[10px]">
                {JSON.stringify(test.payload, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function CustomIntegrationsPanel({
  items,
  onChange,
  onSave,
  saveStatus,
}: {
  items: CustomIntegrationDraft[];
  onChange: (items: CustomIntegrationDraft[]) => void;
  onSave: () => void;
  saveStatus: SaveStatus;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  function addIntegration() {
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const next = [
      ...items,
      { id, label: "New integration", description: "", enabled: false, fields: [] },
    ];
    onChange(next);
    setExpanded(id);
  }

  function patch(id: string, p: Partial<CustomIntegrationDraft>) {
    onChange(items.map((c) => (c.id === id ? { ...c, ...p } : c)));
  }

  function removeIntegration(id: string) {
    if (!window.confirm("Remove this integration?")) return;
    onChange(items.filter((c) => c.id !== id));
    if (expanded === id) setExpanded(null);
  }

  function addField(id: string) {
    const item = items.find((c) => c.id === id);
    if (!item) return;
    patch(id, { fields: [...(item.fields || []), { key: "", value: "", isSecret: false }] });
  }

  function patchField(id: string, idx: number, p: Partial<CustomIntegrationField>) {
    const item = items.find((c) => c.id === id);
    if (!item) return;
    const fields = (item.fields || []).map((f, i) => (i === idx ? { ...f, ...p } : f));
    patch(id, { fields });
  }

  function removeField(id: string, idx: number) {
    const item = items.find((c) => c.id === id);
    if (!item) return;
    patch(id, { fields: (item.fields || []).filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
        <span className="text-sm text-muted-foreground">
          {items.length} custom integration{items.length === 1 ? "" : "s"}
        </span>
        <Button
          size="sm"
          onClick={addIntegration}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 h-8"
        >
          <Plus size={13} className="mr-1" />
          Add integration
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-black/20 p-6 text-center">
          <p className="text-sm">No custom integrations yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Define one when you have a service ZED should know about — e.g. a webhook, a
            scraper, a third-party API.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/10 bg-black/30">
              <button
                type="button"
                onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                  {c.enabled ? (
                    <CheckCircle2 size={14} className="text-emerald-300" />
                  ) : (
                    <XCircle size={14} className="text-muted-foreground/70" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{c.label || "Untitled"}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {c.fields.length} field{c.fields.length === 1 ? "" : "s"}
                    {c.description ? ` · ${c.description}` : ""}
                  </div>
                </div>
                <Pencil size={13} className="text-muted-foreground" />
              </button>

              {expanded === c.id && (
                <div className="space-y-2.5 border-t border-white/10 px-3 pt-2.5 pb-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <FieldRow label="Label">
                      <Input
                        value={c.label}
                        onChange={(e) => patch(c.id, { label: e.target.value })}
                        className="border-white/10 bg-black/30 text-sm h-9"
                        placeholder="My webhook"
                      />
                    </FieldRow>
                    <FieldRow label="Enabled">
                      <button
                        type="button"
                        onClick={() => patch(c.id, { enabled: !c.enabled })}
                        className="flex h-9 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-2 text-xs"
                      >
                        <span
                          className={`flex h-4 w-7 items-center rounded-full p-0.5 ${
                            c.enabled
                              ? "justify-end bg-emerald-500/60"
                              : "justify-start bg-white/15"
                          }`}
                        >
                          <span className="h-3 w-3 rounded-full bg-white" />
                        </span>
                        <span>{c.enabled ? "On" : "Off"}</span>
                      </button>
                    </FieldRow>
                  </div>
                  <FieldRow label="Description">
                    <Input
                      value={c.description}
                      onChange={(e) => patch(c.id, { description: e.target.value })}
                      className="border-white/10 bg-black/30 text-sm h-9"
                      placeholder="What ZED should know about this integration"
                    />
                  </FieldRow>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        Fields
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => addField(c.id)}
                        className="h-7 text-xs text-cyan-300 hover:text-cyan-200"
                      >
                        <Plus size={12} className="mr-1" />
                        Add field
                      </Button>
                    </div>
                    {(c.fields || []).length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/70 italic">
                        No fields yet
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {(c.fields || []).map((f, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-1.5"
                          >
                            <Input
                              value={f.key}
                              onChange={(e) =>
                                patchField(c.id, idx, { key: e.target.value })
                              }
                              className="border-white/10 bg-black/30 text-xs h-8 w-32 font-mono"
                              placeholder="key"
                            />
                            <Input
                              type={f.isSecret ? "password" : "text"}
                              value={f.value}
                              onChange={(e) =>
                                patchField(c.id, idx, { value: e.target.value })
                              }
                              className="border-white/10 bg-black/30 text-xs h-8 flex-1"
                              placeholder={f.isSecret ? "secret value" : "value"}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                patchField(c.id, idx, { isSecret: !f.isSecret })
                              }
                              className={`rounded-md border px-1.5 py-1 text-[9px] uppercase tracking-[0.16em] transition-colors ${
                                f.isSecret
                                  ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-200"
                                  : "border-white/10 bg-black/20 text-muted-foreground"
                              }`}
                              title="Toggle secret"
                            >
                              {f.isSecret ? "secret" : "plain"}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeField(c.id, idx)}
                              className="text-muted-foreground hover:text-red-300"
                              aria-label="Remove field"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeIntegration(c.id)}
                      className="text-red-300 hover:text-red-200 hover:bg-red-500/10 h-7 text-xs"
                    >
                      <Trash2 size={12} className="mr-1" />
                      Remove integration
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpanded(null)}
                      className="h-7 text-xs"
                    >
                      <X size={12} className="mr-1" />
                      Close
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Button
        onClick={onSave}
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
      >
        {saveStatus === "saving"
          ? "Saving…"
          : saveStatus === "saved"
            ? "Saved"
            : saveStatus === "error"
              ? "Save failed"
              : "Save"}
      </Button>
    </div>
  );
}
