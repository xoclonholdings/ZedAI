import type {
  AppSettings,
  ApprovalSettings,
  IntegrationsSettings,
  PersonalizationSettings,
  VoiceSettings,
} from "../../shared/adminSettings";
import {
  defaultApprovalSettings,
  defaultVoiceSettings,
} from "../../shared/adminSettings";

import { loadAdminSettings, updateAdminSettings } from "./admin-settings/io";

/**
 * Admin settings entry point. The store is split into focused modules
 * under ./admin-settings/:
 *
 *   env.ts             — env probes + production-required vars
 *   auth-helpers.ts    — password hashing, default admin user,
 *                        sanitize/normalize helpers
 *   mergeSettings.ts   — load-time defaults + legacy → multi-account
 *                        migration for github/email/google
 *   io.ts              — loadAdminSettings + updateAdminSettings (the
 *                        read-modify-write primitive used by everything
 *                        below)
 *   userCrud.ts        — managed-user CRUD + authentication
 *   publicMasking.ts   — getPublicAdminSettings (strips secrets for
 *                        the admin UI)
 *
 * This file keeps the small update wrappers and re-exports the rest
 * so existing import paths (`from "../services/AdminSettingsStore"`)
 * continue to work without callsite changes.
 */

export { loadAdminSettings, updateAdminSettings };
export { getPublicAdminSettings } from "./admin-settings/publicMasking";
export {
  authenticateManagedUser,
  createManagedUser,
  findAdminUser,
  listManagedUsers,
  updateAuthSettings,
  updateCurrentUserCredentials,
  updateManagedUser,
} from "./admin-settings/userCrud";

export async function updateAppSettings(nextApp: Partial<AppSettings>) {
  const settings = await updateAdminSettings((current) => ({
    ...current,
    app: { ...current.app, ...nextApp },
  }));
  return settings.app;
}

export async function resetAppSettings() {
  const settings = await loadAdminSettings();
  return { app: settings.app, personalization: settings.personalization };
}

export async function updatePersonalizationSettings(
  nextPersonalization: Partial<PersonalizationSettings>,
) {
  const settings = await updateAdminSettings((current) => ({
    ...current,
    personalization: { ...current.personalization, ...nextPersonalization },
  }));
  return settings.personalization;
}

/**
 * Voice settings ("How Zed sounds"). Partial patches are shallow-
 * merged into current; missing fields keep their previous value.
 * mergeSettings clamps + normalizes on the way back out so the
 * runtime prompt builder never sees invalid data.
 */
export async function updateVoiceSettings(nextVoice: Partial<VoiceSettings>) {
  const settings = await updateAdminSettings((current) => ({
    ...current,
    voice: { ...(current.voice || defaultVoiceSettings), ...nextVoice },
  }));
  return settings.voice;
}

export async function resetVoiceSettings() {
  const settings = await loadAdminSettings();
  return settings.voice;
}

/**
 * Approval settings ("What needs your approval"). Partial patches
 * are shallow-merged; mergeSettings clamps unknown modes to "ask" so
 * a corrupted on-disk value never silently escalates to "auto."
 */
export async function updateApprovalSettings(nextApprovals: Partial<ApprovalSettings>) {
  const settings = await updateAdminSettings((current) => ({
    ...current,
    approvals: { ...(current.approvals || defaultApprovalSettings), ...nextApprovals },
  }));
  return settings.approvals;
}

export async function resetApprovalSettings() {
  const settings = await loadAdminSettings();
  return settings.approvals;
}

/**
 * Integration update needs special care because each integration has
 * secrets stored on the server: incoming patches that don't include
 * the secret field should *preserve* the stored value, not blank it.
 * Without this guard, the UI sending back a masked "" would erase
 * the real token/password.
 */
