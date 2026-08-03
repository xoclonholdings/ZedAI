export type TradingAssetClass = "stock" | "etf" | "option" | "future" | "crypto" | "forex";

export type TradeDirection = "long" | "short";

export type TradingKnowledgeCategory =
  | "market_structure"
  | "liquidity"
  | "supply_demand"
  | "trade_planning"
  | "trade_management"
  | "risk_management"
  | "probability"
  | "multi_timeframe"
  | "market_catalyst"
  | "journal_lesson"
  | "strategy_rule";

export type SetupStatus = "watch" | "observe" | "possible_setup" | "valid_setup" | "no_trade";

export type GovernanceDecisionOutcome =
  | "APPROVED"
  | "CONDITIONALLY_APPROVED"
  | "PAPER_TRADE_ONLY"
  | "REQUIRES_REVISION"
  | "REJECTED";

export type AuthorizationDecision = "AUTHORIZED" | "AUTHORIZED_WITH_CONDITIONS" | "DENIED";

export type ChecklistResult = "PASS" | "FAIL" | "NOT_APPLICABLE" | "UNKNOWN";

export type LiveTradingEligibility = "Eligible" | "Nearly Eligible" | "Not Eligible";

export type PaperTradingGovernanceMode = "enforce" | "warn" | "off";

export interface PaperTradingGovernanceCheckSetting {
  enabled: boolean;
  blocking: boolean;
}
export interface PaperTradingGovernanceSettings {
  userId: string;
  updatedAt: string;
  mode: PaperTradingGovernanceMode;
  checks: Record<string, PaperTradingGovernanceCheckSetting>;
  thresholds: {
    minimumRiskReward: number;
    maxRiskPerPaperTrade: number;
    maxNegativeDrawdown: number;
    requiredSampleSize: number;
  };
}

export interface TradingGovernanceChecklistItem {
  key: string;
  label: string;
  result: ChecklistResult;
  evidence: string;
  missingInformation?: string[];
  critical?: boolean;
}

export interface TradingGovernanceDecision {
  id: string;
  createdAt: string;
  version: string;
  userId: string;
  reviewer: "TradingGovernanceEngine";
  tradeId?: string;
  thesisId?: string;
  symbol?: string;
  decision: GovernanceDecisionOutcome | AuthorizationDecision;
  reason: string;
  supportingEvidence: string[];
  requiredActions: string[];
  nextReviewConditions: string[];
  checklist?: TradingGovernanceChecklistItem[];
  riskMetrics?: Record<string, number | string | boolean | null>;
  liveTradingEligibility?: LiveTradingEligibility;
  paperTradingProgress?: {
    currentSampleSize: number;
    requiredSampleSize: number;
    currentExpectancy: number;
    currentDrawdown: number;
    ruleCompliance: string;
    executionConsistency: string;
    status: string;
  };
  outcome?: "pending" | "followed" | "ignored" | "invalidated";
}

export interface TradingIncidentReport {
  id: string;
  createdAt: string;
  userId: string;
  tradeId?: string;
  thesisId?: string;
  symbol?: string;
  incident: string;
  cause: string;
  evidence: string[];
  rulesViolated: string[];
  potentialConsequences: string[];
  requiredCorrections: string[];
  futurePrevention: string[];
  linkedDecisionId: string;
}

export interface TradingKnowledgeEntry {
  id: string;
  createdAt: string;
  updatedAt: string;
  source: string;
  sourceType: "manual" | "trades_by_sci" | "journal" | "backtest" | "other";
  category: TradingKnowledgeCategory;
  title: string;
  concepts: string[];
  definitions: string[];
  rules: string[];
  patterns: string[];
  entryCriteria: string[];
  exitCriteria: string[];
  riskRules: string[];
  examples: string[];
  mistakes: string[];
  bestPractices: string[];
  tags: string[];
}

