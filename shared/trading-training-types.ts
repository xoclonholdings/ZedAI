/**
 * Shared types for Zed's trading training: stage assessments
 * ("Test Zed"), material uploads, and provider integrations.
 */

import type { StageAssessmentKind, TradingStageId } from "./trading-progression";

export interface AssessmentBreakdownItem {
  label: string;
  detail: string;
  points: number;
  max: number;
}

export interface AssessmentQuizItem {
  question: string;
  answer: string;
  verdict: "correct" | "partial" | "incorrect" | "unknown";
  note: string;
}

export interface StageAssessmentResult {
  stageId: TradingStageId;
  kind: StageAssessmentKind;
  score: number;
  threshold: number;
  passed: boolean;
  summary: string;
  breakdown: AssessmentBreakdownItem[];
  quiz: AssessmentQuizItem[];
  assessedAt: string;
  /** Set when passing this assessment unlocked a new stage. */
  unlockedStage?: TradingStageId;
}

/**
 * A single Learn-stage knowledge section. There is one per required
 * curriculum area (market structure, liquidity, …). The user feeds
 * education into a section, then tests Zed on that section specifically.
 */
export interface KnowledgeAreaInfo {
  id: string;
  title: string;
  requiredTopics: string[];
  /** How many ingested knowledge entries are bound to this section. */
  entryCount: number;
  /** True once Zed has structured knowledge covering this section. */
  covered: boolean;
}

/** Result of testing Zed on one knowledge section. */
export interface KnowledgeAreaAssessment {
  areaId: string;
  areaTitle: string;
  score: number;
  threshold: number;
  passed: boolean;
  summary: string;
  breakdown: AssessmentBreakdownItem[];
  quiz: AssessmentQuizItem[];
  assessedAt: string;
}

export interface MaterialIngestResult {
  sourceLabel: string;
  entryId: string;
  title: string;
  category: string;
  concepts: number;
  rules: number;
}

export interface MaterialUploadResult {
  ingested: MaterialIngestResult[];
  totals: {
    sources: number;
    concepts: number;
    rules: number;
  };
}

export type IntegrationProvider =
  | "topstep"
  | "tradingview"
  | "lucid"
  | "tradovate"
  | "custom";

export type IntegrationStatus =
  | "disconnected"
  | "configured"
  | "connected"
  | "error";

export interface IntegrationProviderInfo {
  provider: IntegrationProvider;
  label: string;
  purpose: string;
  /** Fields the connect form asks for. Secrets are write-only. */
  fields: Array<{ key: string; label: string; secret?: boolean; optional?: boolean }>;
  /**
   * Whether a real live-data bridge exists yet. When false, connecting
   * saves credentials for when the bridge is enabled and "test" only
   * validates the config (no fabricated live pull).
   */
  liveBridge: boolean;
}

export interface TradingIntegration {
  provider: IntegrationProvider;
  label: string;
  status: IntegrationStatus;
  baseUrl?: string;
  /** True when a secret is stored — the secret itself is never returned. */
  hasCredential: boolean;
  notes?: string;
  lastTestedAt?: string;
  lastResult?: string;
  createdAt: string;
  updatedAt: string;
}

export const INTEGRATION_PROVIDERS: IntegrationProviderInfo[] = [
  {
    provider: "topstep",
    label: "TopStep",
    purpose: "Futures evaluation rules, drawdown discipline, and account objectives.",
    fields: [
      { key: "accountId", label: "Account / username" },
      { key: "apiKey", label: "API key", secret: true, optional: true },
    ],
    liveBridge: false,
  },
  {
    provider: "tradingview",
    label: "TradingView",
    purpose: "Charts, watchlists, alerts, and screeners Zed can reference.",
    fields: [
      { key: "username", label: "Username" },
      { key: "webhookSecret", label: "Alert webhook secret", secret: true, optional: true },
    ],
    liveBridge: false,
  },
  {
    provider: "lucid",
    label: "Lucid",
    purpose: "Evaluation environment for professional trading objectives.",
    fields: [
      { key: "accountId", label: "Account ID" },
      { key: "apiKey", label: "API key", secret: true, optional: true },
    ],
    liveBridge: false,
  },
  {
    provider: "tradovate",
    label: "Tradovate Paper",
    purpose: "Paper/live futures brokerage for evaluation-style trading.",
    fields: [
      { key: "username", label: "Username" },
      { key: "apiKey", label: "API key", secret: true, optional: true },
    ],
    liveBridge: false,
  },
  {
    provider: "custom",
    label: "Custom",
    purpose: "Any HTTP endpoint or provider you want Zed to reach. The URL gets a live reachability test.",
    fields: [
      { key: "baseUrl", label: "Base URL" },
      { key: "apiKey", label: "API key / token", secret: true, optional: true },
    ],
    liveBridge: true,
  },
];

export function integrationProviderInfo(provider: IntegrationProvider): IntegrationProviderInfo | undefined {
  return INTEGRATION_PROVIDERS.find((p) => p.provider === provider);
}
