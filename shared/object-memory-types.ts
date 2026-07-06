/**
 * Object-memory schema.
 *
 * The reparse system turns flat foundation memory (ChatGPT exports,
 * conversation transcripts, markdown summaries) into structured
 * objects that ZED can reason over — instead of stuffing raw text
 * into every prompt.
 *
 * Every object type extends BaseObject so retrieval, storage, and
 * promotion classification work uniformly across types.
 */

export type ObjectMemoryType =
  | "user_profile"
  | "project"
  | "system"
  | "feature"
  | "decision"
  | "preference"
  | "rule"
  | "constraint"
  | "open_question"
  | "task"
  | "integration"
  | "repository"
  | "event"
  | "memory_conflict";

export type ObjectMemoryStatus =
  | "active"
  | "superseded"
  | "archived"
  | "under_review"
  | "conflicting";

export type PromotionTier =
  | "core_memory_candidate"
  | "project_memory_candidate"
  | "working_memory_candidate"
  | "do_not_promote"
  | "requires_review";

/** Provenance record — every extracted object must carry at least one. */
export interface ObjectSourceRef {
  sourceFile: string;
  conversationTitle?: string;
  messageIndex?: number;
  location?: string;
  evidenceQuote: string;
  extractedAt: string;
}

export interface BaseObject {
  id: string;
  type: ObjectMemoryType;
  canonicalName: string;
  aliases: string[];
  summary: string;
  properties: Record<string, unknown>;
  sourceRefs: ObjectSourceRef[];
  confidence: number;
  createdAt: string;
  updatedAt: string;
  status: ObjectMemoryStatus;
  promotionTier: PromotionTier;
}

// ── Typed subclasses ───────────────────────────────────────────────

export interface UserProfileObject extends BaseObject {
  type: "user_profile";
  properties: {
    names?: string[];
    roles?: string[];
    location?: string;
    identityMarkers?: string[];
    preferences?: string[];
    biographicalFacts?: string[];
  };
}

export interface ProjectObject extends BaseObject {
  type: "project";
  properties: {
    domain?: string;
    purpose?: string;
    links?: string[];
    status?: string;
    dependencies?: string[];
    activePriorities?: string[];
    relatedSystems?: string[];
  };
}

export interface SystemObject extends BaseObject {
  type: "system";
  properties: {
    role?: string;
    architecture?: string;
    components?: string[];
    capabilities?: string[];
    limitations?: string[];
    ownerProject?: string;
  };
}

export interface FeatureObject extends BaseObject {
  type: "feature";
  properties: {
    parentProject?: string;
    parentSystem?: string;
    purpose?: string;
    status?: string;
    entryPoints?: string[];
    uiSurfaces?: string[];
    backendRoutes?: string[];
    servicesInvolved?: string[];
    knownGaps?: string[];
  };
}

export interface DecisionObject extends BaseObject {
  type: "decision";
  properties: {
    decision: string;
    date?: string;
    rationale?: string;
    affectedSystems?: string[];
    supersededBy?: string;
  };
}

export interface PreferenceObject extends BaseObject {
  type: "preference";
  properties: {
    preference: string;
    scope?: string;
    strength?: "strong" | "medium" | "weak";
    examples?: string[];
    rejectedAlternatives?: string[];
  };
}

export interface RuleObject extends BaseObject {
  type: "rule";
  properties: {
    rule: string;
    appliesTo?: string[];
    reason?: string;
    severity?: "critical" | "high" | "normal" | "low";
    examples?: string[];
  };
}

export interface ConstraintObject extends BaseObject {
  type: "constraint";
  properties: {
    constraint: string;
    source?: string;
    affectedSystems?: string[];
    permanence?: "permanent" | "long_term" | "temporary";
    workaround?: string;
  };
}

export interface OpenQuestionObject extends BaseObject {
  type: "open_question";
  properties: {
    question: string;
    projectAffected?: string;
    systemAffected?: string;
    whyUnresolved?: string;
    nextAction?: string;
  };
}

export interface TaskObject extends BaseObject {
  type: "task";
  properties: {
    task: string;
    owner?: string;
    project?: string;
    system?: string;
    taskStatus?: string;
    dependencies?: string[];
    priority?: string;
  };
}

export interface IntegrationObject extends BaseObject {
  type: "integration";
  properties: {
    provider: string;
    purpose?: string;
    envVarsNeeded?: string[];
    configuredStatus?: "configured" | "not_configured" | "unknown";
    runtimeStatus?: string;
    relatedRoutes?: string[];
    relatedServices?: string[];
  };
}

export interface RepositoryObject extends BaseObject {
  type: "repository";
  properties: {
    repoName: string;
    owner?: string;
    project?: string;
    purpose?: string;
    knownPaths?: string[];
    relatedSystems?: string[];
  };
}

export interface EventObject extends BaseObject {
  type: "event";
  properties: {
    event: string;
    when?: string;
    result?: string;
    relatedObjects?: string[];
  };
}

export interface MemoryConflictObject extends BaseObject {
  type: "memory_conflict";
  properties: {
    conflictingClaims: string[];
    sources: ObjectSourceRef[];
    likelyResolution?: string;
    requiresUserReview: boolean;
  };
}

// ── Relationships ──────────────────────────────────────────────────

export type RelationshipType =
  | "BELONGS_TO"
  | "DEPENDS_ON"
  | "IMPLEMENTS"
  | "OWNS"
  | "USES"
  | "BLOCKED_BY"
  | "SUPERSEDES"
  | "CONTRADICTS"
  | "PREFERS"
  | "REJECTS"
  | "RELATED_TO"
  | "ROUTES_TO"
  | "STORES_IN"
  | "EXPOSED_BY"
  | "CONFIGURED_BY";

export interface ObjectRelationship {
  id: string;
  fromObjectId: string;
  relationshipType: RelationshipType;
  toObjectId: string;
  evidence?: string;
  confidence: number;
  createdAt: string;
}

// ── Combined types ────────────────────────────────────────────────

export type AnyMemoryObject =
  | UserProfileObject
  | ProjectObject
  | SystemObject
  | FeatureObject
  | DecisionObject
  | PreferenceObject
  | RuleObject
  | ConstraintObject
  | OpenQuestionObject
  | TaskObject
  | IntegrationObject
  | RepositoryObject
  | EventObject
  | MemoryConflictObject;

export interface ObjectGraph {
  version: string;
  generatedAt: string;
  sources: string[];
  objects: AnyMemoryObject[];
  relationships: ObjectRelationship[];
  stats: {
    totalObjects: number;
    byType: Record<ObjectMemoryType, number>;
    totalRelationships: number;
    conflicts: number;
    openQuestions: number;
  };
}
