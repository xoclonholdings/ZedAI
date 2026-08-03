/**
 * Tests for SubagentOrchestrator and subagent implementations.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

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
    assert.strictEqual(status.ready, true);
    assert.ok(status.activeSubagents.length > 0);
  });

  it("should dispatch and aggregate results", async () => {
    const context: SubagentContext = {
      message: "Analyze Bitcoin trading strategy with risk management",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
    };

    const result = await orchestrator.dispatch(context);

    assert.notStrictEqual(result.consolidatedResponse, undefined);
    assert.ok(result.activeLanes.length > 0);
    assert.ok(result.subagentResults.length > 0);
  });

  it("should activate FinanceSubagent on finance keywords", async () => {
    const context: SubagentContext = {
      message: "Show me a paper trading backtest for crypto",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
    };

    const result = await orchestrator.dispatch(context);

    assert.ok(result.activeLanes.includes("finance"));
  });

  it("should activate IntelligenceSubagent on research keywords", async () => {
    const context: SubagentContext = {
      message: "Research the latest AI trends and news",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
    };

    const result = await orchestrator.dispatch(context);

    assert.ok(result.activeLanes.includes("intelligence"));
  });

  it("should activate OperationsSubagent on task keywords", async () => {
    const context: SubagentContext = {
      message: "Schedule a meeting for tomorrow at 2pm",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
    };

    const result = await orchestrator.dispatch(context);

    assert.ok(result.activeLanes.includes("operations"));
  });

  it("should activate BusinessSubagent on business keywords", async () => {
    const context: SubagentContext = {
      message: "Review this acquisition opportunity",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
    };

    const result = await orchestrator.dispatch(context);

    assert.ok(result.activeLanes.includes("business"));
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

    assert.ok(result.activeLanes.includes("finance"));
  });

  it("should track execution time", async () => {
    const context: SubagentContext = {
      message: "Test timing",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
    };

    const result = await orchestrator.dispatch(context);

    assert.ok(result.totalExecutionTime > 0);
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

    assert.notStrictEqual(resultParallel.synthesisStrategy, undefined);
    assert.notStrictEqual(resultSeq.synthesisStrategy, undefined);
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
    assert.ok(inactiveResults.length > 0);
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

    assert.strictEqual(result.activated, true);
    assert.strictEqual(result.laneName, "finance");
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

    assert.strictEqual(result.activated, true);
    assert.strictEqual(result.laneName, "intelligence");
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

    assert.strictEqual(result.activated, true);
    assert.strictEqual(result.laneName, "operations");
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

    assert.strictEqual(result.activated, true);
    assert.strictEqual(result.laneName, "business");
  });
});
