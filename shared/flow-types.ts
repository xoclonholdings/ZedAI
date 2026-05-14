/**
 * Flow Builder type system.
 *
 * Flows are operational execution pipelines that route work between
 * existing agents (Operations / Research / Business / Finance / etc.).
 * They are NOT chat conversations — they coordinate agents, tasks,
 * approvals, outputs, and automations into reusable templates.
 *
 * Hierarchy:
 *   FlowDefinition  (the template — versioned, editable by admins)
 *     └─ FlowStage  (ordered group of work, may have approval gate)
 *          └─ FlowStep  (a single action within a stage)
 *
 *   FlowRun         (an instance of a FlowDefinition in execution)
 *     └─ FlowStageRun  (run-state for each stage)
 */

export type FlowStatus = "draft" | "published" | "archived";

export type FlowCategory =
  | "revenue"
  | "content"
  | "partnership"
  | "finance"
  | "project"
  | "social"
  | "pr"
  | "security"
  | "operations"
  | "custom";

/** Lane key used by ManagerAgent + agents. Mirrors ProviderLane in server/. */
export type FlowAgentKey =
  | "operations"
  | "research"
  | "business"
  | "finance"
  | "manager"
  | "content"
  | "security";

export type FlowOutputType =
  | "report"
  | "campaign_plan"
  | "funnel"
  | "task_list"
  | "draft"
  | "decision_log"
  | "kpi_snapshot"
  | "recommendation";

export interface FlowStep {
  id: string;
  order: number;
  label: string;
  detail?: string;
  /** Optional hook string — when execution engine routes this step, it
   *  looks up a handler keyed by automationKey. Empty = manual. */
  automationKey?: string;
}

export interface FlowStage {
  id: string;
  order: number;
  name: string;
  description?: string;
  /** Which agent lane is responsible. Empty = manual stage. */
  assignedAgent?: FlowAgentKey;
  /** Must a human sign off before the run advances past this stage? */
  requiresApproval: boolean;
  /** Whose signature is required — defaults to "user" if requiresApproval. */
  approvalRole?: "user" | "admin";
  steps: FlowStep[];
  /** Output types this stage produces, for downstream stages to consume. */
  outputs?: FlowOutputType[];
}

export interface FlowDefinition {
  id: string;
  slug: string;
  name: string;
  category: FlowCategory;
  description: string;
  purpose: string;

  status: FlowStatus;
  version: number;

  /** Which agent lanes participate. Stage-level assignedAgent values must
   *  be a subset of this list. */
  agents: FlowAgentKey[];

  /** Plain-string trigger conditions (e.g. "manual", "weekly", "on new lead").
   *  Stored as strings for now; execution engine interprets later. */
  triggerConditions: string[];

  stages: FlowStage[];

  /** What the front-facing user picks. Should read like an outcome, not a
   *  process — e.g. "Build Revenue", "Launch Something". */
  userFacingLabel: string;
  userFacingBlurb: string;
  /** Optional lucide-react icon name for the front-facing tile. */
  icon?: string;

  createdAt: string;
  updatedAt: string;
  /** ISO timestamp when first published. */
  publishedAt?: string;
}

export type FlowRunStatus =
  | "queued"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export type FlowStageRunStatus =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "skipped"
  | "failed";

export interface FlowStageRun {
  stageId: string;
  status: FlowStageRunStatus;
  startedAt?: string;
  completedAt?: string;
  /** Whatever the stage produced — text summary or JSON-serialisable object. */
  output?: string | Record<string, unknown>;
  /** Approval-queue entry id, if this stage hit an approval gate. */
  approvalId?: string;
  notes?: string;
  error?: string;
}

export interface FlowRun {
  id: string;
  flowId: string;
  flowSlug: string;
  flowName: string;
  userId: string;
  conversationId?: string;

  status: FlowRunStatus;
  startedAt: string;
  completedAt?: string;
  currentStageId?: string;

  /** Shared blackboard for this run — all stages can read/write. Replaces
   *  fragile direct agent-to-agent messaging. */
  context: Record<string, unknown>;

  stageRuns: FlowStageRun[];
}

/** Default-construct payload for the admin "create new flow" form. */
export const DEFAULT_FLOW_DRAFT: Omit<
  FlowDefinition,
  "id" | "slug" | "createdAt" | "updatedAt"
> = {
  name: "Untitled Flow",
  category: "custom",
  description: "",
  purpose: "",
  status: "draft",
  version: 1,
  agents: ["operations"],
  triggerConditions: ["manual"],
  stages: [],
  userFacingLabel: "New flow",
  userFacingBlurb: "What this flow does for the user.",
};