export interface TradeThesis {
  id: string;
  createdAt: string;
  archivedAt?: string;
  userId: string;
  market: string;
  assetClass: TradingAssetClass;
  symbol: string;
  direction: TradeDirection;
  status: SetupStatus;
  reason: string;
  marketStructure: string;
  liquidityAnalysis: string;
  timeframeAlignment: Record<string, string>;
  primaryTimeframe?: string;
  entryPlan: string;
  stopPlan: string;
  targetPlan: string;
  riskReward: number | null;
  invalidationConditions: string[];
  confidenceScore: number;
  /** Structured setup tag from the Market Structure Engine (e.g. "sweep_bos_bullish_ob"), when computed. */
  setupType?: string;
  outcome?: "unresolved" | "validated" | "invalidated" | "paper_traded";
  notes?: string;
  governanceDecisionId?: string;
  governanceDecision?: GovernanceDecisionOutcome;
}

export type PaperTradeStatus = "open" | "closed" | "cancelled";
export type PaperTradeManagementStyle = "bracket" | "stop_only" | "target_only" | "manual";

export interface TradeReviewReport {
  id: string;
  tradeId: string;
  thesisId?: string;
  createdAt: string;
  originalThesis: string;
  outcome: "win" | "loss" | "breakeven";
  executionQuality: "excellent" | "good" | "needs_work" | "poor";
  ruleCompliance: "clean" | "minor_violations" | "major_violations";
  mistakes: string[];
  lessonsLearned: string[];
  recommendedImprovements: string[];
}

export interface PaperTrade {
  id: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  userId: string;
  thesisId?: string;
  market: string;
  assetClass: TradingAssetClass;
  symbol: string;
  direction: TradeDirection;
  status: PaperTradeStatus;
  timeframe?: string;
  setupName?: string;
  /** External platform's response for the entry order (accepted or why not). */
  externalNote?: string;
  entry: number;
  stop: number;
  target: number;
  size: number;
  riskAmount: number;
  managementStyle?: PaperTradeManagementStyle;
  exitPrice?: number;
  realizedPnl?: number;
  unrealizedPnl?: number;
  outcome?: "win" | "loss" | "breakeven";
  entryReason: string;
  exitReason?: string;
  screenshots: string[];
  lessonsLearned: string[];
  ruleViolations: string[];
  reviewReport?: TradeReviewReport;
  authorizationDecisionId?: string;
  authorizationDecision?: AuthorizationDecision;
  executionMode?: "internal" | "external_paper" | "live";
  executionProvider?: "webull" | "tradovate" | "lucid" | "custom";
  externalOrderId?: string;
  externalOrderStatus?: "staged" | "submitted" | "filled" | "rejected" | "cancelled";
}

export interface TradingPatternAnalytics {
  highestWinRateSetups: string[];
  lowestWinRateSetups: string[];
  mostProfitableConditions: string[];
  mostCommonMistakes: string[];
  mostCommonRuleViolations: string[];
  bestAssetClasses: string[];
  worstAssetClasses: string[];
  bestTimeframes: string[];
  worstTimeframes: string[];
  /**
   * Outcome-based learning from the Market Structure Engine's setup tags
   * (e.g. "sweep_bos_bullish_ob"). Populated only for closed trades whose
   * linked thesis carries a `setupType` — null/empty until enough of
   * those exist to say anything meaningful.
   */
  structureLearning: {
    sweepSuccessRate: number | null;
    orderBlockPerformance: number | null;
    structuralContinuationRate: number | null;
    reversalFrequency: number | null;
    bestConfluenceCombinations: string[];
    worstConfluenceCombinations: string[];
    sampleSize: number;
  };
}

export interface TradingPerformanceReport {
  generatedAt: string;
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  winRate: number;
  averageRewardRisk: number;
  expectancy: number;
  profitFactor: number;
  averageWinner: number;
  averageLoser: number;
  realizedPnl: number;
  maximumDrawdown: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  mostSuccessfulSetups: string[];
  leastSuccessfulSetups: string[];
  patternAnalytics: TradingPatternAnalytics;
  notes: string[];
}
