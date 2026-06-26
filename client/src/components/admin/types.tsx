import {
  Activity,
  Bot,
  BriefcaseBusiness,
  Cloud,
  CreditCard,
  Database,
  GitBranch,
  Globe,
  LineChart,
  Mail,
  Megaphone,
  Phone,
  ReceiptText,
  Rocket,
  Shield,
  Sparkles,
  UsersRound,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type AdminSection =
  | "knowledge"
  | "integrations"
  | "ruleset"
  | "approvals"
  | "logs"
  | "security"
  | "tools";

export type IntegrationKey =
  | "aiHost"
  | "custom"
  | "businessOperations"
  | "github"
  | "email"
  | "google"
  | "telephony"
  | "firewall"
  | "deployment"
  | "payments"
  | "socialPublishing"
  | "crm"
  | "accounting"
  | "cloudStorage"
  | "tradingView"
  | "marketData"
  | "gusto"
  | "kalshi"
  | "voiceTranscription";

export const integrationMeta: Record<
  IntegrationKey,
  { label: string; description: string; icon: LucideIcon }
> = {
  aiHost: {
    label: "AI Host",
    description: "Active model provider health and connection test.",
    icon: Bot,
  },
  custom: {
    label: "Custom",
    description: "Add your own integrations with arbitrary fields.",
    icon: Sparkles,
  },
  businessOperations: {
    label: "Business Manager",
    description: "Commerce, property, credit, and planning coverage.",
    icon: BriefcaseBusiness,
  },
  github: {
    label: "GitHub",
    description: "Repository connectivity and automation readiness.",
    icon: GitBranch,
  },
  email: {
    label: "Email",
    description: "Outbound senders. Multiple SMTP / IMAP accounts.",
    icon: Mail,
  },
  google: {
    label: "Google",
    description: "Gmail, Calendar, Drive. Multiple accounts.",
    icon: Globe,
  },
  telephony: {
    label: "Telephony",
    description: "Phone, voicemail, and voice workflow configuration.",
    icon: Phone,
  },
  firewall: {
    label: "Firewall",
    description: "Fantasma route and health configuration.",
    icon: Shield,
  },
  deployment: {
    label: "Deployment",
    description: "Netlify, Render, Vercel, Railway, and release readiness.",
    icon: Rocket,
  },
  payments: {
    label: "Payments",
    description: "Stripe, PayPal, Square, subscriptions, and checkout readiness.",
    icon: CreditCard,
  },
  socialPublishing: {
    label: "Social",
    description: "YouTube, TikTok, Instagram, X, LinkedIn, and approval-gated publishing.",
    icon: Megaphone,
  },
  crm: {
    label: "CRM",
    description: "Leads, partners, customers, outreach, and relationship tracking.",
    icon: UsersRound,
  },
  accounting: {
    label: "Accounting",
    description: "QuickBooks, Xero, Wave, cashflow, and reporting readiness.",
    icon: ReceiptText,
  },
  cloudStorage: {
    label: "Cloud Files",
    description: "Drive, Dropbox, OneDrive, S3, and document ingestion.",
    icon: Cloud,
  },
  tradingView: {
    label: "TradingView",
    description: "Charts, watchlists, alerts, scanner imports, and paper-trade validation.",
    icon: LineChart,
  },
  marketData: {
    label: "Market Data",
    description: "Stocks, ETFs, crypto, forex, and scanner enrichment data.",
    icon: Database,
  },
  gusto: {
    label: "Gusto",
    description: "Payroll and contractor workflow readiness.",
    icon: Activity,
  },
  kalshi: {
    label: "Kalshi",
    description: "Prediction-market connectivity and environment setup.",
    icon: Waves,
  },
  voiceTranscription: {
    label: "Voice",
    description: "Voice transcription provider and path.",
    icon: Zap,
  },
};

export interface AdminNavTab {
  id: AdminSection;
  label: string;
  badge?: number;
}

export const StatusDot = ({ online }: { online: boolean }) => (
  <span className={`inline-block w-2 h-2 rounded-full ${online ? "bg-green-400" : "bg-red-400"}`} />
);
