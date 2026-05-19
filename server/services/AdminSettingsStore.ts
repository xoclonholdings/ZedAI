import type {
  AppSettings,
  IntegrationsSettings,
  PersonalizationSettings,
} from "../../shared/adminSettings";
import {
  defaultAppSettings,
  defaultPersonalizationSettings,
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
        token:
          nextIntegrations.github && "token" in nextIntegrations.github
            ? nextIntegrations.github.token || current.integrations.github.token
            : current.integrations.github.token,
      },
      email: {
        ...current.integrations.email,
        ...(nextIntegrations.email || {}),
        password:
          nextIntegrations.email && "password" in nextIntegrations.email
            ? nextIntegrations.email.password || current.integrations.email.password
            : current.integrations.email.password,
      },
      telephony: {
        ...current.integrations.telephony,
        ...(nextIntegrations.telephony || {}),
        apiKey:
          nextIntegrations.telephony && "apiKey" in nextIntegrations.telephony
            ? nextIntegrations.telephony.apiKey ||
              current.integrations.telephony.apiKey
            : current.integrations.telephony.apiKey,
      },
      firewall: {
        ...current.integrations.firewall,
        ...(nextIntegrations.firewall || {}),
        authToken:
          nextIntegrations.firewall && "authToken" in nextIntegrations.firewall
            ? nextIntegrations.firewall.authToken ||
              current.integrations.firewall.authToken
            : current.integrations.firewall.authToken,
      },
      businessOperations: {
        ...current.integrations.businessOperations,
        ...(nextIntegrations.businessOperations || {}),
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
