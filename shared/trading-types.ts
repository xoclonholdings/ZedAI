export type TradingAssetClass = "stock" | "etf" | "crypto" | "forex";

export type TradeDirection = "long" | "short";

export type TradingKnowledgeCategory =
  | "market_structure"
  | "liquidity"
  | "trade_planning"
  | "risk_management"
  | "probability"
  | "multi_timeframe"
  | "journal_lesson"
  | "strategy_rule";

export type SetupStatus = "watch" | "observe" | "possible_setup" | "valid_setup" | "no_trade";

export interface TradingKnowledgeEntry {
  id: string;
  createdAt: string;
  updatedAt: string;
  source: string;
  sourceType: "manual" | "tradingview" | "trades_by_sci" | "journal" | "backtest" | "other";
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
  entryPlan: string;
  stopPlan: string;
  targetPlan: string;
  riskReward: number | null;
  invalidationConditions: string[];
  confidenceScore: number;
  notes?: string;
}

export type PaperTradeStatus = "open" | "closed" | "cancelled";

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
  notes: string[];
}
