import { CheckCircle2, Pencil, Plus, Trash2, X, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { IntegrationKey } from "@/components/admin/types";

import {
  EmailAccountForm,
  GitHubAccountForm,
  GoogleAccountForm,
} from "./account-forms";
import {
  accountLabelPlural,
  accountLabelSingular,
  saveButtonLabel,
  type SaveStatus,
} from "./shared";

export function MultiAccountPanel({
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

  return (
    <div className="space-y-3">
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
              onToggle={() => onSetEditing(editingAccount === acc.id ? null : acc.id)}
              onUpdate={(patch) => onAccountUpdate(acc.id, patch)}
              onRemove={() => onRemove(acc.id)}
            />
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button
          onClick={onSave}
          className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          {saveButtonLabel(saveStatus)}
        </Button>
      </div>
    </div>
  );
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
