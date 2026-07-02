export const DOCUMENT_TYPES = [
  "book",
  "conversation",
  "research",
  "article",
  "email",
  "code",
  "meeting",
  "project",
  "specification",
  "prompt",
  "idea",
  "journal",
  "financial",
  "medical",
  "legal",
  "mixed",
  "unknown",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const KNOWLEDGE_DOMAINS = [
  "business",
  "software",
  "research",
  "finance",
  "health",
  "music",
  "trading",
  "architecture",
  "programming",
  "legal",
  "marketing",
  "brand",
  "education",
  "relationships",
  "creative",
  "operations",
  "general",
] as const;

export type KnowledgeDomain = (typeof KNOWLEDGE_DOMAINS)[number];

export const KNOWLEDGE_STATUSES = [
  "confirmed",
  "likely",
  "unknown",
  "conflicting",
  "deprecated",
  "rejected",
  "historical",
  "experimental",
  "candidate",
] as const;

export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

export const TEMPORAL_STATUSES = [
  "historical",
  "current",
  "future",
  "deprecated",
  "superseded",
  "rejected",
  "archived",
  "experimental",
  "draft",
  "approved",
  "unknown",
] as const;

export type TemporalStatus = (typeof TEMPORAL_STATUSES)[number];

export const KNOWLEDGE_OBJECT_TYPES = [
  "person",
  "project",
  "goal",
  "task",
  "conversation",
  "decision",
  "company",
  "application",
  "research_topic",
  "workflow",
  "document",
  "agent",
  "api",
  "framework",
  "feature",
  "book",
  "relationship",
  "memory",
  "prompt",
  "rule",
  "policy",
  "specification",
  "requirement",
  "issue",
  "bug",
  "improvement",
  "idea",
  "question",
  "hypothesis",
  "concept",
  "event",
  "process",
  "metric",
  "constraint",
  "dependency",
] as const;

export type KnowledgeObjectType = (typeof KNOWLEDGE_OBJECT_TYPES)[number];

export type SemanticUnitType =
  | "concept"
  | "idea"
  | "fact"
  | "claim"
  | "opinion"
  | "question"
  | "assumption"
  | "hypothesis"
  | "goal"
  | "requirement"
  | "problem"
  | "solution"
  | "task"
  | "event"
  | "process"
  | "rule"
  | "definition"
  | "metric"
  | "constraint"
  | "dependency"
  | "relationship";

export interface RawKnowledgeInput {
  sourceName?: string;
  sourceUri?: string;
  contentType?: string;
  content: string | Record<string, unknown> | Array<unknown>;
  author?: string;
  createdAt?: string;
  version?: string;
  metadata?: Record<string, unknown>;
}

export interface SourceAnalysis {
  sourceId: string;
  documentType: DocumentType;
  purpose: string;
  intent: string;
  origin: string;
  author: string | null;
  confidence: number;
  date: string | null;
  version: string | null;
  currency: "current" | "historical" | "unknown";
  finality: "draft" | "final" | "unknown";
  audience: "internal" | "external" | "unknown";
  primaryTopic: string;
  secondaryTopics: string[];
  contentHash: string;
}

export interface SourceEvidence {
  sourceId: string;
  sourceName: string;
  excerpt: string;
  confidence: number;
  importedAt: string;
}

export interface SemanticUnit {
  id: string;
  type: SemanticUnitType;
  text: string;
  confidence: number;
  sourceId: string;
  tags: string[];
}

export interface KnowledgeObject {
  id: string;
  type: KnowledgeObjectType;
  name: string;
  aliases: string[];
  description: string;
  created: string;
  updated: string;
  status: KnowledgeStatus;
  confidence: number;
  source: SourceEvidence;
  relatedObjectIds: string[];
  tags: string[];
  importance: number;
  domains: KnowledgeDomain[];
  temporalStatus: TemporalStatus;
  currentTruth: string | null;
  historicalTruth: string | null;
  evidence: SourceEvidence[];
  contradictions: string[];
  openQuestions: string[];
  lastReviewed: string | null;
  candidate: boolean;
}

export interface KnowledgeRelationship {
  id: string;
  subjectId: string;
  predicate: string;
  objectId: string;
  confidence: number;
  sourceId: string;
  status: KnowledgeStatus;
  evidence: string;
}

export interface TimelineEntry {
  id: string;
  objectId: string | null;
  label: string;
  date: string | null;
  temporalStatus: TemporalStatus;
  confidence: number;
  evidence: string;
}

export interface DecisionRecord {
  id: string;
  decision: string;
  reason: string | null;
  alternatives: string[];
  outcome: string | null;
  date: string | null;
  confidence: number;
  replacedBy: string | null;
  status: KnowledgeStatus;
  sourceId: string;
  affectedObjectIds: string[];
}

export interface KnowledgeConflict {
  id: string;
  objectIds: string[];
  field: string;
  statements: string[];
  status: "unresolved" | "resolved";
  confidence: number;
  sourceIds: string[];
  clarificationQuestion: string;
  createdAt: string;
  resolvedAt: string | null;
  resolution: string | null;
}

export interface OpenQuestion {
  id: string;
  category:
    | "identity"
    | "purpose"
    | "importance"
    | "history"
    | "status"
    | "relationship"
    | "decision"
    | "confidence"
    | "priority";
  question: string;
  targetObjectId: string | null;
  priority: number;
  reason: string;
}

export interface ReasoningIndexes {
  semantic: Record<string, string[]>;
  relational: Record<string, string[]>;
  chronological: TimelineEntry[];
  hierarchical: Record<string, string[]>;
  procedural: Record<string, string[]>;
  conceptual: Record<string, string[]>;
  dependency: Record<string, string[]>;
  graph: Array<{ from: string; relation: string; to: string }>;
}

export interface KnowledgeGraphSnapshot {
  version: number;
  updatedAt: string;
  objects: KnowledgeObject[];
  relationships: KnowledgeRelationship[];
  timeline: TimelineEntry[];
  decisions: DecisionRecord[];
  conflicts: KnowledgeConflict[];
  openQuestions: OpenQuestion[];
}

export interface IngestionReport {
  importId: string;
  importedAt: string;
  executiveSummary: string;
  sourceAnalysis: SourceAnalysis;
  topics: string[];
  semanticUnits: SemanticUnit[];
  extractedObjects: KnowledgeObject[];
  relationshipMap: KnowledgeRelationship[];
  timeline: TimelineEntry[];
  detectedDecisions: DecisionRecord[];
  detectedConflicts: KnowledgeConflict[];
  openQuestions: OpenQuestion[];
  missingInformation: string[];
  suggestedConnections: KnowledgeRelationship[];
  knowledgeGraphChanges: {
    createdObjectIds: string[];
    updatedObjectIds: string[];
    createdRelationshipIds: string[];
    createdConflictIds: string[];
    promotedObjectIds: string[];
  };
  confidenceReport: {
    overall: number;
    source: number;
    extraction: number;
    relationships: number;
    conflicts: number;
  };
  reasoningReadiness: {
    ready: boolean;
    score: number;
    blockers: string[];
    indexes: ReasoningIndexes;
  };
  graph: KnowledgeGraphSnapshot;
}

export interface ContextScore {
  completeness: number;
  confidence: number;
  recency: number;
  relationshipDensity: number;
  conflictCount: number;
  contextDepth: number;
  unknownFields: string[];
}

export interface ContextQuestion {
  id: string;
  category: OpenQuestion["category"];
  question: string;
  targetObjectId: string | null;
  priority: number;
  wouldChange: Array<"classification" | "storage" | "reasoning" | "retrieval" | "conflict_resolution">;
}

export interface ContextAssessment {
  knowsIdentity: boolean;
  knowsPurpose: boolean;
  knowsSignificance: boolean;
  knowsCurrency: boolean;
  knowsAdoptionStatus: boolean;
  knowsRelationships: boolean;
  materialUncertainty: boolean;
  inferredContext?: {
    label: string;
    confidence: number;
    objectIds: string[];
    reason: string;
  } | null;
  contextScore: ContextScore;
  questions: ContextQuestion[];
  responsePolicy: "answer" | "inquire_first";
}

export interface DecisionJournalEntry {
  id: string;
  originalUnderstanding: string;
  userClarification: string;
  reasonForChange: string;
  affectedObjectIds: string[];
  previousClassification: string | null;
  newClassification: string | null;
  timestamp: string;
  confidence: number;
}

export interface ContextEngineResult {
  assessment: ContextAssessment;
  relevantObjects: KnowledgeObject[];
  relevantConflicts: KnowledgeConflict[];
  decisionJournalEntry: DecisionJournalEntry | null;
}
