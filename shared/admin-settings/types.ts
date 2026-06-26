/**
 * All admin-settings interfaces. The values they describe live in
 * ./defaults.ts; consumers usually import both from the barrel
 * (`@shared/adminSettings`) so the split is transparent.
 */

export interface AppSettings {
  notifications: boolean;
  agentAlerts: boolean;
  messageNotifications: boolean;
  systemAlerts: boolean;
  hapticFeedback: boolean;
  autoSpellCorrect: boolean;
  autoSendDictation: boolean;
  backgroundConversations: boolean;
  autocomplete: boolean;
  trendingSearches: boolean;
  followUpSuggestions: boolean;
  colorScheme: "dark" | "light" | "auto";
  language: string;
  voiceType: string;
}

export interface PersonalizationSettings {
  displayName: string;
  preferredLanguage: string;
  colorScheme: string;
  compactMessages: boolean;
  showTimestamps: boolean;
  fontSize: string;
}

export interface ManagedUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string;
  isAdmin: boolean;
  isActive: boolean;
  passwordHash?: string;
  passwordSalt?: string;
  createdAt: string;
  updatedAt: string;
}

/** Public-facing user shape — passwordHash + passwordSalt stripped. */
export interface PublicManagedUser
  extends Omit<ManagedUser, "passwordHash" | "passwordSalt"> {}

export interface AuthSettings {
  adminUsername: string;
  securePhrase: string;
  sessionTimeoutMinutes: number;
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
  requireSecureCookies: boolean;
  sessionSecret: string;
}

export interface AgentDefinition {
  key: string;
  label: string;
  status: "active" | "planned";
  description: string;
  integration?: string;
  entryPoint?: string;
}

export type IntegrationStatus = "planned" | "configured" | "active";

// ─── Per-integration shapes ──────────────────────────────────────────

export interface GustoIntegrationSettings {
  enabled: boolean;
  status: IntegrationStatus;
  environment: "sandbox" | "production";
  companyId: string;
  apiBaseUrl: string;
  clientId: string;
  webhookBaseUrl: string;
  notes: string;
}

export interface GitHubAccount {
  id: string;
  label: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  token: string;
  hasToken?: boolean;
}

export interface GitHubIntegrationSettings {
  enabled: boolean;
  status: IntegrationStatus;
  apiBaseUrl: string;
  /** Multi-account: list of repositories the integration tracks. */
  accounts: GitHubAccount[];
  /** Legacy single-repo fields preserved for backward-compat during
   *  migration. Newly-saved data should use `accounts` instead. */
  owner?: string;
  repo?: string;
  defaultBranch?: string;
  token?: string;
  hasToken?: boolean;
  notes: string;
}

export interface EmailAccount {
  id: string;
  label: string;
  provider: "smtp" | "gmail" | "outlook" | "icloud" | "custom";
  fromName: string;
  fromAddress: string;
  smtpHost: string;
  smtpPort: number;
  username: string;
  password: string;
  hasPassword?: boolean;
}

export interface EmailIntegrationSettings {
  enabled: boolean;
  status: IntegrationStatus;
  accounts: EmailAccount[];
  /** Legacy single-sender fields preserved for backward-compat. */
  provider?: "smtp" | "gmail" | "outlook" | "custom";
  fromName?: string;
  fromAddress?: string;
  smtpHost?: string;
  smtpPort?: number;
  username?: string;
  password?: string;
  hasPassword?: boolean;
  notes: string;
}

export interface GoogleAccount {
  id: string;
  label: string;
  /** The Google account's primary email. */
  email: string;
  /** OAuth client (created in Google Cloud Console). */
  clientId: string;
  clientSecret: string;
  /** Long-lived refresh token obtained via initial OAuth consent. */
  refreshToken: string;
  hasCredentials?: boolean;
  /** Scopes enabled — e.g. "gmail.send", "gmail.readonly", "calendar". */
  scopes: string[];
}

export interface GoogleIntegrationSettings {
  enabled: boolean;
  status: IntegrationStatus;
  accounts: GoogleAccount[];
  notes: string;
}

export interface TelephonyIntegrationSettings {
  enabled: boolean;
  status: IntegrationStatus;
  provider: "twilio" | "sip" | "custom";
  phoneNumber: string;
  voicemailEmail: string;
  voiceAgentEnabled: boolean;
  accountSid: string;
  apiKey: string;
  hasApiKey?: boolean;
  notes: string;
}

export interface FirewallIntegrationSettings {
  enabled: boolean;
  status: IntegrationStatus;
  publicBaseUrl: string;
  vpnBaseUrl: string;
  preferredRoute: "vpn" | "public";
  vpnProvider: string;
  authToken: string;
  hasAuthToken?: boolean;
  healthPath: string;
  publicHealthPath: string;
  zedAiWebhookBaseUrl: string;
  notes: string;
}

