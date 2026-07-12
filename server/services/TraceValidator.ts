import { logRuntimeEvent } from "./RuntimeLogger";

/**
 * Runtime trace validation. ChatExecutionService assembles a rich
 * ExecutionTrace object (traceId, route, selectedAgent, service
 * lists, provider, presentation adjustments, status). The trace
 * itself gets stored on the assistant message metadata and logged
 * to runtime.log — but nothing verifies the trace is coherent
 * before it lands.
 *
 * This validator turns end-to-end trace coherence from "hope it's
 * right" into a runtime guarantee: every trace goes through validateTrace
 * before it's saved, and a violation is written to runtime.log
 * with source=server, level=warn so operators can see traces that
 * came through with missing fields.
 *
 * The validator is intentionally non-blocking — a malformed trace
 * still gets saved (partial data > no data) but the violation is
 * recorded. The point is auditability, not enforcement.
 */

export interface TraceLike {
  traceId?: string;
  route?: string;
  executionStatus?: string;
  selectedAgent?: string | null;
  servicesInvoked?: string[];
  toolsInvoked?: string[];
  providerUsed?: string | null;
  presentationAdjustments?: string[];
  failureReason?: string | null;
  [k: string]: unknown;
}

export interface TraceValidationResult {
  valid: boolean;
  violations: string[];
}

/**
 * Structural checks. If a "success" trace has no services invoked
 * or no selected agent, something is wrong upstream — the trace
 * layer isn't recording what actually happened.
 */
export function validateTrace(trace: TraceLike): TraceValidationResult {
  const violations: string[] = [];

  if (!trace.traceId) violations.push("missing_traceId");
  if (!trace.route) violations.push("missing_route");
  if (!trace.executionStatus) violations.push("missing_executionStatus");

  const isTerminalSuccess = trace.executionStatus === "success";
  const isTerminalPartial = trace.executionStatus === "partial";

  if (isTerminalSuccess || isTerminalPartial) {
    if (!trace.selectedAgent) violations.push("missing_selectedAgent");
    if (!Array.isArray(trace.servicesInvoked) || trace.servicesInvoked.length === 0) {
      violations.push("empty_servicesInvoked");
    }
    if (!trace.providerUsed) violations.push("missing_providerUsed");
  }

  if (trace.executionStatus === "failed" && !trace.failureReason) {
    violations.push("failed_without_failureReason");
  }

  return { valid: violations.length === 0, violations };
}

/**
 * Validate + fire-and-forget log. Callers don't await the log write
 * because they're already about to save the trace elsewhere and
 * shouldn't be blocked by our audit line.
 */
export function auditTrace(trace: TraceLike): TraceValidationResult {
  const result = validateTrace(trace);
  if (!result.valid) {
    void logRuntimeEvent({
      level: "warn",
      source: "server",
      event: "trace.validation.violation",
      detail: result.violations.join(","),
      context: {
        traceId: trace.traceId,
        route: trace.route,
        executionStatus: trace.executionStatus,
        selectedAgent: trace.selectedAgent,
        violations: result.violations,
      },
    });
  }
  return result;
}
