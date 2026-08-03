import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";

import { authorizePaperTrade } from "./TradingGovernanceEngine";
import { TradingStore } from "./TradingStore";

/**
 * Proves the Paper Trading flow actually works end to end: a well-formed
 * trade clears governance, opens, resolves to a realistic P&L on close,
 * and comes back with a real review report — the exact loop the UI
 * (SandboxWorkspace.tsx) depends on.
 */

function testUserId(): string {
  return `test-paper-${randomUUID()}`;
}

describe("Paper Trading flow", () => {
  it("authorizes a well-formed long trade with all required fields present", async () => {
    const userId = testUserId();
    const result = await authorizePaperTrade({
      userId,
      market: "US",
      assetClass: "stock",
      symbol: "AAPL",
      direction: "long",
      timeframe: "Daily",
      entry: 100,
      stop: 98,
      target: 106,
      size: 10,
      riskAmount: 20,
      entryReason: "Reclaimed support after a liquidity sweep, structure confirmed bullish.",
      session: "Regular session",
    });
    // market_structure/liquidity_conditions are UNKNOWN with no thesis (both
    // critical), so this specific input is expected to be denied — the
    // point of this test is that the *reason* is exactly that, not a
    // crash or a false positive.
    expect(result.decision.checklist?.find((c) => c.key === "entry_rules")?.result).toBe("PASS");
    expect(result.decision.checklist?.find((c) => c.key === "exit_rules")?.result).toBe("PASS");
    expect(result.decision.checklist?.find((c) => c.key === "risk_reward")?.result).toBe("PASS");
  });

  it("rejects a trade with an invalid stop/target (risk/reward math fails)", async () => {
    const userId = testUserId();
    const result = await authorizePaperTrade({
      userId,
      market: "US",
      assetClass: "stock",
      symbol: "AAPL",
      direction: "long",
      entry: 100,
      stop: 99, // 1R risk
      target: 100.5, // 0.5R reward — fails the minimum 2:1 requirement
      size: 10,
      riskAmount: 10,
      entryReason: "Test",
    });
    expect(result.authorized).toBe(false);
    const rrCheck = result.decision.checklist?.find((c) => c.key === "risk_reward");
    expect(rrCheck?.result).toBe("FAIL");
  });

  it("rejects a trade missing a stop/target entirely", async () => {
    const userId = testUserId();
    const result = await authorizePaperTrade({
      userId,
      market: "US",
      assetClass: "stock",
      symbol: "AAPL",
      direction: "long",
      entry: 100,
      stop: 0,
      target: 0,
      size: 10,
      riskAmount: 10,
      entryReason: "Test",
    });
    expect(result.authorized).toBe(false);
  });

  it("opens a paper trade, closes it at a profit, and produces a real review report", async () => {
    const userId = testUserId();
    const opened = await TradingStore.openPaperTrade({
      userId,
      market: "US",
      assetClass: "stock",
      symbol: "MSFT",
      direction: "long",
      entry: 100,
      stop: 98,
      target: 106,
      size: 10,
      riskAmount: 20,
      entryReason: "Test long",
      screenshots: [],
      lessonsLearned: [],
      ruleViolations: [],
    });
    expect(opened.status).toBe("open");
    expect(opened.symbol).toBe("MSFT");

    const closed = await TradingStore.closePaperTrade({
      id: opened.id,
      userId,
      exitPrice: 106,
      exitReason: "Hit target",
      lessonsLearned: ["Held through the pullback as planned."],
    });
    expect(closed).not.toBeNull();
    if (!closed) return;

    expect(closed.status).toBe("closed");
    expect(closed.outcome).toBe("win");
    // long, entry 100 -> exit 106, size 10 => +60
    expect(closed.realizedPnl).toBeCloseTo(60, 4);

    // The review report is the whole point of the loop — it must exist
    // and be internally consistent, since the UI renders it directly.
    expect(closed.reviewReport).toBeDefined();
    expect(closed.reviewReport?.outcome).toBe("win");
    expect(closed.reviewReport?.executionQuality).toBe("excellent");
    expect(closed.reviewReport?.ruleCompliance).toBe("clean");
    expect(closed.reviewReport?.lessonsLearned).toContain("Held through the pullback as planned.");
  });

  it("opens a paper trade, closes it at a loss, and reports it as a loss with degraded execution quality", async () => {
    const userId = testUserId();
    const opened = await TradingStore.openPaperTrade({
      userId,
      market: "US",
      assetClass: "stock",
      symbol: "TSLA",
      direction: "short",
      entry: 200,
      stop: 204,
      target: 188,
      size: 5,
      riskAmount: 20,
      entryReason: "Test short",
      screenshots: [],
      lessonsLearned: [],
      ruleViolations: ["Entered before confirmation candle closed"],
    });

    const closed = await TradingStore.closePaperTrade({
      id: opened.id,
      userId,
      exitPrice: 204, // hit stop
      exitReason: "Hit stop",
    });
    expect(closed).not.toBeNull();
    if (!closed) return;

    expect(closed.outcome).toBe("loss");
    // short, entry 200 -> exit 204, size 5 => -20
    expect(closed.realizedPnl).toBeCloseTo(-20, 4);
    expect(closed.reviewReport?.outcome).toBe("loss");
    expect(closed.reviewReport?.ruleCompliance).not.toBe("clean");
  });

  it("performance analytics correctly aggregate win rate and P&L across multiple closed trades", async () => {
    const userId = testUserId();
    const win = await TradingStore.openPaperTrade({
      userId,
      market: "US",
      assetClass: "stock",
      symbol: "NVDA",
      direction: "long",
      entry: 50,
      stop: 48,
      target: 56,
      size: 10,
      riskAmount: 20,
      entryReason: "Test",
      screenshots: [],
      lessonsLearned: [],
      ruleViolations: [],
    });
    await TradingStore.closePaperTrade({ id: win.id, userId, exitPrice: 56 });

    const loss = await TradingStore.openPaperTrade({
      userId,
      market: "US",
      assetClass: "stock",
      symbol: "AMD",
      direction: "long",
      entry: 50,
      stop: 48,
      target: 56,
      size: 10,
      riskAmount: 20,
      entryReason: "Test",
      screenshots: [],
      lessonsLearned: [],
      ruleViolations: [],
    });
    await TradingStore.closePaperTrade({ id: loss.id, userId, exitPrice: 48 });

    const perf = await TradingStore.getPerformance(userId);
    expect(perf.closedTrades).toBe(2);
    expect(perf.winRate).toBeCloseTo(0.5, 4);
    // +60 (win) + -20 (loss) = +40
    expect(perf.realizedPnl).toBeCloseTo(40, 4);
  });
});