export async function updateIntegrationSettings(
  nextIntegrations: Partial<IntegrationsSettings>,
) {
  const settings = await updateAdminSettings((current) => ({
    ...current,
    integrations: {
      ...current.integrations,
      ...nextIntegrations,
      gusto: {
        ...current.integrations.gusto,
        ...(nextIntegrations.gusto || {}),
      },
      github: {
        ...current.integrations.github,
        ...(nextIntegrations.github || {}),
        token: preserveSecret(
          current.integrations.github,
          nextIntegrations.github,
          "token",
        ),
        accounts: mergeSecretAccounts(
          current.integrations.github.accounts || [],
          nextIntegrations.github?.accounts,
          ["token"],
        ),
      },
      email: {
        ...current.integrations.email,
        ...(nextIntegrations.email || {}),
        password: preserveSecret(
          current.integrations.email,
          nextIntegrations.email,
          "password",
        ),
        accounts: mergeSecretAccounts(
          current.integrations.email.accounts || [],
          nextIntegrations.email?.accounts,
          ["password"],
        ),
      },
      google: {
        ...current.integrations.google,
        ...(nextIntegrations.google || {}),
        accounts: mergeSecretAccounts(
          current.integrations.google.accounts || [],
          nextIntegrations.google?.accounts,
          ["clientSecret", "refreshToken"],
        ),
      },
      telephony: {
        ...current.integrations.telephony,
        ...(nextIntegrations.telephony || {}),
        apiKey: preserveSecret(
          current.integrations.telephony,
          nextIntegrations.telephony,
          "apiKey",
        ),
      },
      firewall: {
        ...current.integrations.firewall,
        ...(nextIntegrations.firewall || {}),
        authToken: preserveSecret(
          current.integrations.firewall,
          nextIntegrations.firewall,
          "authToken",
        ),
      },
      businessOperations: {
        ...current.integrations.businessOperations,
        ...(nextIntegrations.businessOperations || {}),
      },
      deployment: {
        ...current.integrations.deployment,
        ...(nextIntegrations.deployment || {}),
        accounts: mergeSecretAccounts(
          current.integrations.deployment.accounts || [],
          nextIntegrations.deployment?.accounts,
          ["accessToken"],
        ),
      },
      payments: {
        ...current.integrations.payments,
        ...(nextIntegrations.payments || {}),
        accounts: mergeSecretAccounts(
          current.integrations.payments.accounts || [],
          nextIntegrations.payments?.accounts,
          ["secretKey", "webhookSecret"],
        ),
      },
      socialPublishing: {
        ...current.integrations.socialPublishing,
        ...(nextIntegrations.socialPublishing || {}),
        accounts: mergeSecretAccounts(
          current.integrations.socialPublishing.accounts || [],
          nextIntegrations.socialPublishing?.accounts,
          ["accessToken"],
        ),
      },
      crm: {
        ...current.integrations.crm,
        ...(nextIntegrations.crm || {}),
        accounts: mergeSecretAccounts(
          current.integrations.crm.accounts || [],
          nextIntegrations.crm?.accounts,
          ["apiKey"],
        ),
      },
      accounting: {
        ...current.integrations.accounting,
        ...(nextIntegrations.accounting || {}),
        accounts: mergeSecretAccounts(
          current.integrations.accounting.accounts || [],
          nextIntegrations.accounting?.accounts,
          ["clientSecret", "refreshToken"],
        ),
      },
      cloudStorage: {
        ...current.integrations.cloudStorage,
        ...(nextIntegrations.cloudStorage || {}),
        accounts: mergeSecretAccounts(
          current.integrations.cloudStorage.accounts || [],
          nextIntegrations.cloudStorage?.accounts,
          ["accessToken"],
        ),
      },
      tradingView: {
        ...current.integrations.tradingView,
        ...(nextIntegrations.tradingView || {}),
        alertWebhookSecret: preserveSecret(
          current.integrations.tradingView,
          nextIntegrations.tradingView,
          "alertWebhookSecret",
        ),
      },
      marketData: {
        ...current.integrations.marketData,
        ...(nextIntegrations.marketData || {}),
        accounts: mergeSecretAccounts(
          current.integrations.marketData.accounts || [],
          nextIntegrations.marketData?.accounts,
          ["apiKey"],
        ),
      },
      kalshi: {
        ...current.integrations.kalshi,
        ...(nextIntegrations.kalshi || {}),
      },
      voiceTranscription: {
        ...current.integrations.voiceTranscription,
        ...(nextIntegrations.voiceTranscription || {}),
      },
    },
  }));
  return settings.integrations;
}

/**
 * The admin UI never sends an empty string for a secret field except
 * when the user explicitly hits Disconnect (the Connect dialog's Save
 * button is disabled until the field is non-empty, so a real "save"
 * can't produce ""). So an incoming "" means "clear this," while an
 * omitted key or the masked placeholder both mean "leave it alone."
 */
function preserveSecret<T extends Record<string, any>>(
  current: T,
  next: Partial<T> | undefined,
  key: keyof T,
): string {
  if (!next || !(key in next)) return current[key];
  const incoming = next[key];
  if (incoming === "•••••• (set)") return current[key];
  const value = incoming ?? current[key];
  return typeof value === "string" ? value : "";
}

/**
 * Upserts each incoming account into the existing list by id. This
 * must NOT reduce to `nextAccounts.map(...)` — every Connect action
 * sends only the single account it just saved (e.g. just "gmail," or
 * just "render"), so building the result solely from `nextAccounts`
 * would silently delete every other already-connected account in the
 * group. Accounts already on file that aren't mentioned in this patch
 * are left untouched.
 */
function mergeSecretAccounts(
  currentAccounts: any[],
  nextAccounts: any[] | undefined,
  secretKeys: string[],
) {
  if (!Array.isArray(nextAccounts)) return currentAccounts;
  const result = [...currentAccounts];
  for (const nextAccount of nextAccounts) {
    const idx = result.findIndex((account) => account.id === nextAccount.id);
    const currentAccount = idx >= 0 ? result[idx] : {};
    const merged = { ...currentAccount, ...nextAccount };
    for (const key of secretKeys) {
      merged[key] = preserveSecret(currentAccount, nextAccount, key);
    }
    if (idx >= 0) {
      result[idx] = merged;
    } else {
      result.push(merged);
    }
  }
  return result;
}
