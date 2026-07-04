import type { AdminSettings, VoiceSettings } from "../../../shared/adminSettings";
import {
  defaultAgentDefinitions,
  defaultAppSettings,
  defaultIntegrations,
  defaultPersonalizationSettings,
  defaultVoiceSettings,
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
      deployment: {
        ...defaultIntegrations.deployment,
        ...(raw?.integrations?.deployment || {}),
        hasAccessToken: !!(
          raw?.integrations?.deployment?.accessToken ||
          raw?.integrations?.deployment?.hasAccessToken
        ),
      },
      payments: {
        ...defaultIntegrations.payments,
        ...(raw?.integrations?.payments || {}),
        hasSecretKey: !!(
          raw?.integrations?.payments?.secretKey || raw?.integrations?.payments?.hasSecretKey
        ),
        hasWebhookSecret: !!(
          raw?.integrations?.payments?.webhookSecret ||
          raw?.integrations?.payments?.hasWebhookSecret
        ),
      },
      socialPublishing: {
        ...defaultIntegrations.socialPublishing,
        ...(raw?.integrations?.socialPublishing || {}),
        platforms: Array.isArray(raw?.integrations?.socialPublishing?.platforms)
          ? raw!.integrations!.socialPublishing!.platforms
          : defaultIntegrations.socialPublishing.platforms,
        hasAccessToken: !!(
          raw?.integrations?.socialPublishing?.accessToken ||
          raw?.integrations?.socialPublishing?.hasAccessToken
        ),
      },
      crm: {
        ...defaultIntegrations.crm,
        ...(raw?.integrations?.crm || {}),
        hasApiKey: !!(raw?.integrations?.crm?.apiKey || raw?.integrations?.crm?.hasApiKey),
      },
      accounting: {
        ...defaultIntegrations.accounting,
        ...(raw?.integrations?.accounting || {}),
        hasCredentials: !!(
          (raw?.integrations?.accounting?.clientId &&
            raw?.integrations?.accounting?.clientSecret &&
            raw?.integrations?.accounting?.refreshToken) ||
          raw?.integrations?.accounting?.hasCredentials
        ),
      },
      cloudStorage: {
        ...defaultIntegrations.cloudStorage,
        ...(raw?.integrations?.cloudStorage || {}),
        hasAccessToken: !!(
          raw?.integrations?.cloudStorage?.accessToken ||
          raw?.integrations?.cloudStorage?.hasAccessToken
        ),
      },
      tradingView: {
        ...defaultIntegrations.tradingView,
        ...(raw?.integrations?.tradingView || {}),
        hasAlertWebhookSecret: !!(
          raw?.integrations?.tradingView?.alertWebhookSecret ||
          raw?.integrations?.tradingView?.hasAlertWebhookSecret
        ),
      },
      marketData: {
        ...defaultIntegrations.marketData,
        ...(raw?.integrations?.marketData || {}),
        hasApiKey: !!(
          raw?.integrations?.marketData?.apiKey || raw?.integrations?.marketData?.hasApiKey
        ),
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
    voice: mergeVoiceSettings(raw?.voice),
  };
}

/**
 * Voice settings merge: apply defaults for any missing field, clamp
 * the formality slider to [0, 100], and force prohibitedPhrases to
 * an array of trimmed non-empty strings so the runtime prompt
 * builder doesn't have to defend against garbage.
 */
function mergeVoiceSettings(raw: Partial<VoiceSettings> | undefined | null): VoiceSettings {
  const source = raw || {};
  const formalityRaw =
    typeof source.formality === "number" ? source.formality : defaultVoiceSettings.formality;
  const formality = Math.max(0, Math.min(100, Math.round(formalityRaw)));

  const prohibitedPhrases = Array.isArray(source.prohibitedPhrases)
    ? source.prohibitedPhrases
        .map((p) => (typeof p === "string" ? p.trim() : ""))
        .filter(Boolean)
    : defaultVoiceSettings.prohibitedPhrases;

  return {
    tone: source.tone ?? defaultVoiceSettings.tone,
    formality,
    perspective: source.perspective ?? defaultVoiceSettings.perspective,
    responseLength: source.responseLength ?? defaultVoiceSettings.responseLength,
    showReasoning:
      typeof source.showReasoning === "boolean"
        ? source.showReasoning
        : defaultVoiceSettings.showReasoning,
    plainLanguage:
      typeof source.plainLanguage === "boolean"
        ? source.plainLanguage
        : defaultVoiceSettings.plainLanguage,
    codeBlocks:
      typeof source.codeBlocks === "boolean"
        ? source.codeBlocks
        : defaultVoiceSettings.codeBlocks,
    prohibitedPhrases,
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