/**
 * Default values for the admin-settings shapes. These are the
 * starting state when no admin-settings.json exists on disk. Edit here when you
 * want to change "what shows up first-run".
 *
 * Secret-bearing fields (tokens, passwords, API keys) intentionally
 * default to empty — they get populated via the admin UI, never
 * shipped with the repo.
 */

import type {
  AgentDefinition,
  AppSettings,
  ApprovalSettings,
  IntegrationsSettings,
  PersonalizationSettings,
  VoiceSettings,
} from "./types";

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
  displayName: "",
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
    description:
      "Researches, synthesizes, and summarizes market, crypto, stock, and knowledge requests.",
    entryPoint: "server/agents/intelligence/IntelligenceAgent.ts",
  },
  {
    key: "BusinessManagerAgent",
    label: "Business Manager Agent",
    status: "active",
    description:
      "Business operations: payroll, contractors, ecommerce, real estate, business credit.",
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
    notes:
      "Phone and voicemail lane for call routing, missed-call capture, voicemail summaries, and future voice assistant workflows.",
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
    notes:
      "Fantasma Firewall integration for private VPN polling, custom-domain operator access, and future security workflow handoffs into ZED.",
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
    notes:
      "Business Manager knowledge coverage for operations, acquisition planning, commerce, property, and business credit strategy.",
  },
  deployment: {
    enabled: false,
    status: "planned",
    provider: "netlify",
    dashboardUrl: "https://app.netlify.com",
    apiBaseUrl: "https://api.netlify.com/api/v1",
    siteId: "",
    serviceId: "",
    accessToken: "",
    hasAccessToken: false,
    notes: "Deployment lane for Netlify, Render, Vercel, Railway, and future release-readiness checks.",
  },
  payments: {
    enabled: false,
    status: "planned",
    provider: "stripe",
    dashboardUrl: "https://dashboard.stripe.com",
    publishableKey: "",
    secretKey: "",
    webhookSecret: "",
    hasSecretKey: false,
    hasWebhookSecret: false,
    notes: "Payment and subscription lane for Stripe, PayPal, Square, and future ZWAP monetization workflows.",
  },
  socialPublishing: {
    enabled: false,
    status: "planned",
    platforms: ["YouTube", "TikTok", "Instagram", "Facebook", "X", "LinkedIn"],
    contentApprovalRequired: true,
    dashboardUrl: "",
    accounts: [],
    accessToken: "",
    hasAccessToken: false,
    notes: "Content distribution lane. Publishing must remain approval-gated before any external post is sent.",
  },
  crm: {
    enabled: false,
    status: "planned",
    provider: "hubspot",
    workspaceUrl: "",
    apiKey: "",
    hasApiKey: false,
    notes: "CRM lane for leads, partnerships, outreach history, and customer relationship workflows.",
  },
  accounting: {
    enabled: false,
    status: "planned",
    provider: "quickbooks",
    dashboardUrl: "",
    clientId: "",
    clientSecret: "",
    refreshToken: "",
    hasCredentials: false,
    notes: "Accounting lane for bookkeeping, cashflow review, revenue reports, and tax-readiness workflows.",
  },
  cloudStorage: {
    enabled: false,
    status: "planned",
    provider: "google_drive",
    rootFolderUrl: "",
    accessToken: "",
    hasAccessToken: false,
    notes: "Cloud file lane for Drive, Dropbox, OneDrive, S3, and future document ingestion workflows.",
  },
  tradingView: {
    enabled: false,
    status: "planned",
    workspaceUrl: "https://www.tradingview.com",
    defaultWatchlist: "",
    webhookUrl: "",
    alertWebhookSecret: "",
    hasAlertWebhookSecret: false,
    notes: "TradingView analysis lane for charts, watchlists, alerts, scanner imports, and paper-trading validation. No broker execution.",
  },
  marketData: {
    enabled: false,
    status: "planned",
    provider: "polygon",
    apiBaseUrl: "https://api.polygon.io",
    apiKey: "",
    hasApiKey: false,
    notes: "Market data lane for stocks, ETFs, crypto, forex, and future scanner enrichment. Analysis only in Phase 1.",
  },
  kalshi: {
    enabled: false,
    status: "planned",
    environment: "demo",
    apiBaseUrl: "https://demo-api.kalshi.co",
    email: "",
    notes:
      "Planned event-market integration for market discovery, prediction research, and contract monitoring.",
  },
  voiceTranscription: {
    enabled: false,
    status: "browser-only",
    provider: "Browser Speech API",
  },
  custom: [],
};

/**
 * Sensible first-run values for the "How Zed sounds" surface.
 * Chosen so a fresh install feels neutral — not too casual, not too
 * professional; balanced tone; treats you as a thinking partner.
 */
export const defaultVoiceSettings: VoiceSettings = {
  tone: "balanced",
  formality: 60,
  perspective: "partner",
  responseLength: "balanced",
  showReasoning: false,
  plainLanguage: true,
  codeBlocks: true,
  prohibitedPhrases: [],
};

/**
 * Conservative defaults: anything that reaches out externally or
 * touches money / data / credentials defaults to "ask." Internal
 * scheduling / task creation defaults to "auto" so Zed feels
 * useful out of the box without any config.
 */
export const defaultApprovalSettings: ApprovalSettings = {
  sendEmail: "ask",
  scheduleCalendar: "ask",
  cancelAppointment: "ask",
  sendMessage: "ask",
  reachOutToContacts: "ask",
  postToSocial: "ask",
  publishContent: "ask",
  makePayment: "ask",
  sendInvoice: "ask",
  deleteData: "ask",
  updateCredentials: "ask",
  deployCode: "ask",
  createTask: "auto",
};