export interface BusinessOperationsSettings {
  enabled: boolean;
  status: IntegrationStatus;
  ecommerce: boolean;
  dropshipping: boolean;
  realEstate: boolean;
  acquisitions: boolean;
  businessCredit: boolean;
  rdSuggestions: boolean;
  notes: string;
}

export interface DeploymentIntegrationSettings {
  enabled: boolean;
  status: IntegrationStatus;
  provider: "netlify" | "render" | "vercel" | "railway" | "custom";
  dashboardUrl: string;
  apiBaseUrl: string;
  siteId: string;
  serviceId: string;
  accessToken: string;
  hasAccessToken?: boolean;
  notes: string;
}

export interface PaymentsIntegrationSettings {
  enabled: boolean;
  status: IntegrationStatus;
  provider: "stripe" | "paypal" | "square" | "custom";
  dashboardUrl: string;
  publishableKey: string;
  secretKey: string;
  webhookSecret: string;
  hasSecretKey?: boolean;
  hasWebhookSecret?: boolean;
  notes: string;
}

export interface SocialPublishingIntegrationSettings {
  enabled: boolean;
  status: IntegrationStatus;
  platforms: string[];
  contentApprovalRequired: boolean;
  dashboardUrl: string;
  accessToken: string;
  hasAccessToken?: boolean;
  notes: string;
}

export interface CrmIntegrationSettings {
  enabled: boolean;
  status: IntegrationStatus;
  provider: "hubspot" | "salesforce" | "zoho" | "airtable" | "custom";
  workspaceUrl: string;
  apiKey: string;
  hasApiKey?: boolean;
  notes: string;
}

export interface AccountingIntegrationSettings {
  enabled: boolean;
  status: IntegrationStatus;
  provider: "quickbooks" | "xero" | "wave" | "custom";
  dashboardUrl: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  hasCredentials?: boolean;
  notes: string;
}

export interface CloudStorageIntegrationSettings {
  enabled: boolean;
  status: IntegrationStatus;
  provider: "google_drive" | "dropbox" | "onedrive" | "s3" | "custom";
  rootFolderUrl: string;
  accessToken: string;
  hasAccessToken?: boolean;
  notes: string;
}

export interface TradingViewIntegrationSettings {
  enabled: boolean;
  status: IntegrationStatus;
  workspaceUrl: string;
  defaultWatchlist: string;
  webhookUrl: string;
  alertWebhookSecret: string;
  hasAlertWebhookSecret?: boolean;
  notes: string;
}

export interface MarketDataIntegrationSettings {
  enabled: boolean;
  status: IntegrationStatus;
  provider: "polygon" | "alphavantage" | "twelvedata" | "finnhub" | "custom";
  apiBaseUrl: string;
  apiKey: string;
  hasApiKey?: boolean;
  notes: string;
}

export interface IntegrationsSettings {
  gusto: GustoIntegrationSettings;
  github: GitHubIntegrationSettings;
  email: EmailIntegrationSettings;
  google: GoogleIntegrationSettings;
  telephony: TelephonyIntegrationSettings;
  firewall: FirewallIntegrationSettings;
  businessOperations: BusinessOperationsSettings;
  deployment: DeploymentIntegrationSettings;
  payments: PaymentsIntegrationSettings;
  socialPublishing: SocialPublishingIntegrationSettings;
  crm: CrmIntegrationSettings;
  accounting: AccountingIntegrationSettings;
  cloudStorage: CloudStorageIntegrationSettings;
  tradingView: TradingViewIntegrationSettings;
  marketData: MarketDataIntegrationSettings;
  kalshi: {
    enabled: boolean;
    status: IntegrationStatus;
    environment: "demo" | "production";
    apiBaseUrl: string;
    email: string;
    notes: string;
  };
  voiceTranscription: {
    enabled: boolean;
    status: "planned" | "browser-only" | "active";
    provider: string;
  };
  /** Admin-defined integrations. Each entry is an arbitrary
   *  integration with named fields the user gives it. They surface
   *  in the ZED context (so the model knows the tool exists) but
   *  ZED can only ACT through them once a flow / agent is wired
   *  to consume the fields. */
  custom: CustomIntegration[];
}

export interface CustomIntegrationField {
  /** Field name shown in the form (e.g. "API key", "Webhook URL"). */
  key: string;
  /** Value the admin enters. */
  value: string;
  /** If true, the value is masked in the public response and the
   *  context builder doesn't reveal it. */
  isSecret?: boolean;
}

export interface CustomIntegration {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  /** Free-form fields the admin defined. */
  fields: CustomIntegrationField[];
}

// ─── Composite ────────────────────────────────────────────────────────

export interface AdminSettings {
  auth: AuthSettings;
  app: AppSettings;
  personalization: PersonalizationSettings;
  agents: AgentDefinition[];
  integrations: IntegrationsSettings;
  users: ManagedUser[];
}
