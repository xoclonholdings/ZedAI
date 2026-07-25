import { sanitizeUser } from "./auth-helpers";
import { loadAdminSettings } from "./io";

/**
 * Returns settings with every secret blanked out and replaced by a
 * boolean "has*" flag. This is the shape the admin UI receives —
 * clients should never see raw tokens, passwords, refresh tokens,
 * or API keys, even over an admin-authenticated channel.
 *
 * Per-account secrets (github tokens, email passwords, google
 * credentials) and per-custom-integration field values are each
 * handled individually so the UI can show "saved" hints without
 * exposing the underlying value.
 */
export async function getPublicAdminSettings() {
  const settings = await loadAdminSettings();
  return {
    ...settings,
    integrations: {
      ...settings.integrations,
      github: {
        ...settings.integrations.github,
        token: "",
        hasToken: !!settings.integrations.github.token,
        accounts: (settings.integrations.github.accounts || []).map((acc) => ({
          ...acc,
          token: "",
          hasToken: !!acc.token,
        })),
      },
      email: {
        ...settings.integrations.email,
        password: "",
        hasPassword: !!settings.integrations.email.password,
        accounts: (settings.integrations.email.accounts || []).map((acc) => ({
          ...acc,
          password: "",
          hasPassword: !!acc.password,
        })),
      },
      google: {
        ...settings.integrations.google,
        accounts: (settings.integrations.google.accounts || []).map((acc) => ({
          ...acc,
          clientSecret: "",
          refreshToken: "",
          hasCredentials: !!(acc.clientId && acc.clientSecret && acc.refreshToken),
        })),
      },
      custom: (settings.integrations.custom || []).map((c) => ({
        ...c,
        fields: (c.fields || []).map((f) =>
          f.isSecret ? { ...f, value: f.value ? "•••••• (set)" : "" } : f,
        ),
      })),
      telephony: {
        ...settings.integrations.telephony,
        apiKey: "",
        hasApiKey: !!settings.integrations.telephony.apiKey,
      },
      firewall: {
        ...settings.integrations.firewall,
        authToken: "",
        hasAuthToken: !!settings.integrations.firewall.authToken,
      },
      deployment: {
        ...settings.integrations.deployment,
        accessToken: "",
        hasAccessToken: !!settings.integrations.deployment.accessToken,
        accounts: (settings.integrations.deployment.accounts || []).map((acc) => ({
          ...acc,
          accessToken: "",
          hasAccessToken: !!acc.accessToken,
        })),
      },
      payments: {
        ...settings.integrations.payments,
        secretKey: "",
        webhookSecret: "",
        hasSecretKey: !!settings.integrations.payments.secretKey,
        hasWebhookSecret: !!settings.integrations.payments.webhookSecret,
        accounts: (settings.integrations.payments.accounts || []).map((acc) => ({
          ...acc,
          secretKey: "",
          webhookSecret: "",
          hasSecretKey: !!acc.secretKey,
          hasWebhookSecret: !!acc.webhookSecret,
        })),
      },
      socialPublishing: {
        ...settings.integrations.socialPublishing,
        accessToken: "",
        hasAccessToken: !!settings.integrations.socialPublishing.accessToken,
        accounts: (settings.integrations.socialPublishing.accounts || []).map((acc) => ({
          ...acc,
          accessToken: "",
          password: "",
          sessionState: "",
          hasAccessToken: !!(acc.accessToken || acc.sessionState),
        })),
      },
      crm: {
        ...settings.integrations.crm,
        apiKey: "",
        hasApiKey: !!settings.integrations.crm.apiKey,
        accounts: (settings.integrations.crm.accounts || []).map((acc) => ({
          ...acc,
          apiKey: "",
          hasApiKey: !!acc.apiKey,
        })),
      },
      accounting: {
        ...settings.integrations.accounting,
        clientSecret: "",
        refreshToken: "",
        hasCredentials: !!(
          settings.integrations.accounting.clientId &&
          settings.integrations.accounting.clientSecret &&
          settings.integrations.accounting.refreshToken
        ),
        accounts: (settings.integrations.accounting.accounts || []).map((acc) => ({
          ...acc,
          clientSecret: "",
          refreshToken: "",
          hasCredentials: !!acc.refreshToken,
        })),
      },
      cloudStorage: {
        ...settings.integrations.cloudStorage,
        accessToken: "",
        hasAccessToken: !!settings.integrations.cloudStorage.accessToken,
        accounts: (settings.integrations.cloudStorage.accounts || []).map((acc) => ({
          ...acc,
          accessToken: "",
          hasAccessToken: !!acc.accessToken,
        })),
      },
      tradingView: {
        ...settings.integrations.tradingView,
        alertWebhookSecret: "",
        hasAlertWebhookSecret: !!settings.integrations.tradingView.alertWebhookSecret,
      },
      marketData: {
        ...settings.integrations.marketData,
        apiKey: "",
        hasApiKey: !!settings.integrations.marketData.apiKey,
        accounts: (settings.integrations.marketData.accounts || []).map((acc) => ({
          ...acc,
          apiKey: "",
          hasApiKey: !!acc.apiKey,
        })),
      },
    },
    users: settings.users.map(sanitizeUser),
  };
}
