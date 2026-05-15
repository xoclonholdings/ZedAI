import { executeProviderChat } from "../../core/providers/provider-executor";
import { logRuntimeEvent } from "../RuntimeLogger";
import { FlowStore } from "../FlowStore";
import type {
  FlowAgentKey,
  FlowDefinition,
  FlowRun,
  FlowStage,
  FlowStageRun,
} from "../../../shared/flow-types";

/**
 * Lane key used when calling the model for a given agent. Flow stages
 * already have an assignedAgent that matches our existing per-lane
 * routing (chat / manager / operations / research / business / finance
 * via MODEL_<LANE> env vars).
 */
function laneForAgent(agent: FlowAgentKey | undefined): string {
  if (!agent) return "manager";
  switch (agent) {
    case "operations":
    case "research":
    case "business":
    case "finance":
    case "manager":
      return agent;
    // No dedicated lanes for these — bucket them under the most
    // semantically-aligned existing lane.
    case "content":
      return "operations";
    case "security":
      return "manager";
    default:
      return "manager";
  }
}

const SYSTEM_PROMPTS: Record<FlowAgentKey, string> = {
  operations:
    "You are the Operations Agent inside the ZED flow execution engine. " +
    "You are responsible for scheduling, routing, task assignment, and structured operational output. " +
    "Be concrete and decisive. Produce checklists, schedules, and assignments — not paragraphs.",
  research:
    "You are the Research / Intelligence Agent. " +
    "Synthesize information into clear findings. Cite sources where applicable. " +
    "Identify what's known, what's uncertain, and what to verify next.",
  business:
    "You are the Business Manager Agent. " +
    "Focus on commerce, strategy, partnerships, and prioritization by impact. " +
    "Use the 80/20 lens — call out the highest-leverage action explicitly.",
  finance:
    "You are the Finance Agent. " +
    "Be precise with numbers, conservative on risk, and explicit about assumptions. " +
    "Recommend cash, savings, credit, and investment actions based on actual ratios.",
  content:
    "You are the Content Agent. " +
    "Produce written deliverables: drafts, outlines, social posts, email copy. " +
    "Write in the brand voice the flow context establishes. Mark sections that need review.",
  security:
    "You are the Security Agent. " +
    "Apply incident-response discipline: classify severity, contain risk, identify root cause, " +
    "and produce a postmortem. Never weaken a guard to fix a symptom.",
  manager:
    "You are the Manager Agent. Coordinate across other agents and produce a synthesizing summary.",
};

/**
 * Build the user-facing prompt for one stage. The system prompt comes
 * from SYSTEM_PROMPTS[stage.assignedAgent]; this returns the body.
 */
