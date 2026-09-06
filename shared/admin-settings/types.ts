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

/**
 * These seven integration groups (deployment, payments, social
 * publishing, CRM, accounting, cloud storage, market data) each hold
 * more than one connectable provider (e.g. Render + Netlify, or
 * Stripe + Square). Each provider gets its own account entry keyed
 * by a stable id so connecting a second provider in the group can't
 * clobber the first — the same multi-account pattern already used
 * for github/email/google.
 */
export interface DeploymentAccount {
  id: string;
  label: string;
  provider: "netlify" | "render" | "vercel" | "railway" | "custom";
  dashboardUrl?: string;
  apiBaseUrl?: string;
  siteId?: string;
  serviceId?: string;
  accessToken: string;
  hasAccessToken?: boolean;
}

export interface DeploymentIntegrationSettings {
  enabled: boolean;
  status: IntegrationStatus;
  accounts: DeploymentAccount[];
  /** Legacy single-provider fields preserved for backward-compat. */
  provider?: "netlify" | "render" | "vercel" | "railway" | "custom";
  dashboardUrl?: string;
  apiBaseUrl?: string;
  siteId?: string;
  serviceId?: string;
  accessToken?: string;
  hasAccessToken?: boolean;
  notes: string;
}

export interface PaymentsAccount {
  id: string;
  label: string;
  provider: "stripe" | "paypal" | "square" | "custom";
  dashboardUrl?: string;
  publishableKey?: string;
  secretKey: string;
  webhookSecret?: string;
  hasSecretKey?: boolean;
  hasWebhookSecret?: boolean;
}

export interface PaymentsIntegrationSettings {
  enabled: boolean;
  status: IntegrationStatus;
  accounts: PaymentsAccount[];
  /** Legacy single-provider fields preserved for backward-compat. */
  provider?: "stripe" | "paypal" | "square" | "custom";
  dashboardUrl?: string;
  publishableKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  hasSecretKey?: boolean;
  hasWebhookSecret?: boolean;
  notes: string;
}

export interface SocialPublishingAccount {
  id: string;
  label: string;
  platform: string;
  dashboardUrl?: string;
  /** "token" = pasted API token (Twitter). "credentials" = ZAR used
   *  one-time credentials in a real browser and retained only the
   *  resulting encrypted-at-rest session. */
  authMethod?: "token" | "credentials";
  accessToken: string;
  hasAccessToken?: boolean;
  /** Only set when authMethod is "credentials". */
  username?: string;
  /** Serialized Playwright storageState (cookies + local storage) so
   *  ZAR can act as this account without signing in again each time.
   *  Persistence encrypts this value before writing it to disk or DB. */
  sessionState?: string;
}

export interface SocialPublishingIntegrationSettings {
  enabled: boolean;
  status: IntegrationStatus;
  accounts: SocialPublishingAccount[];
  platforms: string[];
  contentApprovalRequired: boolean;
  /** Legacy single-provider fields preserved for backward-compat. */
  dashboardUrl?: string;
  accessToken?: string;
  hasAccessToken?: boolean;
  notes: string;
}

export interface CrmAccount {
  id: string;
  label: string;
  provider: "hubspot" | "salesforce" | "zoho" | "airtable" | "pipedrive" | "custom";
  workspaceUrl?: string;
  apiKey: string;
  hasApiKey?: boolean;
}

export interface CrmIntegrationSettings {
  enabled: boolean;
  status: IntegrationStatus;
  accounts: CrmAccount[];
  /** Legacy single-provider fields preserved for backward-compat. */
  provider?: "hubspot" | "salesforce" | "zoho" | "airtable" | "custom";
  workspaceUrl?: string;
  apiKey?: string;
  hasApiKey?: boolean;
  notes: string;
}

export interface AccountingAccount {
  id: string;
  label: string;
  provider: "quickbooks" | "xero" | "wave" | "custom";
  dashboardUrl?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken: string;
  hasCredentials?: boolean;
}

export interface AccountingIntegrationSettings {
  enabled: boolean;
  status: IntegrationStatus;
  accounts: AccountingAccount[];
  /** Legacy single-provider fields preserved for backward-compat. */
  provider?: "quickbooks" | "xero" | "wave" | "custom";
  dashboardUrl?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  hasCredentials?: boolean;
  notes: string;
}

