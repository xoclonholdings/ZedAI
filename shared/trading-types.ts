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

export interface TradingKnowledgeEntry {
  id: string;
  createdAt: string;
  updatedAt: string;
  source: string;
  sourceType: "manual" | "tradingview" | "trades_by_sci" | "topstep" | "journal" | "backtest" | "other";
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
  outcome?: "unresolved" | "validated" | "invalidated" | "paper_traded";
  notes?: string;
}

export type PaperTradeStatus = "open" | "closed" | "cancelled";

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
  entry: number;
  stop: number;
  target: number;
  size: number;
  riskAmount: number;
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

export type TradingViewRecordType = "watchlist" | "alert" | "screener_result" | "note";

export interface TradingViewRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  type: TradingViewRecordType;
  symbol: string;
  assetClass: TradingAssetClass;
  timeframe?: string;
  title: string;
  status: "active" | "resolved" | "archived";
  chartUrl?: string;
  trigger?: string;
  notes: string;
  tags: string[];
}
