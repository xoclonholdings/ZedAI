import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

import { executeProviderChat } from "../../core/providers/provider-executor";
import { AgentApprovalAdapter } from "../approval/AgentApprovalAdapter";
import { ApprovalDecisionHandler } from "../approval/ApprovalDecisionHandler";
import { FlowStore } from "../FlowStore";
import { logRuntimeEvent } from "../RuntimeLogger";
import { HUB_DIR, HUB_SHARED_MEMORY_DIR } from "../../utils/repoPaths";
import type {
  FlowAgentKey,
  FlowApprovalRecord,
  FlowDefinition,
  FlowReport,
  FlowRun,
  FlowStage,
  FlowStageRun,
} from "../../../shared/flow-types";

const FLOW_MEMORY_PATH = path.resolve(HUB_SHARED_MEMORY_DIR, "working/flow-runs.md");
const FLOW_REPORTS_DIR = path.resolve(HUB_DIR, "flows", "reports");

function laneForAgent(agent: FlowAgentKey | undefined): string {
  if (!agent) return "manager";
  switch (agent) {
    case "operations":
    case "research":
    case "business":
    case "finance":
    case "manager":
      return agent;
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
    "You are the Operations Agent inside the ZCOS flow engine. Produce concrete checklists, schedules, assignments, and next actions.",
  research:
    "You are the Research / Intelligence Agent inside the ZCOS flow engine. Produce clear findings, evidence, uncertainty, and verification steps.",
  business:
    "You are the Business Manager Agent inside the ZCOS flow engine. Focus on leverage, revenue, positioning, execution risk, and the highest-impact next move.",
  finance:
    "You are the Finance Agent inside the ZCOS flow engine. Separate analysis from execution. Include risk, invalidation, sizing, and approval requirements for capital movement.",
  content:
    "You are the Content Agent inside the ZCOS flow engine. Produce usable drafts, outlines, campaign assets, and review notes.",
  security:
    "You are the Security Agent inside the ZCOS flow engine. Classify severity, contain risk, identify root cause, and recommend hardening steps.",
  manager:
    "You are the Manager Agent inside the ZCOS flow engine. Coordinate stages and produce a concise synthesis for downstream execution.",
};

function buildStagePrompt(opts: {
  flow: FlowDefinition;
  stage: FlowStage;
  priorOutputs: Record<string, unknown>;
  initialContext: Record<string, unknown>;
}): string {
  const { flow, stage, priorOutputs, initialContext } = opts;
  const stepLines = stage.steps
    .sort((a, b) => a.order - b.order)
    .map((s, i) => `${i + 1}. ${s.label}${s.detail ? ` - ${s.detail}` : ""}`)
    .join("\n");

  const priorBlock = Object.entries(priorOutputs)
    .map(([stageName, output]) => {
      const text = typeof output === "string" ? output : JSON.stringify(output, null, 2);
      return `### From earlier stage "${stageName}"\n${text}`;
    })
    .join("\n\n");

  const initBlock = Object.keys(initialContext).length
    ? `### Initial context from the user\n${JSON.stringify(initialContext, null, 2)}`
    : "";

  return [
    `## Flow: ${flow.name}`,
    `## Stage: ${stage.name}`,
    flow.category ? `Category: ${flow.category}` : "",
    flow.purpose ? `Flow purpose: ${flow.purpose}` : "",
    stage.description ? `Stage goal: ${stage.description}` : "",
    "",
    `Steps to complete:\n${stepLines || "No explicit steps provided. Produce the required stage output."}`,
    "",
    initBlock,
    priorBlock,
    "",
    "Produce output for this stage only. Include decisions, outputs, risks, and concrete next steps. If the work requires external action, state the approval requirement instead of claiming execution.",
  ]
    .filter(Boolean)
    .join("\n");
}

function hasUsableUserContext(context: Record<string, unknown>): boolean {
  return Object.values(context || {}).some((value) => {
    if (typeof value === "string") return value.trim().length >= 12;
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === "object") return Object.keys(value).length > 0;
    return value !== undefined && value !== null;
  });
}

function textFromContext(context: Record<string, unknown>): string {
  const direct = context.userBrief || context.prompt || context.goal || context.task || context.subject;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const serialized = JSON.stringify(context || {}, null, 2);
  return serialized === "{}" ? "" : serialized;
}