export interface CloudStorageAccount {
  id: string;
  label: string;
  provider: "google_drive" | "dropbox" | "onedrive" | "s3" | "custom";
  rootFolderUrl?: string;
  accessToken: string;
  hasAccessToken?: boolean;
}

export interface CloudStorageIntegrationSettings {
  enabled: boolean;
  status: IntegrationStatus;
  accounts: CloudStorageAccount[];
  /** Legacy single-provider fields preserved for backward-compat. */
  provider?: "google_drive" | "dropbox" | "onedrive" | "s3" | "custom";
  rootFolderUrl?: string;
  accessToken?: string;
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

export interface MarketDataAccount {
  id: string;
  label: string;
  provider: "polygon" | "alphavantage" | "twelvedata" | "finnhub" | "custom";
  apiBaseUrl?: string;
  apiKey: string;
  hasApiKey?: boolean;
}

export interface MarketDataIntegrationSettings {
  enabled: boolean;
  status: IntegrationStatus;
  accounts: MarketDataAccount[];
  /** Legacy single-provider fields preserved for backward-compat. */
  provider?: "polygon" | "alphavantage" | "twelvedata" | "finnhub" | "custom";
  apiBaseUrl?: string;
  apiKey?: string;
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
   *  in the ZAR context (so the model knows the tool exists) but
   *  ZAR can only ACT through them once a flow / agent is wired
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

/**
 * User-facing "how ZAR sounds" settings, exposed through the admin
 * Settings UI in plain English. Runtime translates these values into
 * a compact prompt fragment (see server/services/voiceSettings.ts)
 * that shapes tone, formality, length, reasoning visibility, plain-
 * language preference, code formatting, and prohibited phrases on
 * every generation.
 *
 * These live alongside the four legacy ruleset YAMLs during the
 * transition. New behaviour reads from these fields; the YAMLs
 * remain as legacy fallback until the plain-language surface covers
 * every category.
 */
export type VoiceTone = "warm" | "balanced" | "direct" | "playful";
export type VoicePerspective =
  | "partner"
  | "advisor"
  | "straight-shooter"
  | "devils-advocate";
export type VoiceResponseLength = "concise" | "balanced" | "thorough";

export interface VoiceSettings {
  tone: VoiceTone;
  /** 0 = casual, 100 = professional. Sits between the two endpoints. */
  formality: number;
  perspective: VoicePerspective;
  responseLength: VoiceResponseLength;
  /** Include a short "why" after answers. */
  showReasoning: boolean;
  /** Avoid jargon and technical terms unless asked. */
  plainLanguage: boolean;
  /** Wrap code in syntax-highlighted blocks. */
  codeBlocks: boolean;
  /** Phrases ZAR shouldn't use, one per entry. */
  prohibitedPhrases: string[];
}

/**
 * Per-action approval policy for the "What needs your approval"
 * settings surface. Consumed by OperationsAgent (and future agents)
 * before they dispatch an action:
 *   - "auto"  ZAR performs the action without asking
 *   - "ask"   ZAR drafts, then queues for admin approval before doing it
 *   - "never" ZAR refuses the action with a message pointing at settings
 *
 * Runtime enforcement lives in server/services/approvalPolicy.ts,
 * which OperationsAgent consults inside checkApprovalRequired.
 */
export type ApprovalMode = "auto" | "ask" | "never";

export interface ApprovalSettings {
  sendEmail: ApprovalMode;
  scheduleCalendar: ApprovalMode;
  cancelAppointment: ApprovalMode;
  sendMessage: ApprovalMode;
  reachOutToContacts: ApprovalMode;
  postToSocial: ApprovalMode;
  publishContent: ApprovalMode;
  makePayment: ApprovalMode;
  sendInvoice: ApprovalMode;
  deleteData: ApprovalMode;
  updateCredentials: ApprovalMode;
  deployCode: ApprovalMode;
  createTask: ApprovalMode;
}

export interface AdminSettings {
  auth: AuthSettings;
  app: AppSettings;
  personalization: PersonalizationSettings;
  agents: AgentDefinition[];
  integrations: IntegrationsSettings;
  users: ManagedUser[];
  voice: VoiceSettings;
  approvals: ApprovalSettings;
}
