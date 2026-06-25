import {
  Activity,
  Bot,
  GitBranch,
  Globe,
  Mail,
  Phone,
  Shield,
  Sparkles,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type AdminSection =
  | "flows"
  | "knowledge"
  | "integrations"
  | "ruleset"
  | "approvals"
  | "logs"
  | "security";

export type IntegrationKey =
  | "aiHost"
  | "custom"
  | "businessOperations"
  | "github"
  | "email"
  | "google"
  | "telephony"
  | "firewall"
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
    icon: Sparkles,
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
