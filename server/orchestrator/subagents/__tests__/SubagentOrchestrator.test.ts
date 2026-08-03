/**
 * Tests for SubagentOrchestrator and subagent implementations.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SubagentOrchestrator } from "../SubagentOrchestrator";
import { FinanceSubagent } from "../implementations/FinanceSubagent";
import { IntelligenceSubagent } from "../implementations/IntelligenceSubagent";
import { OperationsSubagent } from "../implementations/OperationsSubagent";
import { BusinessSubagent } from "../implementations/BusinessSubagent";
import type { SubagentContext } from "../SubagentTypes";

describe("SubagentOrchestrator", () => {
  let orchestrator: SubagentOrchestrator;

  beforeEach(() => {
    orchestrator = new SubagentOrchestrator({
      maxConcurrency: 4,
      executionTimeoutMs: 10000,
      enableParallel: true,
    });
  });

  it("should initialize with active subagents", () => {
    const status = orchestrator.getStatus();
    expect(status.ready).toBe(true);
    expect(status.activeSubagents.length).toBeGreaterThan(0);
  });

  it("should dispatch and aggregate results", async () => {
    const context: SubagentContext = {
      message: "Analyze Bitcoin trading strategy with risk management",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
    };

    const result = await orchestrator.dispatch(context);

    expect(result.consolidatedResponse).toBeDefined();
    expect(result.activeLanes.length).toBeGreaterThan(0);
    expect(result.subagentResults.length).toBeGreaterThan(0);
  });

  it("should activate FinanceSubagent on finance keywords", async () => {
    const context: SubagentContext = {
      message: "Show me a paper trading backtest for crypto",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
    };

    const result = await orchestrator.dispatch(context);

    expect(result.activeLanes).toContain("finance");
  });

  it("should activate IntelligenceSubagent on research keywords", async () => {
    const context: SubagentContext = {
      message: "Research the latest AI trends and news",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
    };

    const result = await orchestrator.dispatch(context);

    expect(result.activeLanes).toContain("intelligence");
  });

  it("should activate OperationsSubagent on task keywords", async () => {
    const context: SubagentContext = {
      message: "Schedule a meeting for tomorrow at 2pm",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
    };

    const result = await orchestrator.dispatch(context);

    expect(result.activeLanes).toContain("operations");
  });

  it("should activate BusinessSubagent on business keywords", async () => {
    const context: SubagentContext = {
      message: "Review this acquisition opportunity",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
    };

    const result = await orchestrator.dispatch(context);

    expect(result.activeLanes).toContain("business");
  });

  it("should handle explicit lane targeting", async () => {
    const context: SubagentContext = {
      message: "Help me with something",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
      explicitLane: "finance",
    };

    const result = await orchestrator.dispatch(context);

    expect(result.activeLanes).toContain("finance");
  });

  it("should track execution time", async () => {
    const context: SubagentContext = {
      message: "Test timing",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
    };

    const result = await orchestrator.dispatch(context);

    expect(result.totalExecutionTime).toBeGreaterThan(0);
  });

  it("should support parallel and sequential modes", async () => {
    const orchestratorParallel = new SubagentOrchestrator({
      enableParallel: true,
      executionTimeoutMs: 10000,
    });

    const orchestratorSeq = new SubagentOrchestrator({
      enableParallel: false,
      executionTimeoutMs: 10000,
    });

    const context: SubagentContext = {
      message: "Test multi-lane",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
    };

    const resultParallel = await orchestratorParallel.dispatch(context);
    const resultSeq = await orchestratorSeq.dispatch(context);

    expect(resultParallel.synthesisStrategy).toBeDefined();
    expect(resultSeq.synthesisStrategy).toBeDefined();
  });

  it("should correctly identify inactive subagents", async () => {
    const context: SubagentContext = {
      message: "xyz abc 123",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
    };

    const result = await orchestrator.dispatch(context);

    const inactiveResults = result.subagentResults.filter((r) => !r.activated);
    expect(inactiveResults.length).toBeGreaterThan(0);
  });
});

describe("FinanceSubagent", () => {
  it("should detect finance keywords", async () => {
    const subagent = new FinanceSubagent();
    const context: SubagentContext = {
      message: "backtest a crypto strategy",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
    };

    const result = await subagent.execute(context);

    expect(result.activated).toBe(true);
    expect(result.laneName).toBe("finance");
  });
});

describe("IntelligenceSubagent", () => {
  it("should detect research keywords", async () => {
    const subagent = new IntelligenceSubagent();
    const context: SubagentContext = {
      message: "research the latest trends",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
    };

    const result = await subagent.execute(context);

    expect(result.activated).toBe(true);
    expect(result.laneName).toBe("intelligence");
  });
});

describe("OperationsSubagent", () => {
  it("should detect operations keywords", async () => {
    const subagent = new OperationsSubagent();
    const context: SubagentContext = {
      message: "create a task for tomorrow",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
    };

    const result = await subagent.execute(context);

    expect(result.activated).toBe(true);
    expect(result.laneName).toBe("operations");
  });
});

describe("BusinessSubagent", () => {
  it("should detect business keywords", async () => {
    const subagent = new BusinessSubagent();
    const context: SubagentContext = {
      message: "analyze an acquisition",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
    };

    const result = await subagent.execute(context);

    expect(result.activated).toBe(true);
    expect(result.laneName).toBe("business");
  });
});
