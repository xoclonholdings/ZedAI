/**
 * Abstract base class for all subagents.
 * Each subagent inherits lane detection, approval policy checking, and execution tracing.
 */

import { logRuntimeEvent } from "../../services/RuntimeLogger";
import type {
  SubagentName,
  LaneName,
  SubagentContext,
  SubagentLaneDecision,
  SubagentExecutionTrace,
  SubagentResult,
  CapabilityLevel,
} from "./SubagentTypes";

export abstract class SubagentBase {
  protected name: SubagentName;
  protected lanes: LaneName[];
  protected defaultLane: LaneName;

  constructor(name: SubagentName, lanes: LaneName[], defaultLane: LaneName) {
    this.name = name;
    this.lanes = lanes;
    this.defaultLane = defaultLane;
  }

  /**
   * Main entry point. Subagent decides which lane(s) to activate, then executes.
   */
  async execute(context: SubagentContext): Promise<SubagentResult> {
    const startTime = Date.now();
    const trace: SubagentExecutionTrace = {
      subagentName: this.name,
      laneName: this.defaultLane,
      activated: false,
      startTime,
      endTime: 0,
      duration: 0,
      laneDecision: { laneName: this.defaultLane, activated: false, confidence: 0, detectionMethod: "fallback" },
      capabilities: [],
      actionsRequested: [],
      servicesInvoked: [],
      toolsInvoked: [],
      status: "skipped",
    };

    try {
      // Step 1: Detect lane activation
      const laneDecision = await this.decideLane(context);
      trace.laneDecision = laneDecision;
      trace.laneName = laneDecision.laneName;
      trace.activated = laneDecision.activated;

      if (!laneDecision.activated) {
        trace.endTime = Date.now();
        trace.duration = trace.endTime - startTime;
        await logRuntimeEvent({
          level: "info",
          source: "orchestrator",
          event: "subagent.skipped",
          detail: `${this.name} skipped (lane ${laneDecision.laneName} not activated)`,
        });
        return { ...this.emptyResult(), trace };
      }

      // Step 2: Determine capabilities needed
      const capabilities = await this.determineCapabilities(context, laneDecision);
      trace.capabilities = capabilities;

      // Step 3: Check approval policy
      const approvalRequired = await this.checkApprovalPolicy(context, laneDecision, capabilities);

      // Step 4: Execute lane-specific logic
      const result = await this.executeLane(context, laneDecision, capabilities);
      trace.status = "success";
      trace.actionsRequested = result.actionItems?.map((a) => ({
        type: a.type,
        approvalRequired: a.requiresApproval,
        approvalStatus: approvalRequired ? "pending" : "auto",
      })) || [];

      trace.endTime = Date.now();
      trace.duration = trace.endTime - startTime;

      await logRuntimeEvent({
        level: "info",
        source: "orchestrator",
        event: "subagent.executed",
        detail: `${this.name} completed in ${trace.duration}ms (lane: ${laneDecision.laneName})`,
      });

      return { ...result, trace };
    } catch (error: any) {
      trace.status = "error";
      trace.failureReason = error?.message || String(error);
      trace.endTime = Date.now();
      trace.duration = trace.endTime - startTime;

      await logRuntimeEvent({
        level: "error",
        source: "orchestrator",
        event: "subagent.failed",
        detail: `${this.name} failed: ${error?.message || String(error)}`,
      });

      return {
        subagentName: this.name,
        laneName: trace.laneName,
        activated: false,
        trace,
        error: error?.message || String(error),
      };
    }
  }

  /**
   * Subclass overrides: decide whether this subagent's lane activates for this request.
   * Returns lane decision with confidence and detection method.
   */
  protected abstract decideLane(context: SubagentContext): Promise<SubagentLaneDecision>;

  /**
   * Subclass overrides: determine which capability levels this request needs from this lane.
   * e.g., "retrieval" | "analysis" | "action" | "approval" | "synthesis"
   */
  protected abstract determineCapabilities(
    context: SubagentContext,
    laneDecision: SubagentLaneDecision
  ): Promise<CapabilityLevel[]>;

  /**
   * Subclass overrides: execute the lane-specific logic.
   */
  protected abstract executeLane(
    context: SubagentContext,
    laneDecision: SubagentLaneDecision,
    capabilities: CapabilityLevel[]
  ): Promise<SubagentResult>;

  /**
   * Check approval policy for the requested actions in this lane.
   * Returns true if any action requires approval (in which case execution is deferred).
   */
  protected async checkApprovalPolicy(
    context: SubagentContext,
    laneDecision: SubagentLaneDecision,
    capabilities: CapabilityLevel[]
  ): Promise<boolean> {
    if (!context.approvalPolicy || !capabilities.includes("action")) {
      return false;
    }

    const policy = context.approvalPolicy;
    const lanePolicy = policy[laneDecision.laneName];

    if (!lanePolicy) return false;

    // Subclass can override for specific action types
    return lanePolicy === "ask" || lanePolicy === "Ask me";
  }

  /**
   * Common helper: empty result structure.
   */
  protected emptyResult(): Omit<SubagentResult, "trace"> {
    return {
      subagentName: this.name,
      laneName: this.defaultLane,
      activated: false,
      responseText: "",
      actionItems: [],
    };
  }
}
