/**
 * Main orchestrator that dispatches subagents in parallel and aggregates results.
 * ZAR gives the order (via Cognitive Core), user provides parameters, subagents execute autonomously.
 */

import { logRuntimeEvent } from "../../services/RuntimeLogger";
import { SubagentFactory } from "./SubagentFactory";
import { ResultAggregator } from "./ResultAggregator";
import type {
  SubagentContext,
  SubagentResult,
  AggregatedResult,
  SubagentPoolConfig,
} from "./SubagentTypes";

export class SubagentOrchestrator {
  private factory: SubagentFactory;
  private aggregator: ResultAggregator;
  private defaultPoolConfig: SubagentPoolConfig = {
    maxConcurrency: 4,
    executionTimeoutMs: 30000,
    enableParallel: true,
    disabledSubagents: [],
  };

  constructor(poolConfig?: Partial<SubagentPoolConfig>) {
    const config = { ...this.defaultPoolConfig, ...poolConfig };
    this.factory = new SubagentFactory(config);
    this.aggregator = new ResultAggregator();
  }

  /**
   * Main entry point: dispatch message to subagent pool and return aggregated result.
   * ZAR has already applied Lexicon Authority, Governance, and Principle Engine to context.
   */
  async dispatch(context: SubagentContext): Promise<AggregatedResult> {
    const dispatchStartTime = Date.now();

    await logRuntimeEvent({
      level: "info",
      source: "orchestrator",
      event: "dispatch.start",
      detail: `Dispatching to subagent pool (${this.factory.getActiveSubagents().length} active)`,
    });

    const subagents = this.factory.getActiveSubagents();

    let results: SubagentResult[];

    const config = this.factory.getConfig();
    if (config.enableParallel) {
      results = await this.dispatchParallel(subagents, context);
    } else {
      results = await this.dispatchSequential(subagents, context);
    }

    const dispatchEndTime = Date.now();
    const totalExecutionTime = dispatchEndTime - dispatchStartTime;

    const aggregated = await this.aggregator.aggregate(results, context, totalExecutionTime);

    await logRuntimeEvent({
      level: "info",
      source: "orchestrator",
      event: "dispatch.complete",
      detail: `Aggregated ${results.length} subagent results in ${totalExecutionTime}ms (active lanes: ${aggregated.activeLanes.join(", ")})`,
    });

    return aggregated;
  }

  /**
   * Parallel dispatch: execute all subagents concurrently with timeout.
   */
  private async dispatchParallel(subagents: any[], context: SubagentContext): Promise<SubagentResult[]> {
    const config = this.factory.getConfig();
    const timeout = config.executionTimeoutMs;

    const promises = subagents.map((subagent) =>
      Promise.race([
        subagent.execute(context),
        this.timeoutPromise(timeout, subagent.constructor.name),
      ]).catch((err) => ({
        subagentName: subagent.constructor.name,
        laneName: "operations",
        activated: false,
        trace: {
          subagentName: subagent.constructor.name,
          laneName: "operations",
          activated: false,
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 0,
          laneDecision: { laneName: "operations", activated: false, confidence: 0, detectionMethod: "fallback" },
          capabilities: [],
          actionsRequested: [],
          servicesInvoked: [],
          toolsInvoked: [],
          status: "error",
          failureReason: err?.message || String(err),
        },
        error: err?.message || String(err),
      }))
    );

    return Promise.all(promises);
  }

  /**
   * Sequential dispatch: execute subagents one at a time (for debugging).
   */
  private async dispatchSequential(subagents: any[], context: SubagentContext): Promise<SubagentResult[]> {
    const results: SubagentResult[] = [];
    for (const subagent of subagents) {
      const result = await subagent.execute(context);
      results.push(result);
    }
    return results;
  }

  /**
   * Timeout helper: rejects after N milliseconds.
   */
  private timeoutPromise(ms: number, subagentName: string): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Subagent ${subagentName} timed out after ${ms}ms`)), ms)
    );
  }

  /**
   * Update pool configuration (e.g., enable/disable subagents, change concurrency).
   */
  updatePoolConfig(config: Partial<SubagentPoolConfig>): void {
    this.factory.updateConfig(config);
  }

  /**
   * Get orchestrator status.
   */
  getStatus(): {
    activeSubagents: string[];
    config: SubagentPoolConfig;
    ready: boolean;
  } {
    return {
      activeSubagents: this.factory.getActiveSubagents().map((s) => s.constructor.name),
      config: this.factory.getConfig(),
      ready: this.factory.getActiveSubagents().length > 0,
    };
  }
}
