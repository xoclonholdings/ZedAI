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

export interface PublicManagedUser extends Omit<ManagedUser, "passwordHash" | "passwordSalt"> {}

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

export interface GustoIntegrationSettings {
  enabled: boolean;
  status: "planned" | "configured" | "active";
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
  status: "planned" | "configured" | "active";
  apiBaseUrl: string;
  /** Multi-account: list of repositories the integration tracks. */
  accounts: GitHubAccount[];
  /** Legacy fields preserved for backward-compat during migration.
   *  Newly-saved data should use `accounts` instead. */
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
  status: "planned" | "configured" | "active";
  accounts: EmailAccount[];
  /** Legacy fields preserved for backward-compat. */
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
  status: "planned" | "configured" | "active";
  accounts: GoogleAccount[];
  notes: string;
}

export interface TelephonyIntegrationSettings {
  enabled: boolean;
  status: "planned" | "configured" | "active";
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
  status: "planned" | "configured" | "active";
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
  status: "planned" | "configured" | "active";
  ecommerce: boolean;
  dropshipping: boolean;
  realEstate: boolean;
  acquisitions: boolean;
  businessCredit: boolean;
  rdSuggestions: boolean;
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
  kalshi: {
    enabled: boolean;
    status: "planned" | "configured" | "active";
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
  /** Admin-defined integrations. Each entry is an arbitrary integration
   *  with named fields the user gives it. They surface in the ZED
   *  context (so the model knows the tool exists) but ZED can only
   *  ACT through them once a flow / agent is wired to consume the
   *  fields. */
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

export interface AdminSettings {
  auth: AuthSettings;
  app: AppSettings;
  personalization: PersonalizationSettings;
  agents: AgentDefinition[];
  integrations: IntegrationsSettings;
  users: ManagedUser[];
}

export const defaultAppSettings: AppSettings = {
  notifications: true,
  agentAlerts: true,
  messageNotifications: true,
  systemAlerts: true,
  hapticFeedback: true,
  autoSpellCorrect: true,
  autoSendDictation: false,
  backgroundConversations: true,
  autocomplete: false,
  trendingSearches: true,
  followUpSuggestions: false,
  colorScheme: "dark",
  language: "English",
  voiceType: "Ember",
};

export const defaultPersonalizationSettings: PersonalizationSettings = {
  displayName: "Admin",
  preferredLanguage: "English",
  colorScheme: "dark",
  compactMessages: false,
  showTimestamps: true,
  fontSize: "medium",
};

export const defaultAgentDefinitions: AgentDefinition[] = [
  {
    key: "OperationsAgent",
    label: "Operations Agent",
    status: "active",
    description: "Handles operational tasks, approvals, and execution-oriented requests.",
    entryPoint: "server/agents/operations/OperationsAgent.ts",
  },
  {
    key: "IntelligenceAgent",
    label: "R&D Agent",
    status: "active",
    description: "Researches, synthesizes, and summarizes market, crypto, stock, and knowledge requests.",
    entryPoint: "server/agents/intelligence/IntelligenceAgent.ts",
  },
  {
    key: "BusinessManagerAgent",
    label: "Business Manager Agent",
    status: "active",
    description: "Business operations: payroll, contractors, ecommerce, real estate, business credit.",
    integration: "Gusto",
    entryPoint: "server/agents/business-manager/BusinessManagerAgent.ts",
  },
  {
    key: "FinanceAgent",
    label: "Finance Agent",
    status: "active",
    description: "Crypto, forex, trading setups, wealth strategy. Action-gated by approval.",
    entryPoint: "server/agents/finance/FinanceAgent.ts",
  },
];

export const defaultIntegrations: IntegrationsSettings = {
  gusto: {
    enabled: false,
    status: "planned",
    environment: "sandbox",
    companyId: "",
    apiBaseUrl: "https://api.gusto-demo.com",
    clientId: "",
    webhookBaseUrl: "",
    notes: "Planned integration for payroll, contractors, onboarding, and benefits workflows.",
  },
  github: {
    enabled: false,
    status: "planned",
    apiBaseUrl: "https://api.github.com",
    accounts: [],
    notes:
      "GitHub integration for repository status, pull requests, issues, and future IDE/operator workflows. Add one entry per repository you want ZED to access.",
  },
  email: {
    enabled: false,
    status: "planned",
    accounts: [],
    notes:
      "Outbound email lanes. Add one account per sending identity (e.g. an iCloud custom-domain alias, a Gmail SMTP credential, etc.). Each account holds its own SMTP host, port, username, and app password.",
  },
  google: {
    enabled: false,
    status: "planned",
    accounts: [],
    notes:
      "Google account integration for Gmail, Calendar, and Drive access. Add one account per Google identity. Each account needs an OAuth client (from Google Cloud Console) plus a refresh token obtained via the initial consent flow.",
  },
  telephony: {
    enabled: false,
    status: "planned",
    provider: "twilio",
    phoneNumber: "",
    voicemailEmail: "",
    voiceAgentEnabled: false,
    accountSid: "",
    apiKey: "",
    hasApiKey: false,
    notes: "Phone and voicemail lane for call routing, missed-call capture, voicemail summaries, and future voice assistant workflows.",
  },
  firewall: {
    enabled: false,
    status: "planned",
    publicBaseUrl: "",
    vpnBaseUrl: "",
    preferredRoute: "vpn",
    vpnProvider: "Tailscale",
    authToken: "",
    hasAuthToken: false,
    healthPath: "/api/integration/firewall/status",
    publicHealthPath: "/api/firewall/public-status",
    zedAiWebhookBaseUrl: "",
    notes: "Fantasma Firewall integration for private VPN polling, custom-domain operator access, and future security workflow handoffs into ZED.",
  },
  businessOperations: {
    enabled: true,
    status: "configured",
    ecommerce: true,
    dropshipping: true,
    realEstate: true,
    acquisitions: true,
    businessCredit: true,
    rdSuggestions: true,
    notes: "Business Manager knowledge coverage for operations, acquisition planning, commerce, property, and business credit strategy.",
  },
  kalshi: {
    enabled: false,
    status: "planned",
    environment: "demo",
    apiBaseUrl: "https://demo-api.kalshi.co",
    email: "",
    notes: "Planned event-market integration for market discovery, prediction research, and contract monitoring.",
  },
  voiceTranscription: {
    enabled: false,
    status: "browser-only",
    provider: "Browser Speech API",
  },
  custom: [],
};
