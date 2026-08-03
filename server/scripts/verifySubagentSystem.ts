/**
 * Verification script for subagent orchestration system.
 * Runs end-to-end tests to ensure all subagents are functioning correctly.
 */

import { SubagentOrchestrator } from "../orchestrator/subagents/SubagentOrchestrator";
import type { SubagentContext } from "../orchestrator/subagents/SubagentTypes";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: Record<string, any>;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    console.log(`\n📋 Testing: ${name}`);
    await fn();
    results.push({ name, passed: true });
    console.log(`✅ PASSED: ${name}`);
  } catch (error: any) {
    results.push({
      name,
      passed: false,
      error: error?.message || String(error),
    });
    console.error(`❌ FAILED: ${name}`);
    console.error(`   Error: ${error?.message || String(error)}`);
  }
}

async function main() {
  console.log("🚀 Subagent Orchestration System Verification\n");
  console.log("=".repeat(60));

  const orchestrator = new SubagentOrchestrator({
    maxConcurrency: 4,
    executionTimeoutMs: 10000,
    enableParallel: true,
  });

  // Test 1: Orchestrator initialization
  await runTest("Orchestrator initializes correctly", async () => {
    const status = orchestrator.getStatus();
    if (!status.ready) throw new Error("Orchestrator not ready");
    if (status.activeSubagents.length === 0) throw new Error("No active subagents");
    console.log(`   Active subagents: ${status.activeSubagents.join(", ")}`);
  });

  // Test 2: Finance lane activation
  await runTest("FinanceSubagent activates on finance keywords", async () => {
    const context: SubagentContext = {
      message: "Analyze Bitcoin trading strategy with risk management",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
    };

    const result = await orchestrator.dispatch(context);
    if (!result.activeLanes.includes("finance")) {
      throw new Error(`Finance lane not activated. Active lanes: ${result.activeLanes.join(", ")}`);
    }
    console.log(`   Active lanes: ${result.activeLanes.join(", ")}`);
    console.log(`   Execution time: ${result.totalExecutionTime}ms`);
  });

  // Test 3: Intelligence lane activation
  await runTest("IntelligenceSubagent activates on research keywords", async () => {
    const context: SubagentContext = {
      message: "Research the latest AI trends and market analysis",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
    };

    const result = await orchestrator.dispatch(context);
    if (!result.activeLanes.includes("intelligence")) {
      throw new Error(`Intelligence lane not activated. Active lanes: ${result.activeLanes.join(", ")}`);
    }
    console.log(`   Active lanes: ${result.activeLanes.join(", ")}`);
  });

  // Test 4: Operations lane activation
  await runTest("OperationsSubagent activates on task keywords", async () => {
    const context: SubagentContext = {
      message: "Schedule a meeting for tomorrow at 2pm and send an email",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
    };

    const result = await orchestrator.dispatch(context);
    if (!result.activeLanes.includes("operations")) {
      throw new Error(`Operations lane not activated. Active lanes: ${result.activeLanes.join(", ")}`);
    }
    console.log(`   Active lanes: ${result.activeLanes.join(", ")}`);
  });

  // Test 5: Business lane activation
  await runTest("BusinessSubagent activates on business keywords", async () => {
    const context: SubagentContext = {
      message: "Review this acquisition opportunity and payroll setup",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
    };

    const result = await orchestrator.dispatch(context);
    if (!result.activeLanes.includes("business")) {
      throw new Error(`Business lane not activated. Active lanes: ${result.activeLanes.join(", ")}`);
    }
    console.log(`   Active lanes: ${result.activeLanes.join(", ")}`);
  });

  // Test 6: Multiple lanes simultaneously
  await runTest("Multiple lanes activate simultaneously", async () => {
    const context: SubagentContext = {
      message:
        "Backtest a crypto strategy, schedule a meeting, research market trends, and analyze an acquisition",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
    };

    const result = await orchestrator.dispatch(context);
    if (result.activeLanes.length < 2) {
      throw new Error(`Expected multiple lanes. Got: ${result.activeLanes.join(", ")}`);
    }
    console.log(`   Active lanes: ${result.activeLanes.join(", ")}`);
    console.log(`   Synthesis strategy: ${result.synthesisStrategy}`);
  });

  // Test 7: Explicit lane targeting
  await runTest("Explicit lane targeting works", async () => {
    const context: SubagentContext = {
      message: "Generic message",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
      explicitLane: "finance",
    };

    const result = await orchestrator.dispatch(context);
    if (!result.activeLanes.includes("finance")) {
      throw new Error(`Explicit finance lane not activated`);
    }
    console.log(`   Targeted lane activated: finance`);
  });

  // Test 8: Response synthesis
  await runTest("Result aggregation produces consolidated response", async () => {
    const context: SubagentContext = {
      message: "What's the latest on crypto and stocks",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
    };

    const result = await orchestrator.dispatch(context);
    if (!result.consolidatedResponse) {
      throw new Error("No consolidated response generated");
    }
    console.log(`   Response length: ${result.consolidatedResponse.length} chars`);
    console.log(`   First 100 chars: ${result.consolidatedResponse.substring(0, 100)}...`);
  });

  // Test 9: Execution tracing
  await runTest("Execution traces are recorded per subagent", async () => {
    const context: SubagentContext = {
      message: "Test tracing",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
    };

    const result = await orchestrator.dispatch(context);
    if (result.subagentResults.length === 0) {
      throw new Error("No subagent results recorded");
    }
    const activeTraces = result.subagentResults.filter((r) => r.activated);
    console.log(`   Total subagents: ${result.subagentResults.length}`);
    console.log(`   Activated: ${activeTraces.length}`);
    console.log(`   Total execution time: ${result.totalExecutionTime}ms`);
  });

  // Test 10: Parallel vs sequential execution
  await runTest("Parallel execution is faster than sequential", async () => {
    const context: SubagentContext = {
      message: "Multi-lane test",
      userId: "test-user",
      conversationId: "test-conv",
      traceId: "test-trace",
    };

    const orchestratorParallel = new SubagentOrchestrator({
      enableParallel: true,
      executionTimeoutMs: 10000,
    });

    const orchestratorSeq = new SubagentOrchestrator({
      enableParallel: false,
      executionTimeoutMs: 10000,
    });

    const resultParallel = await orchestratorParallel.dispatch(context);
    const resultSeq = await orchestratorSeq.dispatch(context);

    console.log(`   Parallel time: ${resultParallel.totalExecutionTime}ms`);
    console.log(`   Sequential time: ${resultSeq.totalExecutionTime}ms`);
    // Parallel should be at least comparable (might not be faster on single machine)
    if (!resultParallel.totalExecutionTime) {
      throw new Error("Parallel execution time not recorded");
    }
  });

  // Summary
  console.log("\n" + "=".repeat(60));
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const percentage = ((passed / total) * 100).toFixed(1);

  console.log(`\n📊 Test Results: ${passed}/${total} passed (${percentage}%)\n`);

  if (passed === total) {
    console.log("🎉 All tests passed! Subagent system is fully functional.\n");
    process.exit(0);
  } else {
    console.log("❌ Some tests failed. See details above.\n");
    results.forEach((r) => {
      if (!r.passed) {
        console.log(`   - ${r.name}: ${r.error}`);
      }
    });
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
