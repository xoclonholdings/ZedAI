/**
 * Type definitions for the subagent-based orchestration system.
 * Subagents run in parallel, each autonomously determining which lanes to activate.
 */

export type SubagentName = "FinanceSubagent" | "IntelligenceSubagent" | "OperationsSubagent" | "BusinessSubagent";

export type LaneName = "finance" | "intelligence" | "operations" | "business";

export type CapabilityLevel = "analysis" | "action" | "approval" | "retrieval" | "synthesis" | "reasoning";

export interface SubagentContext {
  message: string;
  userId: string;
  conversationId: string;
  traceId: string;
  explicitLane?: LaneName;
  parameters?: Record<string, any>;
  voice?: Record<string, any>;
  approvalPolicy?: Record<string, any>;
}

export interface SubagentLaneDecision {
  laneName: LaneName;
  activated: boolean;
  confidence: number;
  detectionMethod: "keyword" | "llm_classifier" | "explicit_target" | "fallback";
  reason?: string;
}

export interface SubagentExecutionTrace {
  subagentName: SubagentName;
  laneName: LaneName;
  activated: boolean;
  startTime: number;
  endTime: number;
  duration: number;
  laneDecision: SubagentLaneDecision;
  capabilities: CapabilityLevel[];
  actionsRequested: Array<{
    type: string;
    approvalRequired: boolean;
    approvalStatus?: "pending" | "approved" | "rejected" | "auto";
  }>;
  servicesInvoked: string[];
  toolsInvoked: string[];
  status: "success" | "error" | "skipped" | "approval_pending";
  failureReason?: string;
}

export interface SubagentResult {
  subagentName: SubagentName;
  laneName: LaneName;
  activated: boolean;
  responseText?: string;
  reasoning?: string;
  actionItems?: Array<{
    type: string;
    description: string;
    requiresApproval: boolean;
  }>;
  metadata?: {
    sources?: string[];
    confidence?: number;
    priority?: number;
  };
  trace: SubagentExecutionTrace;
  error?: string;
}

export interface AggregatedResult {
  consolidatedResponse: string;
  activeLanes: LaneName[];
  subagentResults: SubagentResult[];
  prioritizedActions: Array<{
    lane: LaneName;
    type: string;
    description: string;
    priority: number;
    requiresApproval: boolean;
  }>;
  synthesisStrategy: "parallel" | "sequential" | "hybrid";
  totalExecutionTime: number;
  approvalsRequired: boolean;
  pendingApprovals: Array<{
    lane: LaneName;
    actionType: string;
    description: string;
  }>;
}

export interface SubagentPoolConfig {
  maxConcurrency: number;
  executionTimeoutMs: number;
  enableParallel: boolean;
  disabledSubagents?: SubagentName[];
}