function isPlaceholderOutput(output: string): boolean {
  const normalized = output.toLowerCase();
  return (
    /\bplaceholder\b/.test(normalized) ||
    /\boutput \(template\)/.test(normalized) ||
    /\blist of 3-5\b/.test(normalized) ||
    /\blorem ipsum\b/.test(normalized) ||
    /\btbd\b/.test(normalized)
  );
}

function buildLocalStageOutput(opts: {
  flow: FlowDefinition;
  stage: FlowStage;
  priorOutputs: Record<string, unknown>;
  initialContext: Record<string, unknown>;
  providerError?: string;
}): string {
  const { flow, stage, priorOutputs, initialContext, providerError } = opts;
  const brief = textFromContext(initialContext);
  const hasContext = hasUsableUserContext(initialContext);
  const priorText = Object.entries(priorOutputs)
    .map(([name, output]) => `${name}: ${typeof output === "string" ? output : JSON.stringify(output)}`)
    .join("\n")
    .slice(0, 1600);
  const stepList = stage.steps
    .sort((a, b) => a.order - b.order)
    .map((step) => `- ${step.label}${step.detail ? `: ${step.detail}` : ""}`)
    .join("\n");
  const missingContext = hasContext
    ? "None blocking. This result used the provided run brief and earlier stage outputs."
    : "A user brief is needed for tailored analysis. Add the subject, goal, constraints, available data, and desired outcome before rerunning for a personalized result.";

  const evidence = [
    `Flow purpose: ${flow.purpose || flow.description}`,
    `Stage goal: ${stage.description || stage.name}`,
    brief ? `User brief: ${brief}` : "",
    priorText ? `Prior stage context available: yes` : "Prior stage context available: no",
  ].filter(Boolean);

  return [
    `## ${stage.name}`,
    "",
    "### Decision",
    hasContext
      ? `Proceed with ${stage.name.toLowerCase()} using the supplied run context.`
      : `Do not invent details. Produce a context-readiness result and identify the exact information needed to complete ${stage.name.toLowerCase()}.`,
    "",
    "### Evidence Used",
    ...evidence.map((item) => `- ${item}`),
    providerError ? `- Provider unavailable: ${providerError}` : "",
    "",
    "### Work Completed",
    stepList || "- No explicit steps were defined, so the stage was completed from the flow purpose and stage goal.",
    "",
    "### Findings",
    hasContext
      ? [
          `- The stage can operate on the provided brief: ${brief.slice(0, 220)}${brief.length > 220 ? "..." : ""}`,
          priorText
            ? "- Earlier stage output was carried forward through the shared flow context."
            : "- No earlier stage output exists yet, so this stage is the baseline for downstream work.",
          "- The output is intentionally constrained to evidence available in this run.",
        ].join("\n")
      : [
          "- The run was launched without enough user-specific context to create tailored conclusions.",
          "- Required context: target subject or objective, current state, constraints, success criteria, and any source material.",
          "- The flow remains clickable and executable, but recommendations are limited until those inputs exist.",
        ].join("\n"),
    "",
    "### Risks And Tradeoffs",
    hasContext
      ? "- Local execution avoids blocking the workflow when the model provider is unavailable, but it cannot infer hidden facts or browse external sources."
      : "- Continuing without a brief would create generic output, so this stage stops at readiness analysis instead of pretending to know the missing facts.",
    "",
    "### Next Actions",
    hasContext
      ? [
          "- Review the findings before accepting downstream recommendations.",
          "- Add more source material to the run context if the next stage needs deeper precision.",
          "- Rerun after provider access is restored for model-expanded analysis if needed.",
        ].join("\n")
      : [
          "- Return to the tool launch screen and enter a concise brief.",
          "- Include the specific problem, goal, known facts, constraints, and desired output format.",
          "- Rerun the flow so downstream stages can produce tailored work.",
        ].join("\n"),
    "",
    "### Missing Information",
    `- ${missingContext}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const inFlight = new Set<string>();

export async function executeFlowRun(runId: string): Promise<void> {
  if (inFlight.has(runId)) return;
  inFlight.add(runId);
  try {
    let run = await FlowStore.getRun(runId);
    if (!run) return;
    const flow = await FlowStore.getDefinition(run.flowId);
    if (!flow) {
      await failRun(runId, "Flow definition not found", { flowId: run.flowId });
      return;
    }

    if (run.status === "completed" || run.status === "failed" || run.status === "cancelled") {
      return;
    }

    if (run.status === "queued") {
      run = (await FlowStore.updateRun(runId, { status: "running" })) || run;
      await writeRunMemory("started", run, flow);
    }

    const orderedStages = [...flow.stages].sort((a, b) => a.order - b.order);

    for (const stage of orderedStages) {
      run = (await FlowStore.getRun(runId)) || run;
      const stageRun = run.stageRuns.find((sr) => sr.stageId === stage.id);
      if (!stageRun) continue;
      if (stageRun.status === "completed" || stageRun.status === "skipped") continue;

      if (stageRun.status === "awaiting_approval") {
        await FlowStore.updateRun(runId, {
          status: "awaiting_approval",
          currentStageId: stage.id,
        });
        return;
      }

      const existingApproval = stageRun.approvalId
        ? run.approvals.find((approval) => approval.id === stageRun.approvalId)
        : undefined;

      if (stage.requiresApproval && stageRun.status === "pending" && existingApproval?.status !== "approved") {
        const approvalId = stageRun.approvalId || (await createStageApproval(run, flow, stage));
        const approvalRecord: FlowApprovalRecord = {
          id: approvalId,
          stageId: stage.id,
          status: "pending",
          role: stage.approvalRole || "user",
          requestedAt: new Date().toISOString(),
        };
        await markStage(runId, stage.id, {
          status: "awaiting_approval",
          startedAt: stageRun.startedAt || new Date().toISOString(),
          approvalId,
          notes: `Approval required for ${stage.name}`,
        });
        run = (await FlowStore.getRun(runId)) || run;
        const existingApproval = run.approvals.find((approval) => approval.id === approvalId);
        await FlowStore.updateRun(runId, {
          status: "awaiting_approval",
          currentStageId: stage.id,
          approvals: existingApproval ? run.approvals : run.approvals.concat(approvalRecord),
        });
        await writeRunMemory("awaiting approval", (await FlowStore.getRun(runId)) || run, flow, stage);
        return;
      }

      await runStage(runId, flow, stage, orderedStages);
    }

    run = (await FlowStore.getRun(runId)) || run;
    const report = await buildReport(run, flow);
    const completed = await FlowStore.updateRun(runId, {
      status: "completed",
      completedAt: new Date().toISOString(),
      currentStageId: undefined,
      report,
    });
    if (completed) await writeRunMemory("completed", completed, flow);
    await persistReport(runId, report);

    await logRuntimeEvent({
      level: "info",
      source: "server",
      event: "flow.run.completed",
      detail: `${flow.slug} :: run ${runId.slice(0, 8)}`,
      context: { runId, flow: flow.slug, reportId: report.id },
    });
  } finally {
    inFlight.delete(runId);
  }
}

async function runStage(
  runId: string,
  flow: FlowDefinition,
  stage: FlowStage,
  orderedStages: FlowStage[],
): Promise<void> {
  await markStage(runId, stage.id, {
    status: "running",
    startedAt: new Date().toISOString(),
    error: undefined,
  });
  let run = (await FlowStore.updateRun(runId, {
    status: "running",
    currentStageId: stage.id,
  }))!;
  await writeRunMemory("stage running", run, flow, stage);

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
    const systemPrompt = SYSTEM_PROMPTS[stage.assignedAgent as FlowAgentKey] || SYSTEM_PROMPTS.manager;
    const lane = laneForAgent(stage.assignedAgent);
    let reply: string;
    try {
      reply = await executeProviderChat(
        [{ role: "user", content: prompt }],
        { systemPrompt, lane: lane as any },
      );
      if (isPlaceholderOutput(reply)) {
        throw new Error("Provider returned placeholder/template output");
      }
    } catch (err: any) {
      const providerError = err?.message || String(err);
      reply = buildLocalStageOutput({
        flow,
        stage,
        priorOutputs,
        initialContext: run.context || {},
        providerError,
      });
      await logRuntimeEvent({
        level: "warn",
        source: "server",
        event: "flow.stage.local_executor",
        detail: `${flow.slug} :: ${stage.name} used local structured executor`,
        context: { runId, stageId: stage.id, agent: stage.assignedAgent, providerError },
      });
    }

    await markStage(runId, stage.id, {
      status: "completed",
      completedAt: new Date().toISOString(),
      output: reply,
      error: undefined,
    });

    run = (await FlowStore.getRun(runId)) || run;
    const nextOutputs = {
      ...run.outputs,
      [stage.id]: reply,
      [stage.name]: reply,
    };
    const nextContext = {
      ...(run.context || {}),
      lastStageId: stage.id,
      lastStageName: stage.name,
      lastStageOutput: reply,
    };
    run = (await FlowStore.updateRun(runId, {
      outputs: nextOutputs,
      context: nextContext,
    })) || run;

    await writeRunMemory("stage completed", run, flow, stage);
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
    await failRun(runId, detail, {
      stageId: stage.id,
      stageName: stage.name,
      agent: stage.assignedAgent,
      errorKind: err?.constructor?.name,
    });
  }
}

async function createStageApproval(
  run: FlowRun,
  flow: FlowDefinition,
  stage: FlowStage,
): Promise<string> {
  const result = await AgentApprovalAdapter.register({
    user_id: run.userId,
    conversation_id: run.conversationId || null,
    agent: "ZcosFlowEngine",
    message: `Approval required for flow "${flow.name}" stage "${stage.name}"`,
    draft: [
      `Flow: ${flow.name}`,
      `Stage: ${stage.name}`,
      stage.description ? `Stage goal: ${stage.description}` : "Stage goal: approval gate",
      `Run ID: ${run.id}`,
      `Approval role: ${stage.approvalRole || "user"}`,
      "Approve to continue this run. Reject to cancel it.",
    ].join("\n"),
    capabilities: ["flow-approval", flow.category, stage.assignedAgent || "manager"],
  });
  return result.task_id;
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

async function failRun(
  runId: string,
  message: string,
  context?: Record<string, unknown>): Promise<void> {
  await FlowStore.appendError(runId, {
    stageId: typeof context?.stageId === "string" ? context.stageId : undefined,
    message,
    retryable: true,
    context,
  });
  await FlowStore.updateRun(runId, { status: "failed" });
  const run = await FlowStore.getRun(runId);
  const flow = run ? await FlowStore.getDefinition(run.flowId) : null;
  if (run && flow) await writeRunMemory("failed", run, flow);
  await logRuntimeEvent({
    level: "error",
    source: "server",
    event: "flow.run.failed",
    detail: message,
    context: { runId, ...context },
  });
}

export async function approveCurrentStage(
  runId: string,
  note?: string,
  decidedBy = "user",
  deciderRole: "user" | "admin" | "system" = "user",
): Promise<FlowRun | null> {
  const run = await FlowStore.getRun(runId);
  if (!run || run.status !== "awaiting_approval" || !run.currentStageId) return run;

  const stageRun = run.stageRuns.find((sr) => sr.stageId === run.currentStageId);
  if (stageRun?.approvalId) {
    await ApprovalDecisionHandler.decide({
      task_id: stageRun.approvalId,
      decided_by: decidedBy,
      decider_role: deciderRole,
      action: "approve",
      reason: note,
    }).catch(() => null);
  }

  const approvals = run.approvals.map((approval) =>
    approval.id === stageRun?.approvalId
      ? {
          ...approval,
          status: "approved" as const,
          resolvedAt: new Date().toISOString(),
          note,
        }
      : approval,
  );

  await markStage(runId, run.currentStageId, {
    status: "pending",
    completedAt: undefined,
    notes: note ? `Approved: ${note}` : "Approved",
    output: undefined,
    error: undefined,
  });
  await FlowStore.updateRun(runId, { status: "running", approvals });
  void executeFlowRun(runId);
  return FlowStore.getRun(runId);
}

export async function rejectCurrentStage(
  runId: string,
  reason?: string,
  decidedBy = "user",
  deciderRole: "user" | "admin" | "system" = "user",
): Promise<FlowRun | null> {
  const run = await FlowStore.getRun(runId);
  if (!run || run.status !== "awaiting_approval" || !run.currentStageId) return run;

  const stageRun = run.stageRuns.find((sr) => sr.stageId === run.currentStageId);
  if (stageRun?.approvalId) {
    await ApprovalDecisionHandler.decide({
      task_id: stageRun.approvalId,
      decided_by: decidedBy,
      decider_role: deciderRole,
      action: "reject",
      reason: reason || "Rejected by user",
    }).catch(() => null);
  }

  const approvals = run.approvals.map((approval) =>
    approval.id === stageRun?.approvalId
      ? {
          ...approval,
          status: "rejected" as const,
          resolvedAt: new Date().toISOString(),
          note: reason,
        }
      : approval,
  );

  await markStage(runId, run.currentStageId, {
    status: "failed",
    completedAt: new Date().toISOString(),
    error: reason ? `Rejected: ${reason}` : "Rejected by user",
  });
  await FlowStore.updateRun(runId, {
    status: "cancelled",
    completedAt: new Date().toISOString(),
    approvals,
  });
  const updated = await FlowStore.getRun(runId);
  const flow = updated ? await FlowStore.getDefinition(updated.flowId) : null;
  if (updated && flow) await writeRunMemory("cancelled", updated, flow);
  return updated;
}

export async function retryFlowRun(runId: string): Promise<FlowRun | null> {
  const run = await FlowStore.getRun(runId);
  if (!run || run.status !== "failed") return run;
  const stageRuns = run.stageRuns.map((stageRun) =>
    stageRun.status === "failed"
      ? { ...stageRun, status: "pending" as const, error: undefined, completedAt: undefined }
      : stageRun,
  );
  const updated = await FlowStore.updateRun(runId, {
    status: "running",
    stageRuns,
    errors: [],
    report: undefined,
    completedAt: undefined,
  });
  void executeFlowRun(runId);
  return updated;
}

export async function cancelFlowRun(runId: string, reason?: string): Promise<FlowRun | null> {
  const run = await FlowStore.getRun(runId);
  if (!run || run.status === "completed") return run;
  const updated = await FlowStore.updateRun(runId, {
    status: "cancelled",
    completedAt: new Date().toISOString(),
  });
  const flow = updated ? await FlowStore.getDefinition(updated.flowId) : null;
  if (updated && flow) await writeRunMemory(reason ? `cancelled: ${reason}` : "cancelled", updated, flow);
  return updated;
}

async function buildReport(run: FlowRun, flow: FlowDefinition): Promise<FlowReport> {
  const completedStages = flow.stages
    .sort((a, b) => a.order - b.order)
    .filter((stage) => run.stageRuns.some((stageRun) => stageRun.stageId === stage.id && stageRun.status === "completed"));
  const outputs = completedStages
    .map((stage) => {
      const stageRun = run.stageRuns.find((sr) => sr.stageId === stage.id);
      const text = typeof stageRun?.output === "string" ? stageRun.output : JSON.stringify(stageRun?.output || "", null, 2);
      return { stage, text };
    });

  const outputTexts = outputs.map(({ stage, text }) => {
    const cleaned = text.trim();
    return `### ${stage.name}\n${cleaned || "Stage completed without text output."}`;
  });

  return {
    id: `report-${randomUUID()}`,
    title: `${flow.name} Run Report`,
    createdAt: new Date().toISOString(),
    executiveSummary: outputTexts.length
      ? outputTexts.join("\n\n")
      : `${flow.name} completed with ${completedStages.length} completed stages.`,
    keyFindings: outputs.map(({ stage, text }) => {
      const cleaned = text.replace(/[#*_`|<>]/g, "").replace(/\s+/g, " ").trim();
      return `${stage.name}: ${cleaned.slice(0, 240)}`;
    }),
    decisions: run.approvals.map((approval) => `${approval.stageId}: ${approval.status}`),
    approvals: run.approvals,
    actionsTaken: completedStages.map((stage) => `Completed stage: ${stage.name}`),
    outputsGenerated: Object.keys(run.outputs || {}),
    recommendedNextSteps: [
      "Review the generated outputs.",
      "Convert accepted recommendations into tasks or approvals where needed.",
      "Rerun or schedule the flow if this should become recurring work.",
    ],
  };
}

async function persistReport(runId: string, report: FlowReport): Promise<void> {
  await fs.mkdir(FLOW_REPORTS_DIR, { recursive: true });
  await fs.writeFile(path.resolve(FLOW_REPORTS_DIR, `${runId}.json`), JSON.stringify(report, null, 2), "utf8");
}

async function writeRunMemory(
  event: string,
  run: FlowRun,
  flow: FlowDefinition,
  stage?: FlowStage,
): Promise<void> {
  try {
    await fs.mkdir(path.dirname(FLOW_MEMORY_PATH), { recursive: true });
    const line = [
      `\n## [${new Date().toISOString()}] ZCOS Flow ${event}`,
      `Flow: ${flow.name} (${flow.slug})`,
      `Run: ${run.id}`,
      `Status: ${run.status}`,
      `Progress: ${run.progressPct}%`,
      stage ? `Stage: ${stage.name}` : "",
      run.errors.length ? `Errors: ${run.errors.map((err) => err.message).join(" | ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    await fs.appendFile(FLOW_MEMORY_PATH, `${line}\n`, "utf8");
  } catch (err) {
    console.warn("[ZcosFlowEngine] Failed to write flow memory:", err);
  }
}
