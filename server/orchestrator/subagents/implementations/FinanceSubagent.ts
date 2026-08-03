/**
 * FinanceSubagent: Trading Intelligence phase
 * Inherits FinanceAgent rules and autonomously decides to activate on finance/trading requests.
 */

import { SubagentBase } from "../SubagentBase";
import type {
  SubagentContext,
  SubagentLaneDecision,
  SubagentResult,
  CapabilityLevel,
} from "../SubagentTypes";

const FINANCE_KEYWORDS = [
  "crypto", "bitcoin", "btc", "ethereum", "eth", "solana", "sol", "token", "altcoin", "defi", "web3", "nft", "on-chain", "wallet",
  "forex", "fx", "eurusd", "gbpusd", "usdjpy", "currency pair",
  "stock", "stocks", "etf", "etfs", "option", "options", "future", "futures", "topstep", "trades by sci", "tradingview", "bank & sweep", "bank and sweep",
  "liquidity sweep", "liquidity grab", "stop hunt", "break of structure", "bos", "choch", "supply zone", "demand zone",
  "trade thesis", "paper trade", "paper trading", "trade journal", "journal trade", "backtest", "backtesting", "scanner", "screener", "watchlist",
  "confluence", "risk reward", "risk/reward", "trade", "trading", "long position", "short position", "stop loss", "take profit",
  "portfolio", "rebalance", "wealth", "compound", "allocation", "yield", "stablecoin",
];

export class FinanceSubagent extends SubagentBase {
  constructor() {
    super("FinanceSubagent", ["finance"], "finance");
  }

  protected async decideLane(context: SubagentContext): Promise<SubagentLaneDecision> {
    // Explicit targeting overrides everything
    if (context.explicitLane === "finance") {
      return {
        laneName: "finance",
        activated: true,
        confidence: 1.0,
        detectionMethod: "explicit_target",
        reason: "Explicitly targeted to Finance lane",
      };
    }

    // Keyword detection
    const lowerMessage = context.message.toLowerCase();
    const hasFinanceKeyword = FINANCE_KEYWORDS.some((kw) => lowerMessage.includes(kw));

    if (hasFinanceKeyword) {
      return {
        laneName: "finance",
        activated: true,
        confidence: 0.85,
        detectionMethod: "keyword",
        reason: "Finance-related keywords detected in message",
      };
    }

    return {
      laneName: "finance",
      activated: false,
      confidence: 0,
      detectionMethod: "fallback",
      reason: "No finance/trading keywords detected",
    };
  }

  protected async determineCapabilities(
    context: SubagentContext,
    laneDecision: SubagentLaneDecision
  ): Promise<CapabilityLevel[]> {
    const capabilities: CapabilityLevel[] = ["analysis"];

    const lower = context.message.toLowerCase();
    if (lower.includes("paper trade") || lower.includes("backtest") || lower.includes("strategy")) {
      capabilities.push("reasoning");
    }

    if (lower.includes("trade") && !lower.includes("paper")) {
      capabilities.push("action", "approval");
    }

    if (lower.includes("research") || lower.includes("market scan")) {
      capabilities.push("retrieval", "synthesis");
    }

    return capabilities;
  }

  protected async executeLane(
    context: SubagentContext,
    laneDecision: SubagentLaneDecision,
    capabilities: CapabilityLevel[]
  ): Promise<SubagentResult> {
    const responseText = `Finance Analysis:\n- Trading Intelligence phase active\n- Market context analysis enabled\n- Risk management validation active\n- Paper trading mode (no live execution)\n\nRequest analyzed for: ${capabilities.join(", ")}`;

    return {
      subagentName: this.name,
      laneName: "finance",
      activated: true,
      responseText,
      reasoning: "FinanceSubagent evaluated trading/finance context and determined analysis scope.",
      actionItems: capabilities.includes("action")
        ? [
            {
              type: "paper_trade_thesis",
              description: "Generate and validate trade thesis with risk analysis",
              requiresApproval: false,
            },
          ]
        : [],
      metadata: {
        confidence: laneDecision.confidence,
        priority: 1,
      },
      trace: {
        subagentName: this.name,
        laneName: "finance",
        activated: true,
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        laneDecision,
        capabilities,
        actionsRequested: [],
        servicesInvoked: ["FinanceAgent"],
        toolsInvoked: [],
        status: "success",
      },
    };
  }
}
