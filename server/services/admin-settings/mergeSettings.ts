import type { AdminSettings } from "../../../shared/adminSettings";
import {
  defaultAgentDefinitions,
  defaultAppSettings,
  defaultIntegrations,
  defaultPersonalizationSettings,
} from "../../../shared/adminSettings";

import { defaultAuthSettings, normalizeUsers } from "./auth-helpers";

/**
 * Merges raw settings from disk (which may be partial, missing
 * fields entirely, or use legacy shapes) into a fully-populated
 * AdminSettings object.
 *
 * The three multi-account integrations (github, email, google) get
 * a forward migration: if the file has the legacy single-account
 * fields populated but no `accounts` array, we seed the first
 * account from those legacy fields. After this pass, the in-memory
 * data is always in the multi-account shape.
 */
export function mergeSettings(raw: Partial<AdminSettings> | null | undefined): AdminSettings {
  const auth = {
    ...defaultAuthSettings(),
    ...(raw?.auth || {}),
  };

  return {
    auth,
    app: {
      ...defaultAppSettings,
      ...(raw?.app || {}),
    },
    personalization: {
      ...defaultPersonalizationSettings,
      ...(raw?.personalization || {}),
    },
    agents: raw?.agents?.length ? raw.agents : defaultAgentDefinitions,
    integrations: {
      ...defaultIntegrations,
      ...(raw?.integrations || {}),
      gusto: {
        ...defaultIntegrations.gusto,
        ...(raw?.integrations?.gusto || {}),
      },
      github: mergeGitHub(raw),
      email: mergeEmail(raw),
      google: mergeGoogle(raw),
      telephony: {
        ...defaultIntegrations.telephony,
        ...(raw?.integrations?.telephony || {}),
        hasApiKey: !!(
          raw?.integrations?.telephony?.apiKey || raw?.integrations?.telephony?.hasApiKey
        ),
      },
      firewall: {
        ...defaultIntegrations.firewall,
        ...(raw?.integrations?.firewall || {}),
        hasAuthToken: !!(
          raw?.integrations?.firewall?.authToken ||
          raw?.integrations?.firewall?.hasAuthToken
        ),
      },
      businessOperations: {
        ...defaultIntegrations.businessOperations,
        ...(raw?.integrations?.businessOperations || {}),
      },
      kalshi: {
        ...defaultIntegrations.kalshi,
        ...(raw?.integrations?.kalshi || {}),
      },
      voiceTranscription: {
        ...defaultIntegrations.voiceTranscription,
        ...(raw?.integrations?.voiceTranscription || {}),
      },
      custom: normalizeCustomIntegrations(raw),
    },
    users: normalizeUsers(auth, raw?.users),
  };
}

function mergeGitHub(raw: Partial<AdminSettings> | null | undefined) {
  const merged = {
    ...defaultIntegrations.github,
    ...(raw?.integrations?.github || {}),
    accounts: Array.isArray(raw?.integrations?.github?.accounts)
      ? raw!.integrations!.github!.accounts!
      : [],
    hasToken: !!(
      raw?.integrations?.github?.token || raw?.integrations?.github?.hasToken
    ),
  };

  // Migrate legacy single-repo fields → first account, only when no
  // multi-account entries exist yet but the legacy fields are set.
  if (
    merged.accounts.length === 0 &&
    (raw?.integrations?.github?.owner || raw?.integrations?.github?.repo)
  ) {
    merged.accounts = [
      {
        id: "github-account-primary",
        label: `${raw?.integrations?.github?.owner || ""}/${raw?.integrations?.github?.repo || ""}`,
        owner: raw?.integrations?.github?.owner || "",
        repo: raw?.integrations?.github?.repo || "",
        defaultBranch: raw?.integrations?.github?.defaultBranch || "main",
        token: raw?.integrations?.github?.token || "",
        hasToken: !!raw?.integrations?.github?.token,
      },
    ];
  }
  // Per-account hasToken flag is derived from token presence.
  merged.accounts = merged.accounts.map((acc: any) => ({
    ...acc,
    hasToken: !!(acc?.token || acc?.hasToken),
  }));
  return merged;
}

function mergeEmail(raw: Partial<AdminSettings> | null | undefined) {
  const merged = {
    ...defaultIntegrations.email,
    ...(raw?.integrations?.email || {}),
    accounts: Array.isArray(raw?.integrations?.email?.accounts)
      ? raw!.integrations!.email!.accounts!
      : [],
    hasPassword: !!(
      raw?.integrations?.email?.password || raw?.integrations?.email?.hasPassword
    ),
  };

  // Migrate legacy single-sender fields → first account.
  if (
    merged.accounts.length === 0 &&
    (raw?.integrations?.email?.fromAddress || raw?.integrations?.email?.username)
  ) {
    merged.accounts = [
      {
        id: "email-account-primary",
        label: raw?.integrations?.email?.fromAddress || "Primary sender",
        provider: raw?.integrations?.email?.provider || "smtp",
        fromName: raw?.integrations?.email?.fromName || "ZED",
        fromAddress: raw?.integrations?.email?.fromAddress || "",
        smtpHost: raw?.integrations?.email?.smtpHost || "smtp.mail.me.com",
        smtpPort: raw?.integrations?.email?.smtpPort || 587,
        username: raw?.integrations?.email?.username || "",
        password: raw?.integrations?.email?.password || "",
        hasPassword: !!raw?.integrations?.email?.password,
      },
    ];
  }
  merged.accounts = merged.accounts.map((acc: any) => ({
    ...acc,
    hasPassword: !!(acc?.password || acc?.hasPassword),
  }));
  if (!merged.notes) merged.notes = defaultIntegrations.email.notes;
  return merged;
}

function mergeGoogle(raw: Partial<AdminSettings> | null | undefined) {
  const merged = {
    ...defaultIntegrations.google,
    ...(raw?.integrations?.google || {}),
    accounts: Array.isArray(raw?.integrations?.google?.accounts)
      ? raw!.integrations!.google!.accounts!
      : [],
  };
  merged.accounts = merged.accounts.map((acc: any) => ({
    ...acc,
    scopes: Array.isArray(acc?.scopes) ? acc.scopes : [],
    hasCredentials: !!(
      (acc?.clientId && acc?.clientSecret && acc?.refreshToken) || acc?.hasCredentials
    ),
  }));
  return merged;
}

function normalizeCustomIntegrations(raw: Partial<AdminSettings> | null | undefined) {
  return Array.isArray((raw?.integrations as any)?.custom)
    ? ((raw?.integrations as any).custom as any[]).map((c) => ({
        id: c?.id || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        label: c?.label || "Custom integration",
        description: c?.description || "",
        enabled: !!c?.enabled,
        fields: Array.isArray(c?.fields)
          ? c.fields.map((f: any) => ({
              key: f?.key || "",
              value: f?.value || "",
              isSecret: !!f?.isSecret,
            }))
          : [],
      }))
    : [];
}
