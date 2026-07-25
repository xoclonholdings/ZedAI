import type {
  AdminSettings,
  ApprovalMode,
  ApprovalSettings,
  VoiceSettings,
} from "../../../shared/adminSettings";
import {
  defaultAgentDefinitions,
  defaultApprovalSettings,
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
  const auth = normalizeAuthSettings(raw?.auth);

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
      deployment: mergeDeployment(raw),
      payments: mergePayments(raw),
      socialPublishing: mergeSocialPublishing(raw),
      crm: mergeCrm(raw),
      accounting: mergeAccounting(raw),
      cloudStorage: mergeCloudStorage(raw),
      marketData: mergeMarketData(raw),
      telephony: {
        ...defaultIntegrations.telephony,
        ...(raw?.integrations?.telephony || {}),
        // Derived purely from the secret's presence, not OR'd with the
        // previously-stored flag: this same pipeline is the only writer
        // of hasApiKey, so an OR'd fallback can only ever latch true and
        // would never let a Disconnect show as disconnected again.
        hasApiKey: !!raw?.integrations?.telephony?.apiKey,
      },
      firewall: {
        ...defaultIntegrations.firewall,
        ...(raw?.integrations?.firewall || {}),
        hasAuthToken: !!raw?.integrations?.firewall?.authToken,
      },
      businessOperations: {
        ...defaultIntegrations.businessOperations,
        ...(raw?.integrations?.businessOperations || {}),
      },
      tradingView: {
        ...defaultIntegrations.tradingView,
        ...(raw?.integrations?.tradingView || {}),
        hasAlertWebhookSecret: !!raw?.integrations?.tradingView?.alertWebhookSecret,
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
    approvals: mergeApprovalSettings(raw?.approvals),
  };
}

function normalizeAuthSettings(rawAuth: Partial<AdminSettings["auth"]> | undefined) {
  const defaults = defaultAuthSettings();
  const auth = {
    ...defaults,
    ...(rawAuth || {}),
  };

  // Migrate the old dev defaults that caused long local lockouts.
  if (auth.maxFailedAttempts === 3) auth.maxFailedAttempts = defaults.maxFailedAttempts;
  if (auth.lockoutDurationMinutes === 15) {
    auth.lockoutDurationMinutes = defaults.lockoutDurationMinutes;
  }

  auth.maxFailedAttempts = Math.max(1, Math.round(Number(auth.maxFailedAttempts) || defaults.maxFailedAttempts));
  auth.lockoutDurationMinutes = Math.max(
    1,
    Math.round(Number(auth.lockoutDurationMinutes) || defaults.lockoutDurationMinutes),
  );

  return auth;
}

/**
 * Approval settings merge: apply defaults for any missing category,
 * clamp unknown modes to "ask" (the safe default) so a bad on-disk
 * value never sneaks through as "auto" (would silently start doing
 * things without asking).
 */
