/**
 * ZCOS Flow type system.
 *
 * ZED renders and launches flows. ZCOS owns execution state, run lifecycle,
 * approvals, outputs, errors, memory artifacts, and reports.
 *
 * Hierarchy:
 *   FlowDefinition  (template — versioned, editable by admins)
 *     └─ FlowStage  (ordered group of work, may have approval gate)
 *          └─ FlowStep  (single action within a stage)
 *
 *   FlowRun         (one execution instance)
 *     └─ FlowStageRun  (run-state for each stage)
 */

export type FlowStatus = "draft" | "published" | "archived";

export type FlowCategory =
  | "business"
  | "research"
  | "content"
  | "learning"
  | "product"
  | "development"
  | "marketing"
  | "sales"
  | "finance"
  | "operations"
  | "personal_development"
  | "planning"
  | "strategy"
  | "execution"
  | "revenue"
  | "partnership"
  | "project"
  | "social"
  | "pr"
  | "security"
  | "custom";

/** Lane key used by ManagerAgent + providers. */
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
  /** Optional hook string for future typed handlers. Empty = model/manual stage. */
  automationKey?: string;
}

export interface FlowStage {
  id: string;
  order: number;
  name: string;
  description?: string;
  assignedAgent?: FlowAgentKey;
  requiresApproval: boolean;
  approvalRole?: "user" | "admin";
  steps: FlowStep[];
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
  agents: FlowAgentKey[];
  triggerConditions: string[];
  stages: FlowStage[];

  userFacingLabel: string;
  userFacingBlurb: string;
  icon?: string;

  createdAt: string;
  updatedAt: string;
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

export interface FlowApprovalRecord {
  id: string;
  stageId: string;
  status: "pending" | "approved" | "rejected" | "expired";
  role: "user" | "admin";
  requestedAt: string;
  resolvedAt?: string;
  note?: string;
}

export interface FlowErrorRecord {
  id: string;
  stageId?: string;
  message: string;
  timestamp: string;
  retryable: boolean;
  context?: Record<string, unknown>;
}

export interface FlowReport {
  id: string;
  title: string;
  createdAt: string;
  executiveSummary: string;
  keyFindings: string[];
  decisions: string[];
  approvals: FlowApprovalRecord[];
  actionsTaken: string[];
  outputsGenerated: string[];
  recommendedNextSteps: string[];
}

export interface FlowStageRun {
  stageId: string;
  status: FlowStageRunStatus;
  startedAt?: string;
  completedAt?: string;
  output?: string | Record<string, unknown>;
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
  updatedAt: string;
  completedAt?: string;
  currentStageId?: string;

  progressPct: number;
  completedStageIds: string[];
  pendingStageIds: string[];
  estimatedRemainingWork: string;

  approvals: FlowApprovalRecord[];
  outputs: Record<string, unknown>;
  errors: FlowErrorRecord[];
  report?: FlowReport;

  /** Shared blackboard for this run. All stages read/write this instead of direct agent-to-agent messaging. */
  context: Record<string, unknown>;

  stageRuns: FlowStageRun[];
}

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
