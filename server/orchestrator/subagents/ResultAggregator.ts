/**
 * Aggregates parallel subagent results into a unified response.
 * Deduplicates, prioritizes, and synthesizes findings from multiple lanes.
 */

import type { SubagentResult, AggregatedResult, SubagentContext } from "./SubagentTypes";

export class ResultAggregator {
  /**
   * Aggregate multiple subagent results into a single synthesized response.
   */
  async aggregate(
    results: SubagentResult[],
    context: SubagentContext,
    totalExecutionTime: number
  ): Promise<AggregatedResult> {
    const activatedResults = results.filter((r) => r.activated);
    const activeLanes = Array.from(new Set(activatedResults.map((r) => r.laneName)));

    // Collect all action items with priority
    const allActions = activatedResults
      .flatMap((r) =>
        (r.actionItems || []).map((a) => ({
          lane: r.laneName,
          type: a.type,
          description: a.description,
          priority: r.metadata?.priority || 5,
          requiresApproval: a.requiresApproval,
        }))
      )
      .sort((a, b) => a.priority - b.priority);

    // Filter for approvals needed
    const pendingApprovals = allActions.filter((a) => a.requiresApproval);
    const approvalsRequired = pendingApprovals.length > 0;

    // Synthesize response text from active subagents
    const consolidatedResponse = this.synthesizeResponse(activatedResults, context);

    return {
      consolidatedResponse,
      activeLanes,
      subagentResults: results,
      prioritizedActions: allActions,
      synthesisStrategy: this.determineSynthesisStrategy(activeLanes.length),
      totalExecutionTime,
      approvalsRequired,
      pendingApprovals: pendingApprovals.map((a) => ({
        lane: a.lane,
        actionType: a.type,
        description: a.description,
      })),
    };
  }

  /**
   * Synthesize a consolidated response from multiple lane results.
   */
  private synthesizeResponse(results: SubagentResult[], context: SubagentContext): string {
    if (results.length === 0) {
      return "No subagents were activated for this request.";
    }

    if (results.length === 1) {
      return results[0].responseText || "";
    }

    const sections: string[] = [];

    // Group by lane and build sections
    const byLane = new Map<string, SubagentResult[]>();
    for (const result of results) {
      if (!byLane.has(result.laneName)) {
        byLane.set(result.laneName, []);
      }
      byLane.get(result.laneName)!.push(result);
    }

    // Build synthesized response
    for (const [lane, laneResults] of byLane) {
      for (const result of laneResults) {
        if (result.responseText) {
          sections.push(result.responseText);
        }
      }
    }

    if (sections.length === 0) {
      return "Request processed by " + results.map((r) => r.laneName).join(", ") + ".";
    }

    return sections.join("\n\n");
  }

  /**
   * Determine the synthesis strategy based on number of active lanes.
   */
  private determineSynthesisStrategy(laneCount: number): "parallel" | "sequential" | "hybrid" {
    if (laneCount <= 1) return "sequential";
    if (laneCount >= 3) return "parallel";
    return "hybrid";
  }
}
