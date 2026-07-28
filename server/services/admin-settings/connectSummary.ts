import { loadAdminSettings } from "./io";
import type { IntegrationsSettings } from "../../../shared/admin-settings/types";

/**
 * A safe, per-user-visible summary of the admin-wide integrations already
 * configured in Settings > Advanced > Integrations - connected/not and how
 * many accounts, nothing secret. Lets the Connect page show real categories
 * (email, social, CRM, payments, ...) beyond the per-user trading-broker
 * accounts, without ever exposing a token/password to a non-admin viewer.
 */

export interface ConnectCategorySummary {
  id: string;
  label: string;
  connected: boolean;
  accountCount: number;
  status: string;
}

const CATEGORY_LABELS: Partial<Record<keyof IntegrationsSettings, string>> = {
  email: "Email",
  google: "Gmail / Google",
  github: "GitHub",
  deployment: "Deployment",
  payments: "Payments",
  socialPublishing: "Social Media",
  crm: "CRM",
  accounting: "Accounting",
  cloudStorage: "Cloud Storage",
  marketData: "Market Data",
  telephony: "Telephony",
  firewall: "Firewall / VPN",
  businessOperations: "Business Operations",
  gusto: "Payroll (Gusto)",
};

function hasAnyCredentialFlag(section: Record<string, unknown>): boolean {
  return Boolean(
    section.hasPassword ||
    section.hasToken ||
    section.hasApiKey ||
    section.hasAccessToken ||
    section.hasCredentials ||
    section.hasAuthToken ||
    section.hasSecretKey ||
    section.hasWebhookSecret,
  );
}

export async function getConnectCategorySummary(): Promise<ConnectCategorySummary[]> {
  const settings = await loadAdminSettings();
  const integrations = settings.integrations as unknown as Record<string, Record<string, unknown>>;

  return (Object.keys(CATEGORY_LABELS) as Array<keyof IntegrationsSettings>).map((key) => {
    const section = integrations[key as string] || {};
    const accounts = Array.isArray(section.accounts) ? section.accounts : [];
    const accountsConnected = accounts.some((account) => hasAnyCredentialFlag(account as Record<string, unknown>));
    const connected = section.status === "active" || accountsConnected || hasAnyCredentialFlag(section);

    return {
      id: key as string,
      label: CATEGORY_LABELS[key] as string,
      connected,
      accountCount: accounts.length,
      status: (section.status as string) || "planned",
    };
  });
}
