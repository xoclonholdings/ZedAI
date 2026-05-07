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

export interface GitHubIntegrationSettings {
  enabled: boolean;
  status: "planned" | "configured" | "active";
  apiBaseUrl: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  token: string;
  hasToken?: boolean;
  notes: string;
}

export interface EmailIntegrationSettings {
  enabled: boolean;
  status: "planned" | "configured" | "active";
  provider: "smtp" | "gmail" | "outlook" | "custom";
  fromName: string;
  fromAddress: string;
  smtpHost: string;
  smtpPort: number;
  username: string;
  password: string;
  hasPassword?: boolean;
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
    key: "IDEOperatorAgent",
    label: "IDE Operator Agent",
    status: "planned",
    description: "Planned coding and repository workflow automation agent.",
    entryPoint: "server/agents/ide-operator/IDEOperatorAgent.ts",
  },
  {
    key: "AudioEngineerAgent",
    label: "Audio Engineer Agent",
    status: "planned",
    description: "Planned DAW and audio production automation agent.",
    entryPoint: "server/agents/audio-engineer/AudioEngineerAgent.ts",
  },
  {
    key: "BusinessManagerAgent",
    label: "Business Manager Agent",
    status: "planned",
    description: "Planned business operations agent for payroll, contractors, and finance workflows.",
    integration: "Gusto",
    entryPoint: "server/agents/business-manager/BusinessManagerAgent.ts",
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
    owner: "",
    repo: "",
    defaultBranch: "main",
    token: "",
    hasToken: false,
    notes: "GitHub integration for repository status, pull requests, issues, and future IDE/operator workflows.",
  },
  email: {
    enabled: false,
    status: "planned",
    provider: "smtp",
    fromName: "ZED",
    fromAddress: "zed@zed-ai.online",
    smtpHost: "smtp.mail.me.com",
    smtpPort: 587,
    username: "",
    password: "",
    hasPassword: false,
    notes:
      "iCloud Custom Email Domain. Sender: zed@zed-ai.online (must be a verified custom-domain alias on the iCloud Apple ID). Auth username is the iCloud primary email; password must be an app-specific password generated at appleid.apple.com. DKIM/SPF records for zed-ai.online live in Netlify DNS. Set 'enabled' to true once the app password is saved.",
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
};
