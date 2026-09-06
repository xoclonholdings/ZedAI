export const ZCOS_INTELLIGENCE_SCHEMA_VERSION = "1.0.0" as const;

export type ZcosGalaxyId =
  | "ZCOS"
  | "ZAR"
  | "ZYNC"
  | "ZENA"
  | "ZENO"
  | "ZYLO"
  | "ZWAP!"
  | "ZENITH"
  | "ZILLION";

export type ZcosEngineId =
  | "identity"
  | "memory"
  | "knowledge"
  | "learning"
  | "reasoning"
  | "orchestration"
  | "policy"
  | "verification";

export type ZcosReasoningDepth = "direct" | "standard" | "deep" | "exhaustive";
export type ZarResponseForm =
  | "direct_answer"
  | "research_result"
  | "concise_rationale"
  | "writing_artifact"
  | "visual_explanation"
  | "file"
  | "approval_request"
  | "implementation_task";
export type ZcosAssignmentStatus =
  | "prepared"
  | "awaiting_approval"
  | "running"
  | "completed"
  | "blocked"
  | "failed"
  | "partial"
  | "cancelled";

export interface ZarContextualQuestion {
  prompt: string;
  choices: string[];
  allowFreeText: true;
}
export type ZcosCertificationState = "certified" | "provisional" | "blocked" | "planned" | "retired";
export type ZcosPermission =
  | "identity:read"
  | "memory:read"
  | "knowledge:read"
  | "learning:read"
  | "projects:read"
  | "external:read"
  | "model:invoke"
  | "workflow:resolve"
  | "action:prepare"
  | "action:execute";

export interface ZcosOwnerEnvelope {
  ownerUserId: string;
  authenticationSource: "authenticated_session" | "verified_channel_binding";
}

export interface ZcosIntentEnvelope {
  kind: string;
  objective: string;
  explicitFreshness: boolean;
  stakes: "ordinary" | "elevated" | "high";
  requestedOutput?: string;
}

export interface ZcosRequestEnvelope {
  schemaVersion: typeof ZCOS_INTELLIGENCE_SCHEMA_VERSION;
  requestId: string;
  traceId: string;
  submittedAt: string;
  originGalaxy: "ZAR";
  route: string;
  owner: ZcosOwnerEnvelope;
  intent: ZcosIntentEnvelope;
  payload: {
    message: string;
    conversationId?: string;
    projectId?: string;
    workspaceId?: string;
    requestedCapabilityIds?: string[];
  };
  permissions: {
    memory: boolean;
    knowledge: boolean;
    projects: boolean;
    externalRetrieval: boolean;
    externalActions: boolean;
  };
}

export type ZcosSourceType =
  | "identity"
  | "conversation_history"
  | "memory"
  | "knowledge"
  | "learning"
  | "project"
  | "file"
  | "external_url"
  | "external_search"
  | "external_model";

export interface ZcosClaimEnvelope {
  key: string;
  value: string;
  scope?: string;
}

export interface ZcosProvenanceEnvelope {
  provider?: string;
  sourceUri?: string;
  sourceRecordId?: string;
  retrievedAt: string;
  publishedAt?: string;
  independenceKey: string;
  transformation?: string;
  lineage: string[];
}

export interface ZcosSourceEnvelope {
  sourceId: string;
  type: ZcosSourceType;
  authority: "canonical" | "source" | "candidate";
  originGalaxy: ZcosGalaxyId;
  originClass: "internal_canonical" | "user_supplied" | "external_primary" | "external_secondary" | "model_synthesis";
  title: string;
  content: string;
  confidence: number;
  currency: "current" | "review_due" | "potentially_outdated" | "historical" | "unknown";
  claims?: ZcosClaimEnvelope[];
  provenance: ZcosProvenanceEnvelope;
}

export interface ZcosUncertaintyEnvelope {
  code: string;
  statement: string;
  material: boolean;
  confidence: number;
  sourceIds: string[];
  resolution: "preserve" | "retrieve_current_sources" | "ask_user" | "block_action";
}

export interface ZcosErrorEnvelope {
  code: string;
  stage: ZcosEngineId | "adapter" | "capability";
  message: string;
  retryable: boolean;
  provider?: string;
  capabilityId?: string;
}

export interface ZcosResultEnvelope<T = unknown> {
  schemaVersion: typeof ZCOS_INTELLIGENCE_SCHEMA_VERSION;
  resultId: string;
  requestId: string;
  type: "context" | "source_set" | "execution" | "verification" | "error";
  status: "success" | "partial" | "blocked" | "failed";
  data: T;
  sourceIds: string[];
  uncertainties: ZcosUncertaintyEnvelope[];
  errors: ZcosErrorEnvelope[];
  provenance: ZcosProvenanceEnvelope;
  writeDisposition: "read_only" | "candidate_only" | "approved_mutation";
}

