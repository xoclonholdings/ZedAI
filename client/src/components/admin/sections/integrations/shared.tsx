import type { ReactNode } from "react";

import type { IntegrationKey } from "@/components/admin/types";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface IntegrationsSettings {
  [key: string]: any;
}

export interface CustomIntegrationField {
  key: string;
  value: string;
  isSecret?: boolean;
}

export interface CustomIntegrationDraft {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  fields: CustomIntegrationField[];
}

/** Which integrations use the multi-account pattern. */
export const ACCOUNT_INTEGRATIONS = new Set<IntegrationKey>(["github", "email", "google"]);

export const ACCOUNT_TEMPLATES = {
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
    fromName: "ZAR",
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

export function accountLabelSingular(key: IntegrationKey) {
  if (key === "github") return "repo";
  if (key === "email") return "sender";
  if (key === "google") return "Google account";
  return "account";
}

export function accountLabelPlural(key: IntegrationKey) {
  if (key === "github") return "repos";
  if (key === "email") return "senders";
  if (key === "google") return "Google accounts";
  return "accounts";
}

export function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1 block">
      <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

export function EmptyIntegrationCard() {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-6 text-center text-sm text-muted-foreground">
      Not available yet.
    </div>
  );
}

export function saveButtonLabel(status: SaveStatus): string {
  if (status === "saving") return "Saving…";
  if (status === "saved") return "Saved";
  if (status === "error") return "Save failed";
  return "Save";
}
