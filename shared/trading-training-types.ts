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

/* ----------------------------------------------------------------------
 * Stages 5-7: Evaluation, Qualification, Live.
 * -------------------------------------------------------------------- */

export interface EvaluationConfig {
  provider: string;
  startingBalance: number;
  profitTarget: number;
  maxDailyLoss: number;
  maxTotalDrawdown: number;
  minTradingDays: number;
}

export interface EvaluationReport {
  config: EvaluationConfig;
  startedAt: string | null;
  status: "not_started" | "active" | "passed" | "failed";
  providerConnected: boolean;
  providerLabel: string;
  netProfit: number;
  profitTargetProgressPct: number;
  tradingDays: number;
  worstDayPnl: number;
  currentDrawdown: number;
  maxDrawdownSeen: number;
  breaches: string[];
  closedTradesCounted: number;
  summary: string;
}

export interface QualificationScore {
  key: string;
  label: string;
  score: number;
  target: number;
  detail: string;
}

export interface QualificationReport {
  ready: boolean;
  overallScore: number;
  target: number;
  scores: QualificationScore[];
  strengths: string[];
  weaknesses: string[];
  requiredImprovements: string[];
  summary: string;
  generatedAt: string;
}

export interface LiveTradingConfig {
  maxRiskPerTrade: number;
  maxDailyLoss: number;
  maxTotalDrawdown: number;
  killSwitchArmed: boolean;
}

export interface LiveTradingState {
  config: LiveTradingConfig;
  brokerConnected: boolean;
  brokerLabel: string;
  qualificationPassed: boolean;
  canExecute: boolean;
  status: "blocked" | "ready_pending_broker" | "armed";
  blockers: string[];
  summary: string;
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
  | "kalshi"
  | "polymarket"
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
  /**
   * What the connect form asks for. Kept deliberately simple: a
   * username/email and a password, exactly like signing in yourself.
   * Password fields are write-only (never sent back to the browser).
   */
  fields: Array<{ key: string; label: string; secret?: boolean; optional?: boolean }>;
  /**
   * Whether Zed can reach this account's website directly (used only to
   * do a light "is the site reachable" check on "Other account"). It
   * does not change how you connect — that's always username + password.
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

/**
 * Connecting an account is the same everywhere: the username/email you
 * log in with and your password. No API keys, developer accounts, or
 * technical setup — Zed signs in and works in the account for you.
 */
const LOGIN_FIELDS = [
  { key: "username", label: "Username or email" },
  { key: "password", label: "Password", secret: true },
];

export const INTEGRATION_PROVIDERS: IntegrationProviderInfo[] = [
  {
    provider: "topstep",
    label: "TopStep",
    purpose: "Zed signs in to your TopStep account and works in it for you.",
    fields: LOGIN_FIELDS,
    liveBridge: false,
  },
  {
    provider: "tradingview",
    label: "TradingView",
    purpose: "Zed signs in to TradingView to use your charts, watchlists, and alerts.",
    fields: LOGIN_FIELDS,
    liveBridge: false,
  },
  {
    provider: "lucid",
    label: "Lucid",
    purpose: "Zed signs in to your Lucid account and works in it for you.",
    fields: LOGIN_FIELDS,
    liveBridge: false,
  },
  {
    provider: "tradovate",
    label: "Tradovate",
    purpose: "Zed signs in to your Tradovate account and works in it for you.",
    fields: LOGIN_FIELDS,
    liveBridge: false,
  },
  {
    provider: "kalshi",
    label: "Kalshi",
    purpose: "Zed signs in to your Kalshi account for event/prediction (props) markets.",
    fields: LOGIN_FIELDS,
    liveBridge: false,
  },
  {
    provider: "polymarket",
    label: "Polymarket",
    purpose: "Zed signs in to your Polymarket account for prediction (props) markets.",
    fields: LOGIN_FIELDS,
    liveBridge: false,
  },
  {
    provider: "custom",
    label: "Other account",
    purpose: "Any other site. Give Zed the web address and your login.",
    fields: [
      { key: "baseUrl", label: "Website address" },
      ...LOGIN_FIELDS,
    ],
    liveBridge: true,
  },
];

export function integrationProviderInfo(provider: IntegrationProvider): IntegrationProviderInfo | undefined {
  return INTEGRATION_PROVIDERS.find((p) => p.provider === provider);
}