export interface ZcosArtifactReference {
  kind: "skill" | "workflow";
  id: string;
  version: string;
  ownerGalaxy: "ZYLO";
}

export interface ZcosCapabilityDefinition {
  id: string;
  label: string;
  ownerGalaxy: ZcosGalaxyId;
  operations: string[];
  permissions: ZcosPermission[];
  requiredIntegrations: string[];
  certificationState: ZcosCertificationState;
  sideEffect: "none" | "internal_write" | "external_write";
  approvalRequired: boolean;
  parallelSafe: boolean;
  dependencies: string[];
  artifacts: ZcosArtifactReference[];
  version: string;
}

export interface ZcosCapabilityGap {
  capabilityId: string;
  reason: "not_registered" | "not_certified" | "integration_missing" | "permission_missing" | "artifact_unresolved" | "dependency_unresolved";
  missingIntegrations: string[];
  settingsPath: "/settings/integrations";
  message: string;
}

export interface ZcosCapabilityInvocation {
  invocationId: string;
  capabilityId: string;
  ownerGalaxy: ZcosGalaxyId;
  operation: string;
  dependencyIds: string[];
  approvalRequired: boolean;
  sideEffect: ZcosCapabilityDefinition["sideEffect"];
  artifacts: ZcosArtifactReference[];
  status: "planned" | "blocked" | "approved" | "executing" | "completed" | "failed";
}

export interface ZcosExecutionPlan {
  planId: string;
  requestId: string;
  reasoningDepth: ZcosReasoningDepth;
  externalRetrievalRequired: boolean;
  externalRetrievalReason?: string;
  invocations: ZcosCapabilityInvocation[];
  parallelGroups: string[][];
  sequentialOrder: string[];
  capabilityGaps: ZcosCapabilityGap[];
  approvalIds: string[];
  responseForm: ZarResponseForm;
  assignments: ZcosTaskAssignment[];
}

export interface ZcosTaskAssignment {
  assignmentId: string;
  requestId: string;
  ownerGalaxy: ZcosGalaxyId;
  capabilityId: string;
  objective: string;
  status: ZcosAssignmentStatus;
  approvalRequired: boolean;
  blocker?: string;
}

export interface ZcosConfluenceReport {
  independentSourceCount: number;
  duplicateLineageCount: number;
  conflicts: Array<{
    claimKey: string;
    values: Array<{ value: string; sourceIds: string[] }>;
  }>;
  confidence: number;
}

export interface ZcosVerificationEnvelope {
  status: "verified" | "verified_with_uncertainty" | "blocked" | "failed";
  checkedAt: string;
  policyChecks: string[];
  confluence: ZcosConfluenceReport;
  uncertainties: ZcosUncertaintyEnvelope[];
  errors: ZcosErrorEnvelope[];
}

export interface ZcosExecutionTrace {
  schemaVersion: typeof ZCOS_INTELLIGENCE_SCHEMA_VERSION;
  traceId: string;
  requestId: string;
  ownerUserId: string;
  originGalaxy: "ZAR";
  startedAt: string;
  completedAt?: string;
  stages: Array<{
    engine: ZcosEngineId;
    status: "started" | "completed" | "partial" | "blocked" | "failed";
    at: string;
    detail?: string;
  }>;
  contextSourceIds: string[];
  sourceProvenance: Array<{
    sourceId: string;
    type: ZcosSourceType;
    authority: ZcosSourceEnvelope["authority"];
    originGalaxy: ZcosGalaxyId;
    originClass: ZcosSourceEnvelope["originClass"];
    confidence: number;
    currency: ZcosSourceEnvelope["currency"];
    provenance: ZcosProvenanceEnvelope;
  }>;
  reasoningDepth?: ZcosReasoningDepth;
  capabilityIds: string[];
  approvalIds: string[];
  executionPlan?: ZcosExecutionPlan;
  resultIds: string[];
  results: Array<{
    resultId: string;
    type: ZcosResultEnvelope["type"];
    status: ZcosResultEnvelope["status"];
    sourceIds: string[];
    provenance: ZcosProvenanceEnvelope;
    writeDisposition: ZcosResultEnvelope["writeDisposition"];
  }>;
  verification?: ZcosVerificationEnvelope;
  errors: ZcosErrorEnvelope[];
}
