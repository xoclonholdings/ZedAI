/**
 * Shared types for ZAR's trading training: stage assessments
 * ("Test ZAR"), material uploads, and provider integrations.
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

export interface IndicatorVote {
  name: string;
  verdict: "bullish" | "bearish" | "neutral";
  detail: string;
}

export interface TradingSignal {
  signal: "buy" | "sell" | "neutral";
  strength: number; // 0-100 conviction
  bullish: number; // count of bullish votes
  bearish: number; // count of bearish votes
  votes: IndicatorVote[];
  summary: string;
}

export interface BacktestReport {
  symbol: string;
  source: string;
  fromDate: string;
  toDate: string;
  barsTested: number;
  totalTrades: number;
  wins: number;
  losses: number;
  timeouts: number;
  winRate: number;
  expectancyR: number;
  grossExpectancyR: number;
  costPerTradeR: number;
  slippageBps: number;
  commissionR: number;
  netR: number;
  profitFactor: number;
  maxDrawdownR: number;
  avgHoldBars: number;
  riskReward: number;
  signalThreshold: number;
  edge: "positive" | "negative" | "flat";
  summary: string;
}

export interface ExternalPaperReport {
  providerConnected: boolean;
  providerLabel: string;
  closedTrades: number;
  requiredTrades: number;
  expectancy: number;
  ruleViolations: number;
  passed: boolean;
  summary: string;
}

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
 * education into a section, then tests ZAR on that section specifically.
 */
export interface KnowledgeAreaInfo {
  id: string;
  title: string;
  requiredTopics: string[];
  /** How many ingested knowledge entries are bound to this section. */
  entryCount: number;
  /** True once ZAR has structured knowledge covering this section. */
  covered: boolean;
}

/** Result of testing ZAR on one knowledge section. */
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
  | "lucid"
  | "webull"
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
   * Whether ZAR can reach this account's website directly (used only to
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
 * Providers define their own connection fields. Webull and event-market
 * bridges use API credentials; generic/custom accounts may use login fields.
 */
const LOGIN_FIELDS = [
  { key: "username", label: "Username or email" },
  { key: "password", label: "Password", secret: true },
];

const API_KEY_FIELDS = [
  { key: "keyId", label: "Key ID" },
  { key: "secretKey", label: "Secret key", secret: true },
];

export const INTEGRATION_PROVIDERS: IntegrationProviderInfo[] = [
  {
    provider: "lucid",
    label: "Lucid",
    purpose: "ZAR signs in to your Lucid account and works in it for you.",
    fields: LOGIN_FIELDS,
    liveBridge: false,
  },
  {
    provider: "tradovate",
    label: "Tradovate",
    purpose: "ZAR signs in to your Tradovate account and works in it for you.",
    fields: LOGIN_FIELDS,
    liveBridge: false,
  },
  {
    provider: "webull",
    label: "Webull",
    purpose: "ZAR connects to Webull OpenAPI for stocks, options, futures, crypto, and event-contract account rails.",
    fields: [
      { key: "appKey", label: "App key" },
      { key: "appSecret", label: "App secret", secret: true },
      { key: "endpoint", label: "API endpoint", optional: true },
      { key: "accountId", label: "Default account ID", optional: true },
      { key: "environment", label: "Environment: sandbox or production", optional: true },
    ],
    liveBridge: true,
  },
  {
    provider: "kalshi",
    label: "Kalshi",
    purpose: "ZAR signs in to your Kalshi account for event/prediction (props) markets.",
    fields: LOGIN_FIELDS,
    liveBridge: false,
  },
  {
    provider: "polymarket",
    label: "Polymarket US",
    purpose: "ZAR connects to Polymarket US for event-market discovery, balances, positions, and approved order routing.",
    fields: API_KEY_FIELDS,
    liveBridge: true,
  },
  {
    provider: "custom",
    label: "Other account",
    purpose: "Any other site. Give ZAR the web address and your login.",
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
