import type {
  AppSettings,
  IntegrationsSettings,
  PersonalizationSettings,
  VoiceSettings,
} from "../../shared/adminSettings";
import {
  defaultAppSettings,
  defaultPersonalizationSettings,
  defaultVoiceSettings,
} from "../../shared/adminSettings";

import { updateAdminSettings } from "./admin-settings/io";

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

export { loadAdminSettings, updateAdminSettings } from "./admin-settings/io";
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
  const settings = await updateAdminSettings((current) => ({
    ...current,
    app: { ...defaultAppSettings },
    personalization: { ...defaultPersonalizationSettings },
  }));
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
  const settings = await updateAdminSettings((current) => ({
    ...current,
    voice: { ...defaultVoiceSettings },
  }));
  return settings.voice;
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
        accessToken: preserveSecret(
          current.integrations.deployment,
          nextIntegrations.deployment,
          "accessToken",
        ),
      },
      payments: {
        ...current.integrations.payments,
        ...(nextIntegrations.payments || {}),
        secretKey: preserveSecret(
          current.integrations.payments,
          nextIntegrations.payments,
          "secretKey",
        ),
        webhookSecret: preserveSecret(
          current.integrations.payments,
          nextIntegrations.payments,
          "webhookSecret",
        ),
      },
      socialPublishing: {
        ...current.integrations.socialPublishing,
        ...(nextIntegrations.socialPublishing || {}),
        accessToken: preserveSecret(
          current.integrations.socialPublishing,
          nextIntegrations.socialPublishing,
          "accessToken",
        ),
      },
      crm: {
        ...current.integrations.crm,
        ...(nextIntegrations.crm || {}),
        apiKey: preserveSecret(current.integrations.crm, nextIntegrations.crm, "apiKey"),
      },
      accounting: {
        ...current.integrations.accounting,
        ...(nextIntegrations.accounting || {}),
        clientSecret: preserveSecret(
          current.integrations.accounting,
          nextIntegrations.accounting,
          "clientSecret",
        ),
        refreshToken: preserveSecret(
          current.integrations.accounting,
          nextIntegrations.accounting,
          "refreshToken",
        ),
      },
      cloudStorage: {
        ...current.integrations.cloudStorage,
        ...(nextIntegrations.cloudStorage || {}),
        accessToken: preserveSecret(
          current.integrations.cloudStorage,
          nextIntegrations.cloudStorage,
          "accessToken",
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
        apiKey: preserveSecret(
          current.integrations.marketData,
          nextIntegrations.marketData,
          "apiKey",
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

function preserveSecret<T extends Record<string, any>>(
  current: T,
  next: Partial<T> | undefined,
  key: keyof T,
): string {
  if (!next || !(key in next)) return current[key];
  const incoming = next[key];
  if (typeof incoming === "string" && incoming.trim() === "") return current[key];
  if (incoming === "•••••• (set)") return current[key];
  const value = incoming ?? current[key];
  return typeof value === "string" ? value : "";
}

function mergeSecretAccounts(
  currentAccounts: any[],
  nextAccounts: any[] | undefined,
  secretKeys: string[],
) {
  if (!Array.isArray(nextAccounts)) return currentAccounts;
  return nextAccounts.map((nextAccount) => {
    const currentAccount = currentAccounts.find((account) => account.id === nextAccount.id) || {};
    const merged = { ...currentAccount, ...nextAccount };
    for (const key of secretKeys) {
      merged[key] = preserveSecret(currentAccount, nextAccount, key);
    }
    return merged;
  });
}
