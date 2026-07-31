import { logRuntimeEvent } from "./RuntimeLogger";
import {
  DigitalExecutionService,
  type DigitalExecutionRequest,
  type DigitalExecutionResult,
} from "./execution/DigitalExecutionService";

/**
 * ZAR's runtime-error self-repair loop.
 *
 * When a runtime action fails, this layer inspects the failure,
 * chooses a bounded repair strategy, and retries — instead of just
 * writing the error to a log and moving on. Every strategy attempt
 * is recorded in a reasoning trail that gets returned alongside the
 * final result so operators can see what ZAR tried before it
 * either recovered or gave up.
 *
 * Design principles:
 *   - Bounded: at most REPAIR_MAX_ATTEMPTS (3) per call. No unbounded
 *     retry storms.
 *   - Deterministic first: strategies are keyed off the typed
 *     failureReason. LLM reasoning is an escape hatch for unknown
 *     failures, not the default — we don't want the model inventing
 *     "helpful" retries against providers that are truly down.
 *   - Honest: if repair can't succeed, the caller sees the final
 *     failure and the full trail. Nothing is faked.
 *
 * SPEC.md § Runtime Error Self-Repair documents this layer.
 */

const REPAIR_MAX_ATTEMPTS = 3;

export type RepairStrategy =
  | "retry_with_backoff"
  | "wait_for_provider"
  | "mark_provider_disabled"
  | "escalate_to_user"
  | "abandon";

export interface RepairAttempt {
  attempt: number;
  strategy: RepairStrategy;
  reason: string;
  result: {
    status: DigitalExecutionResult["status"];
    failureReason?: string;
    detail: string;
  };
  waitedMs?: number;
}

export interface SelfRepairOutcome {
  finalResult: DigitalExecutionResult;
  attempts: RepairAttempt[];
  repaired: boolean;
  totalWaitMs: number;
}

/**
 * Map a failureReason (from DigitalExecutionService) to the strategy
 * we'll try. Anything unlisted defaults to abandon — we don't
 * silently retry unknown failure modes.
 */
function strategyFor(failureReason: string | undefined): RepairStrategy {
  switch (failureReason) {
    case "smtpDispatchFailed":
      // Transient SMTP failures usually resolve on retry.
      return "retry_with_backoff";
    case "providerDisabled":
      // Provider is intentionally off; retrying won't help.
      return "escalate_to_user";
    case "providerNotConfigured":
      // Missing credentials — user must configure before retry.
      return "escalate_to_user";
    case "emailProviderMissing":
      // Nodemailer not available — a code/deploy issue.
      return "escalate_to_user";
    default:
      return "abandon";
  }
}

function backoffMs(attempt: number): number {
  // 1s, 3s, 7s — exponential with a small base so we don't hang the caller.
  return Math.min(1_000 * (2 ** attempt - 1) + 1_000, 10_000);
}

async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SelfRepairService {
  /**
   * Run a digital execution request through the self-repair loop.
   * On the first attempt we just try. On subsequent attempts we
   * pick a strategy from the previous failure's failureReason.
   */
  static async executeWithRepair(
    request: DigitalExecutionRequest,
  ): Promise<SelfRepairOutcome> {
    const attempts: RepairAttempt[] = [];
    let totalWaitMs = 0;
    let last: DigitalExecutionResult = await DigitalExecutionService.execute(request);

    attempts.push({
      attempt: 1,
      strategy: "retry_with_backoff",
      reason: "initial attempt",
      result: {
        status: last.status,
        failureReason: last.failureReason,
        detail: last.result,
      },
    });

    let n = 1;
    while (last.status === "failed" && n < REPAIR_MAX_ATTEMPTS) {
      const strategy = strategyFor(last.failureReason);
      if (strategy === "escalate_to_user" || strategy === "abandon") {
        attempts.push({
          attempt: n + 1,
          strategy,
          reason: `Strategy ${strategy} for failureReason=${last.failureReason || "unknown"} — not retried.`,
          result: {
            status: last.status,
            failureReason: last.failureReason,
            detail: last.result,
          },
        });
        break;
      }

      const waitMs = strategy === "retry_with_backoff" ? backoffMs(n) : 500;
      await wait(waitMs);
      totalWaitMs += waitMs;

      const next = await DigitalExecutionService.execute(request);
      n += 1;
      attempts.push({
        attempt: n,
        strategy,
        reason: `Retry ${n} after failureReason=${last.failureReason || "unknown"}`,
        result: {
          status: next.status,
          failureReason: next.failureReason,
          detail: next.result,
        },
        waitedMs: waitMs,
      });
      last = next;
    }

    const repaired = last.status === "success" && attempts.length > 1;

    void logRuntimeEvent({
      level: last.status === "success" ? "info" : "warn",
      source: "server",
      event: "self_repair.outcome",
      detail: `${last.status} — attempts=${attempts.length} repaired=${repaired}`,
      context: {
        taskId: request.task_id,
        actionType: request.action_type,
        finalStatus: last.status,
        finalFailureReason: last.failureReason,
        attempts: attempts.map((a) => ({
          attempt: a.attempt,
          strategy: a.strategy,
          status: a.result.status,
          failureReason: a.result.failureReason,
        })),
        totalWaitMs,
      },
    });

    return {
      finalResult: last,
      attempts,
      repaired,
      totalWaitMs,
    };
  }
}