function buildStagePrompt(opts: {
  flow: FlowDefinition;
  stage: FlowStage;
  priorOutputs: Record<string, unknown>;
  initialContext: Record<string, unknown>;
}): string {
  const { flow, stage, priorOutputs, initialContext } = opts;
  const stepLines = stage.steps
    .sort((a, b) => a.order - b.order)
    .map((s, i) => `${i + 1}. ${s.label}${s.detail ? ` — ${s.detail}` : ""}`)
    .join("\n");

  const priorBlock = Object.entries(priorOutputs)
    .map(([stageName, output]) => {
      const text =
        typeof output === "string" ? output : JSON.stringify(output, null, 2);
      return `### From earlier stage "${stageName}"\n${text}`;
    })
    .join("\n\n");

  const initBlock = Object.keys(initialContext).length
    ? `### Initial context from the user\n${JSON.stringify(initialContext, null, 2)}`
    : "";

  return [
    `## Flow: ${flow.name}`,
    `## Stage: ${stage.name}`,
    flow.purpose ? `Flow purpose: ${flow.purpose}` : "",
    stage.description ? `Stage goal: ${stage.description}` : "",
    "",
    `Steps to address:\n${stepLines}`,
    "",
    initBlock,
    priorBlock,
    "",
    "Produce a concrete, structured output for THIS stage only. Use markdown. " +
      "Be decisive. Where the next stage will need something specific from you, " +
      "make sure it's clearly labeled in your response.",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Set of run IDs currently executing in-process. Prevents double-kickoff
 * if the same run gets advanced twice in quick succession (e.g. user
 * double-taps Approve before the UI updates).
 */
const inFlight = new Set<string>();

/**
 * Drive a FlowRun forward from its current stage until either:
 *  - it completes,
 *  - it hits a stage that requires approval (status = awaiting_approval),
 *  - a stage fails (status = failed).
 *
 * Safe to call repeatedly — re-entry on the same runId is a no-op while
 * the previous invocation is still running.
 */
export async function executeFlowRun(runId: string): Promise<void> {
  if (inFlight.has(runId)) return;
  inFlight.add(runId);
  try {
    let run = await FlowStore.getRun(runId);
    if (!run) return;
    const flow = await FlowStore.getDefinition(run.flowId);
    if (!flow) {
      await FlowStore.updateRun(runId, {
        status: "failed",
      });
      return;
    }

    if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
      return;
    }

    // Mark running on first entry from queued.
    if (run.status === "queued") {
      run = (await FlowStore.updateRun(runId, { status: "running" })) || run;
    }

    const orderedStages = [...flow.stages].sort((a, b) => a.order - b.order);

    for (const stage of orderedStages) {
      const stageRun = run.stageRuns.find((sr) => sr.stageId === stage.id);
      if (!stageRun) continue;

      // Skip stages already completed (resume from approval gate).
      if (stageRun.status === "completed" || stageRun.status === "skipped") continue;

      // If this stage is awaiting approval, stop — caller resumes via
      // /api/flows/runs/:runId/approve which calls executeFlowRun again.
      if (stageRun.status === "awaiting_approval") {
        run = (await FlowStore.updateRun(runId, {
          status: "awaiting_approval",
          currentStageId: stage.id,
        })) || run;
        return;
      }

      // Approval gate on a not-yet-run stage: pause without running.
      if (stage.requiresApproval && stageRun.status === "pending") {
        await markStage(runId, stage.id, {
          status: "awaiting_approval",
          startedAt: new Date().toISOString(),
        });
        run = (await FlowStore.updateRun(runId, {
          status: "awaiting_approval",
          currentStageId: stage.id,
        })) || run;
        return;
      }

      // Actually run the stage.
      await markStage(runId, stage.id, {
        status: "running",
        startedAt: new Date().toISOString(),
      });
      run = (await FlowStore.updateRun(runId, {
        status: "running",
        currentStageId: stage.id,
      })) || run;

      try {
        const priorOutputs: Record<string, unknown> = {};
        for (const prev of orderedStages) {
          if (prev.id === stage.id) break;
          const prevRun = run.stageRuns.find((sr) => sr.stageId === prev.id);
          if (prevRun?.output != null) priorOutputs[prev.name] = prevRun.output;
        }
        const prompt = buildStagePrompt({
          flow,
          stage,
          priorOutputs,
          initialContext: run.context || {},
        });
        const systemPrompt =
          SYSTEM_PROMPTS[stage.assignedAgent as FlowAgentKey] || SYSTEM_PROMPTS.manager;
        const lane = laneForAgent(stage.assignedAgent);
        const reply = await executeProviderChat(
          [{ role: "user", content: prompt }],
          { systemPrompt, lane: lane as any },
        );
        await markStage(runId, stage.id, {
          status: "completed",
          completedAt: new Date().toISOString(),
          output: reply,
        });
        // Refresh local snapshot
        run = (await FlowStore.getRun(runId)) || run;
        await logRuntimeEvent({
          level: "info",
          source: "server",
          event: "flow.stage.completed",
          detail: `${flow.slug} :: ${stage.name}`,
          context: { runId, stageId: stage.id, agent: stage.assignedAgent },
        });
      } catch (err: any) {
        const detail = err?.message || String(err);
        await markStage(runId, stage.id, {
          status: "failed",
          completedAt: new Date().toISOString(),
          error: detail,
        });
        await FlowStore.updateRun(runId, { status: "failed" });
        await logRuntimeEvent({
          level: "error",
          source: "server",
          event: "flow.stage.failed",
          detail,
          context: {
            runId,
            stageId: stage.id,
            agent: stage.assignedAgent,
            errorKind: err?.constructor?.name,
          },
        });
        return;
      }
    }

    await FlowStore.updateRun(runId, {
      status: "completed",
      completedAt: new Date().toISOString(),
      currentStageId: undefined,
    });
    await logRuntimeEvent({
      level: "info",
      source: "server",
      event: "flow.run.completed",
      detail: `${flow.slug} :: run ${runId.slice(0, 8)}`,
      context: { runId, flow: flow.slug },
    });
  } finally {
    inFlight.delete(runId);
  }
}

async function markStage(
  runId: string,
  stageId: string,
  patch: Partial<FlowStageRun>,
): Promise<void> {
  const run = await FlowStore.getRun(runId);
  if (!run) return;
  const stageRuns = run.stageRuns.map((sr) =>
    sr.stageId === stageId ? { ...sr, ...patch } : sr,
  );
  await FlowStore.updateRun(runId, { stageRuns });
}

/**
 * Approve the current awaiting_approval stage and continue. Returns the
 * updated FlowRun (post-resume).
 */
export async function approveCurrentStage(runId: string, note?: string): Promise<FlowRun | null> {
  const run = await FlowStore.getRun(runId);
  if (!run || run.status !== "awaiting_approval" || !run.currentStageId) return run;
  await markStage(runId, run.currentStageId, {
    status: "completed",
    completedAt: new Date().toISOString(),
    notes: note ? `Approved: ${note}` : "Approved",
  });
  await FlowStore.updateRun(runId, { status: "running" });
  // Resume async; caller doesn't have to wait
  void executeFlowRun(runId);
  return FlowStore.getRun(runId);
}

/**
 * Reject the current awaiting_approval stage and cancel the run.
 */
export async function rejectCurrentStage(runId: string, reason?: string): Promise<FlowRun | null> {
  const run = await FlowStore.getRun(runId);
  if (!run || run.status !== "awaiting_approval" || !run.currentStageId) return run;
  await markStage(runId, run.currentStageId, {
    status: "failed",
    completedAt: new Date().toISOString(),
    error: reason ? `Rejected: ${reason}` : "Rejected by user",
  });
  await FlowStore.updateRun(runId, {
    status: "cancelled",
    completedAt: new Date().toISOString(),
  });
  return FlowStore.getRun(runId);
}