function mergeApprovalSettings(
  raw: Partial<ApprovalSettings> | undefined | null,
): ApprovalSettings {
  const source = raw || {};
  const validModes: readonly ApprovalMode[] = ["auto", "ask", "never"];
  const normalize = (
    key: keyof ApprovalSettings,
    fallback: ApprovalMode,
  ): ApprovalMode => {
    const value = (source as Record<string, unknown>)[key];
    if (typeof value !== "string") return fallback;
    return validModes.includes(value as ApprovalMode)
      ? (value as ApprovalMode)
      : "ask";
  };
  return {
    sendEmail: normalize("sendEmail", defaultApprovalSettings.sendEmail),
    scheduleCalendar: normalize("scheduleCalendar", defaultApprovalSettings.scheduleCalendar),
    cancelAppointment: normalize(
      "cancelAppointment",
      defaultApprovalSettings.cancelAppointment,
    ),
    sendMessage: normalize("sendMessage", defaultApprovalSettings.sendMessage),
    reachOutToContacts: normalize(
      "reachOutToContacts",
      defaultApprovalSettings.reachOutToContacts,
    ),
    postToSocial: normalize("postToSocial", defaultApprovalSettings.postToSocial),
    publishContent: normalize("publishContent", defaultApprovalSettings.publishContent),
    makePayment: normalize("makePayment", defaultApprovalSettings.makePayment),
    sendInvoice: normalize("sendInvoice", defaultApprovalSettings.sendInvoice),
    deleteData: normalize("deleteData", defaultApprovalSettings.deleteData),
    updateCredentials: normalize(
      "updateCredentials",
      defaultApprovalSettings.updateCredentials,
    ),
    deployCode: normalize("deployCode", defaultApprovalSettings.deployCode),
    createTask: normalize("createTask", defaultApprovalSettings.createTask),
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
    hasToken: !!raw?.integrations?.github?.token,
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
  // Per-account hasToken flag is derived purely from token presence —
  // never OR'd with the account's own stored hasToken, which would
  // latch true forever and make Disconnect stop showing as cleared.
  merged.accounts = merged.accounts.map((acc: any) => ({
    ...acc,
    hasToken: !!acc?.token,
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
    hasPassword: !!raw?.integrations?.email?.password,
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
    hasPassword: !!acc?.password,
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
    hasCredentials: !!(acc?.clientId && acc?.clientSecret && acc?.refreshToken),
  }));
  return merged;
}

/**
 * Shared migration helper for the seven integration groups that can
 * hold more than one connectable provider (deployment, payments,
 * social publishing, CRM, accounting, cloud storage, market data).
 * Each provider gets its own account entry so connecting a second
 * provider in the group can't clobber the first. Legacy single-slot
 * fields (written before accounts existed) seed the first account
 * once, so an existing connection isn't dropped by this migration.
 */
function mergeMultiProviderGroup<T extends Record<string, any>>(
  defaultGroup: T,
  rawGroup: Record<string, any> | null | undefined,
  buildLegacyAccount: (raw: Record<string, any>) => Record<string, any> | null,
  deriveFlags: (acc: Record<string, any>) => Record<string, any>,
): T {
  const merged: Record<string, any> = {
    ...defaultGroup,
    ...(rawGroup || {}),
    accounts: Array.isArray(rawGroup?.accounts) ? rawGroup!.accounts : [],
  };
  if (merged.accounts.length === 0) {
    const legacy = buildLegacyAccount(rawGroup || {});
    if (legacy) merged.accounts = [legacy];
  }
  merged.accounts = merged.accounts.map((acc: Record<string, any>) => ({
    ...acc,
    ...deriveFlags(acc),
  }));
  return merged as T;
}

function mergeDeployment(raw: Partial<AdminSettings> | null | undefined) {
  const rawGroup = raw?.integrations?.deployment;
  return mergeMultiProviderGroup(
    defaultIntegrations.deployment,
    rawGroup,
    (legacy) =>
      legacy.accessToken
        ? {
            id: `deployment-${legacy.provider || "netlify"}`,
            label: legacy.provider || "Deployment",
            provider: legacy.provider || "netlify",
            dashboardUrl: legacy.dashboardUrl || "",
            apiBaseUrl: legacy.apiBaseUrl || "",
            siteId: legacy.siteId || "",
            serviceId: legacy.serviceId || "",
            accessToken: legacy.accessToken,
          }
        : null,
    (acc) => ({ hasAccessToken: !!acc.accessToken }),
  );
}

function mergePayments(raw: Partial<AdminSettings> | null | undefined) {
  const rawGroup = raw?.integrations?.payments;
  return mergeMultiProviderGroup(
    defaultIntegrations.payments,
    rawGroup,
    (legacy) =>
      legacy.secretKey
        ? {
            id: `payments-${legacy.provider || "stripe"}`,
            label: legacy.provider || "Payments",
            provider: legacy.provider || "stripe",
            dashboardUrl: legacy.dashboardUrl || "",
            publishableKey: legacy.publishableKey || "",
            secretKey: legacy.secretKey,
            webhookSecret: legacy.webhookSecret || "",
          }
        : null,
    (acc) => ({
      hasSecretKey: !!acc.secretKey,
      hasWebhookSecret: !!acc.webhookSecret,
    }),
  );
}

function mergeSocialPublishing(raw: Partial<AdminSettings> | null | undefined) {
  const rawGroup = raw?.integrations?.socialPublishing;
  const merged = mergeMultiProviderGroup(
    defaultIntegrations.socialPublishing,
    rawGroup,
    (legacy) =>
      legacy.accessToken
        ? {
            id: "social-twitter",
            label: "Twitter / X",
            platform: "twitter",
            dashboardUrl: legacy.dashboardUrl || "",
            accessToken: legacy.accessToken,
          }
        : null,
    // "Connected" covers both auth methods: a pasted token (Twitter)
    // or a signed-in browser session (credential-based providers).
    (acc) => ({ hasAccessToken: !!(acc.accessToken || acc.sessionState) }),
  );
  merged.platforms = Array.isArray(rawGroup?.platforms)
    ? rawGroup!.platforms
    : defaultIntegrations.socialPublishing.platforms;
  return merged;
}

function mergeCrm(raw: Partial<AdminSettings> | null | undefined) {
  const rawGroup = raw?.integrations?.crm;
  return mergeMultiProviderGroup(
    defaultIntegrations.crm,
    rawGroup,
    (legacy) =>
      legacy.apiKey
        ? {
            id: `crm-${legacy.provider || "hubspot"}`,
            label: legacy.provider || "CRM",
            provider: legacy.provider || "hubspot",
            workspaceUrl: legacy.workspaceUrl || "",
            apiKey: legacy.apiKey,
          }
        : null,
    (acc) => ({ hasApiKey: !!acc.apiKey }),
  );
}

function mergeAccounting(raw: Partial<AdminSettings> | null | undefined) {
  const rawGroup = raw?.integrations?.accounting;
  return mergeMultiProviderGroup(
    defaultIntegrations.accounting,
    rawGroup,
    (legacy) =>
      legacy.refreshToken
        ? {
            id: `accounting-${legacy.provider || "wave"}`,
            label: legacy.provider || "Accounting",
            provider: legacy.provider || "wave",
            dashboardUrl: legacy.dashboardUrl || "",
            clientId: legacy.clientId || "",
            clientSecret: legacy.clientSecret || "",
            refreshToken: legacy.refreshToken,
          }
        : null,
    (acc) => ({
      // Wave's "full-access token" is a single value (stored as
      // refreshToken); requiring clientId+clientSecret too would mean
      // Wave could never show as connected, since it never issues those.
      hasCredentials: !!acc.refreshToken,
    }),
  );
}

function mergeCloudStorage(raw: Partial<AdminSettings> | null | undefined) {
  const rawGroup = raw?.integrations?.cloudStorage;
  return mergeMultiProviderGroup(
    defaultIntegrations.cloudStorage,
    rawGroup,
    (legacy) =>
      legacy.accessToken
        ? {
            id: `cloudstorage-${legacy.provider || "dropbox"}`,
            label: legacy.provider || "Cloud storage",
            provider: legacy.provider || "dropbox",
            rootFolderUrl: legacy.rootFolderUrl || "",
            accessToken: legacy.accessToken,
          }
        : null,
    (acc) => ({ hasAccessToken: !!acc.accessToken }),
  );
}

function mergeMarketData(raw: Partial<AdminSettings> | null | undefined) {
  const rawGroup = raw?.integrations?.marketData;
  return mergeMultiProviderGroup(
    defaultIntegrations.marketData,
    rawGroup,
    (legacy) =>
      legacy.apiKey
        ? {
            id: `marketdata-${legacy.provider || "polygon"}`,
            label: legacy.provider || "Market data",
            provider: legacy.provider || "polygon",
            apiBaseUrl: legacy.apiBaseUrl || "",
            apiKey: legacy.apiKey,
          }
        : null,
    (acc) => ({ hasApiKey: !!acc.apiKey }),
  );
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
