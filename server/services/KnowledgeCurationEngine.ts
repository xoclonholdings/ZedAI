import { createHash } from "crypto";
import fs from "fs/promises";
import path from "path";

import type { CoreMemory, ProjectMemory, ScratchpadMemory } from "@shared/schema";

import { MemoryService } from "./memoryService";
import { loadAdminSettings } from "./AdminSettingsStore";
import { logRuntimeEvent } from "./RuntimeLogger";
import { HUB_SHARED_MEMORY_DIR } from "../utils/repoPaths";
import { requireAuthenticatedMemoryUserId } from "./memory/MemoryOwnershipService";

export type KnowledgeObjectKind = "core" | "project" | "scratchpad" | "incoming";
export type KnowledgeHealthBand = "strong" | "acceptable" | "weak" | "needs_review" | "historical";
export type KnowledgeAgingState =
  | "recently_updated"
  | "stable"
  | "needs_review"
  | "potentially_outdated"
  | "historical";
export type IncomingKnowledgeEffect =
  | "confirms"
  | "expands"
  | "contradicts"
  | "supersedes"
  | "merges"
  | "replaces"
  | "creates"
  | "asks_question";

export interface CurationIssue {
  type:
    | "duplicate_candidate"
    | "weak_relationships"
    | "contradiction_candidate"
    | "outdated_candidate"
    | "incomplete_object"
    | "orphaned_knowledge"
    | "missing_context"
    | "missing_evidence"
    | "missing_decision"
    | "low_confidence"
    | "redundant_concept"
    | "unorganized_collection";
  severity: "low" | "medium" | "high";
  message: string;
  recommendation: string;
}

export interface CuratedKnowledgeObject {
  id: string;
  kind: KnowledgeObjectKind;
  canonicalKey: string;
  title: string;
  type?: string | null;
  source: string;
  excerpt: string;
  contentLength: number;
  updatedAt?: string | null;
  completeness: number;
  confidence: number;
  contextDepth: number;
  relationshipDensity: number;
  sourceDiversity: number;
  freshness: number;
  conflictCount: number;
  verificationStatus: "unverified" | "inferred" | "supported" | "user_confirmed";
  userConfirmed: boolean;
  healthScore: number;
  healthBand: KnowledgeHealthBand;
  agingState: KnowledgeAgingState;
  relationshipHints: string[];
  evidenceHints: string[];
  issues: CurationIssue[];
}

export interface DuplicateGroup {
  canonicalKey: string;
  reason: string;
  objectIds: string[];
  titles: string[];
}

export interface ContradictionCandidate {
  canonicalKey: string;
  reason: string;
  objectIds: string[];
  terms: string[];
  needsUserConfirmation: boolean;
}

export interface KnowledgeCollection {
  name: string;
  objectIds: string[];
  count: number;
}

export interface KnowledgeCurationReport {
  generatedAt: string;
  trigger: string;
  userId: string;
  summary: {
    objectCount: number;
    averageHealthScore: number;
    strongCount: number;
    acceptableCount: number;
    weakCount: number;
    needsReviewCount: number;
    historicalCount: number;
    duplicateGroupCount: number;
    contradictionCount: number;
    orphanedCount: number;
    learningGapCount: number;
  };
  objects: CuratedKnowledgeObject[];
  duplicateGroups: DuplicateGroup[];
  contradictions: ContradictionCandidate[];
  orphanedObjects: string[];
  learningGaps: CurationIssue[];
  collections: KnowledgeCollection[];
  recommendedQuestions: string[];
  storage: {
    latestReportPath: string;
    historyPath: string;
  };
}

export interface IncomingKnowledgeEvaluation {
  evaluatedAt: string;
  incoming: {
    title: string;
    type?: string | null;
    excerpt: string;
  };
  effect: IncomingKnowledgeEffect;
  confidence: number;
  bestMatches: Array<{
    objectId: string;
    title: string;
    kind: KnowledgeObjectKind;
    score: number;
    healthScore: number;
  }>;
  needsUserConfirmation: boolean;
  recommendation: string;
  recommendedQuestions: string[];
}

const CURATION_DIR = path.resolve(HUB_SHARED_MEMORY_DIR, "curation");
const LATEST_REPORT_PATH = path.resolve(CURATION_DIR, "latest-review.json");
const HISTORY_PATH = path.resolve(CURATION_DIR, "review-history.jsonl");
const DEFAULT_REVIEW_INTERVAL_MS = 6 * 60 * 60 * 1000;
const STOPWORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "before",
  "being",
  "could",
  "from",
  "have",
  "into",
  "just",
  "more",
  "should",
  "that",
  "their",
  "there",
  "this",
  "with",
  "would",
  "your",
]);

const COLLECTION_RULES: Array<{ name: string; patterns: RegExp[] }> = [
  { name: "Projects", patterns: [/\bproject\b/i, /\broadmap\b/i, /\bfeature\b/i] },
  { name: "Research", patterns: [/\bresearch\b/i, /\bstudy\b/i, /\bpaper\b/i] },
  { name: "People", patterns: [/\bperson\b/i, /\buser\b/i, /\bowner\b/i, /\bclient\b/i] },
  { name: "Companies", patterns: [/\bcompany\b/i, /\bbusiness\b/i, /\bvendor\b/i] },
  { name: "Frameworks", patterns: [/\bframework\b/i, /\bmodel\b/i, /\bmethod\b/i] },
  { name: "Books", patterns: [/\bbook\b/i, /\bauthor\b/i] },
  { name: "Ideas", patterns: [/\bidea\b/i, /\bconcept\b/i, /\binsight\b/i] },
  { name: "Specifications", patterns: [/\bspec\b/i, /\brequirement\b/i, /\bcontract\b/i] },
  { name: "Agents", patterns: [/\bagent\b/i, /\borchestrator\b/i, /\blane\b/i] },
  { name: "Workflows", patterns: [/\bworkflow\b/i, /\bprocess\b/i, /\bprocedure\b/i] },
  { name: "Goals", patterns: [/\bgoal\b/i, /\bobjective\b/i, /\btarget\b/i] },
  { name: "Tasks", patterns: [/\btask\b/i, /\btodo\b/i, /\baction\b/i] },
  { name: "Learning Paths", patterns: [/\blearn\b/i, /\bcurriculum\b/i, /\bskill\b/i] },
];

let schedulerStarted = false;
let schedulerTimer: NodeJS.Timeout | null = null;
let schedulerInterval: NodeJS.Timeout | null = null;

export class KnowledgeCurationEngine {
  static async runReview(params: {
    userId: string;
    trigger?: string;
  }): Promise<KnowledgeCurationReport> {
    const userId = requireAuthenticatedMemoryUserId(params.userId, "knowledge curation review");
    const trigger = params.trigger || "manual";

    await MemoryService.resetScratchpadMemory().catch(() => undefined);

    const [coreMemory, projectMemory, scratchpadMemory] = await Promise.all([
      MemoryService.getAllCoreMemory().catch(() => []),
      MemoryService.getProjectMemory(userId).catch(() => []),
      MemoryService.getScratchpadMemory(userId).catch(() => []),
    ]);

    const objects = [
      ...coreMemory.map((entry) => this.fromCoreMemory(entry)),
      ...projectMemory.map((entry) => this.fromProjectMemory(entry)),
      ...scratchpadMemory.map((entry) => this.fromScratchpadMemory(entry)),
    ];

    const duplicateGroups = this.findDuplicateGroups(objects);
    const contradictions = this.findContradictions(objects);

    this.applyGraphIssues(objects, duplicateGroups, contradictions);
    for (const object of objects) {
      this.recalculateHealth(object);
    }

    const recommendedQuestions = this.buildRecommendedQuestions(objects, contradictions).slice(0, 20);
    for (const object of objects) {
      this.recalculateHealth(object);
    }

    const orphanedObjects = objects
      .filter((object) => object.issues.some((issue) => issue.type === "orphaned_knowledge"))
      .map((object) => object.id);
    const learningGaps = objects.flatMap((object) =>
      object.issues.filter((issue) =>
        ["incomplete_object", "missing_context", "missing_evidence", "missing_decision"].includes(
          issue.type,
        ),
      ),
    );
    const collections = this.buildCollections(objects);
    const averageHealthScore = objects.length
      ? round(objects.reduce((sum, object) => sum + object.healthScore, 0) / objects.length)
      : 0;

    const report: KnowledgeCurationReport = {
      generatedAt: new Date().toISOString(),
      trigger,
      userId,
      summary: {
        objectCount: objects.length,
        averageHealthScore,
        strongCount: objects.filter((object) => object.healthBand === "strong").length,
        acceptableCount: objects.filter((object) => object.healthBand === "acceptable").length,
        weakCount: objects.filter((object) => object.healthBand === "weak").length,
        needsReviewCount: objects.filter((object) => object.healthBand === "needs_review").length,
        historicalCount: objects.filter((object) => object.healthBand === "historical").length,
        duplicateGroupCount: duplicateGroups.length,
        contradictionCount: contradictions.length,
        orphanedCount: orphanedObjects.length,
        learningGapCount: learningGaps.length,
      },
      objects,
      duplicateGroups,
      contradictions,
      orphanedObjects,
      learningGaps,
      collections,
      recommendedQuestions,
      storage: {
        latestReportPath: LATEST_REPORT_PATH,
        historyPath: HISTORY_PATH,
      },
    };

    await this.persistReport(report);
    await logRuntimeEvent({
      level: report.summary.needsReviewCount > 0 ? "warn" : "info",
      source: "server",
      event: "knowledge.curation.review",
      detail: `Knowledge curation review completed with ${report.summary.objectCount} objects`,
      context: report.summary,
    });

    return report;
  }

  static async getLatestReview(): Promise<KnowledgeCurationReport | null> {
    try {
      const raw = await fs.readFile(LATEST_REPORT_PATH, "utf8");
      return JSON.parse(raw) as KnowledgeCurationReport;
    } catch {
      return null;
    }
  }

  static async evaluateIncoming(params: {
    userId: string;
    title?: string;
    content: string;
    type?: string | null;
  }): Promise<IncomingKnowledgeEvaluation> {
    const userId = requireAuthenticatedMemoryUserId(params.userId, "incoming knowledge evaluation");
    const title = (params.title || params.type || "Incoming knowledge").trim();
    const content = String(params.content || "").trim();
    if (!content) {
      return {
        evaluatedAt: new Date().toISOString(),
        incoming: { title, type: params.type || null, excerpt: "" },
        effect: "asks_question",
        confidence: 1,
        bestMatches: [],
        needsUserConfirmation: false,
        recommendation: "Incoming knowledge has no content. Ask for the missing detail before curation.",
        recommendedQuestions: ["What information should ZED evaluate and preserve?"],
      };
    }

    const report = await this.runReview({ userId, trigger: "incoming-evaluation" });
    const incomingTokens = tokenize(`${title} ${content}`);
    const bestMatches = report.objects
      .map((object) => ({
        object,
        score: jaccard(incomingTokens, tokenize(`${object.title} ${object.excerpt}`)),
      }))
      .filter((match) => match.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const bestScore = bestMatches[0]?.score || 0;
    const lower = `${title}\n${content}`.toLowerCase();
    const hasReplacementSignal = /\b(replaces|replacement|supersedes|deprecated|obsolete|no longer|instead of)\b/.test(
      lower,
    );
    const hasContradictionSignal = /\b(not|never|false|incorrect|contradicts|opposite|disabled)\b/.test(
      lower,
    );
    const hasMergeSignal = /\b(same as|duplicate|merge|alias|also known as)\b/.test(lower);

    let effect: IncomingKnowledgeEffect = "creates";
    if (bestScore >= 0.82 && !hasContradictionSignal) effect = "confirms";
    else if (hasReplacementSignal && bestScore >= 0.25) effect = "supersedes";
    else if (hasContradictionSignal && bestScore >= 0.25) effect = "contradicts";
    else if (hasMergeSignal && bestScore >= 0.25) effect = "merges";
    else if (bestScore >= 0.38) effect = "expands";
    else if (bestScore >= 0.25) effect = "expands";

    const needsUserConfirmation = ["contradicts", "supersedes", "replaces", "merges"].includes(
      effect,
    );

    return {
      evaluatedAt: new Date().toISOString(),
      incoming: {
        title,
        type: params.type || null,
        excerpt: excerpt(content, 260),
      },
      effect,
      confidence: round(Math.max(bestScore, effect === "creates" ? 0.65 : 0.45)),
      bestMatches: bestMatches.map(({ object, score }) => ({
        objectId: object.id,
        title: object.title,
        kind: object.kind,
        score: round(score),
        healthScore: object.healthScore,
      })),
      needsUserConfirmation,
      recommendation: recommendationForEffect(effect, needsUserConfirmation),
      recommendedQuestions: needsUserConfirmation
        ? ["Should ZED update the canonical record based on this new information?"]
        : [],
    };
  }

  private static fromCoreMemory(entry: CoreMemory): CuratedKnowledgeObject {
    return this.createObject({
      id: `core:${entry.key}`,
      kind: "core",
      title: entry.key,
      type: "core",
      description: entry.description || "",
      content: entry.value || "",
      updatedAt: entry.updatedAt ? new Date(entry.updatedAt).toISOString() : null,
      createdAt: entry.createdAt ? new Date(entry.createdAt).toISOString() : null,
      source: "core_memory",
      userConfirmed: entry.adminOnly !== false,
    });
  }

  private static fromProjectMemory(entry: ProjectMemory): CuratedKnowledgeObject {
    return this.createObject({
      id: `project:${entry.id}`,
      kind: "project",
      title: entry.name || "Untitled project memory",
      type: entry.type || "context",
      description: entry.description || "",
      content: entry.content || "",
      updatedAt: entry.updatedAt ? new Date(entry.updatedAt).toISOString() : null,
      createdAt: entry.createdAt ? new Date(entry.createdAt).toISOString() : null,
      source: "project_memory",
      userConfirmed: false,
    });
  }

  private static fromScratchpadMemory(entry: ScratchpadMemory): CuratedKnowledgeObject {
    return this.createObject({
      id: `scratchpad:${entry.id}`,
      kind: "scratchpad",
      title: entry.tags?.length ? entry.tags.join(", ") : "Scratchpad memory",
      type: "scratchpad",
      description: entry.tags?.join(", ") || "",
      content: entry.content || "",
      updatedAt: entry.createdAt ? new Date(entry.createdAt).toISOString() : null,
      createdAt: entry.createdAt ? new Date(entry.createdAt).toISOString() : null,
      source: "scratchpad_memory",
      userConfirmed: false,
    });
  }

  private static createObject(input: {
    id: string;
    kind: KnowledgeObjectKind;
    title: string;
    type?: string | null;
    description?: string;
    content: string;
    updatedAt?: string | null;
    createdAt?: string | null;
    source: string;
    userConfirmed: boolean;
  }): CuratedKnowledgeObject {
    const text = `${input.title}\n${input.description || ""}\n${input.content}`;
    const relationshipHints = inferCollections(text);
    const evidenceHints = inferEvidenceHints(text);
    const contentLength = input.content.trim().length;
    const hasDescription = Boolean((input.description || "").trim());
    const completeness = round(
      scoreParts([
        [Boolean(input.title.trim()), 0.2],
        [contentLength > 40, 0.35],
        [hasDescription || contentLength > 160, 0.2],
        [Boolean(input.type), 0.1],
        [evidenceHints.length > 0, 0.15],
      ]),
    );
    const contextDepth = round(Math.min(1, contentLength / 1200 + (hasDescription ? 0.2 : 0)));
    const relationshipDensity = round(Math.min(1, relationshipHints.length / 4));
    const sourceDiversity = round(Math.min(1, 0.25 + evidenceHints.length * 0.2));
    const freshness = freshnessScore(input.updatedAt || input.createdAt || null);
    const issues: CurationIssue[] = [];

    if (contentLength < 40) {
      issues.push({
        type: "incomplete_object",
        severity: "medium",
        message: "Knowledge object has very little content.",
        recommendation: "Add enough detail for ZED to understand and reuse this knowledge.",
      });
    }
    if (!hasDescription && input.kind === "project") {
      issues.push({
        type: "missing_context",
        severity: "medium",
        message: "Project memory has no description.",
        recommendation: "Add context explaining why this knowledge exists and where it applies.",
      });
    }
    if (relationshipHints.length === 0) {
      issues.push({
        type: "weak_relationships",
        severity: "low",
        message: "No strong collection or domain relationships were detected.",
        recommendation: "Connect this object to a project, workflow, agent, goal, or source domain.",
      });
      issues.push({
        type: "orphaned_knowledge",
        severity: "medium",
        message: "Object may be orphaned from the broader knowledge graph.",
        recommendation: "Attach this knowledge to a canonical concept or living collection.",
      });
    }
    if (evidenceHints.length === 0 && input.kind !== "scratchpad") {
      issues.push({
        type: "missing_evidence",
        severity: "medium",
        message: "No explicit source, evidence, or confirmation marker was detected.",
        recommendation: "Add source evidence, a decision record, or user confirmation.",
      });
    }
    if (freshness < 0.4 && input.kind !== "scratchpad") {
      issues.push({
        type: "outdated_candidate",
        severity: "medium",
        message: "Knowledge has not been updated recently.",
        recommendation: "Review whether this object is still current.",
      });
    }

    const object: CuratedKnowledgeObject = {
      id: input.id,
      kind: input.kind,
      canonicalKey: canonicalKey(input.title || input.content),
      title: input.title || "Untitled knowledge object",
      type: input.type || null,
      source: input.source,
      excerpt: excerpt(input.content || input.description || "", 320),
      contentLength,
      updatedAt: input.updatedAt || input.createdAt || null,
      completeness,
      confidence: 0,
      contextDepth,
      relationshipDensity,
      sourceDiversity,
      freshness,
      conflictCount: 0,
      verificationStatus: input.userConfirmed ? "user_confirmed" : evidenceHints.length > 0 ? "supported" : "inferred",
      userConfirmed: input.userConfirmed,
      healthScore: 0,
      healthBand: "weak",
      agingState: agingState(input.updatedAt || input.createdAt || null),
      relationshipHints,
      evidenceHints,
      issues,
    };
    this.recalculateHealth(object);
    return object;
  }

  private static recalculateHealth(object: CuratedKnowledgeObject): void {
    object.conflictCount = object.issues.filter(
      (issue) => issue.type === "contradiction_candidate",
    ).length;
    const issuePenalty = Math.min(0.3, object.issues.length * 0.04);
    const conflictPenalty = Math.min(0.25, object.conflictCount * 0.12);
    const confirmationBoost = object.userConfirmed ? 0.08 : 0;
    object.confidence = round(
      clamp(
        0.28 +
          object.completeness * 0.18 +
          object.sourceDiversity * 0.16 +
          object.freshness * 0.12 +
          confirmationBoost -
          conflictPenalty,
      ),
    );
    object.healthScore = round(
      clamp(
        object.completeness * 0.2 +
          object.confidence * 0.2 +
          object.contextDepth * 0.15 +
          object.relationshipDensity * 0.12 +
          object.sourceDiversity * 0.12 +
          object.freshness * 0.11 +
          (object.userConfirmed ? 0.08 : 0) -
          issuePenalty -
          conflictPenalty,
      ),
    );

    if (object.agingState === "historical") object.healthBand = "historical";
    else if (object.healthScore >= 0.78) object.healthBand = "strong";
    else if (object.healthScore >= 0.56) object.healthBand = "acceptable";
    else if (object.healthScore >= 0.38) object.healthBand = "weak";
    else object.healthBand = "needs_review";

    if (object.healthScore < 0.4 && !object.issues.some((issue) => issue.type === "low_confidence")) {
      object.issues.push({
        type: "low_confidence",
        severity: "medium",
        message: "Object health score is low.",
        recommendation: "Improve completeness, evidence, relationships, or freshness.",
      });
    }
  }

  private static findDuplicateGroups(objects: CuratedKnowledgeObject[]): DuplicateGroup[] {
    const byCanonical = new Map<string, CuratedKnowledgeObject[]>();
    for (const object of objects) {
      const key = object.canonicalKey || contentFingerprint(object.excerpt);
      const group = byCanonical.get(key) || [];
      group.push(object);
      byCanonical.set(key, group);
    }

    return Array.from(byCanonical.entries())
      .filter(([, group]) => group.length > 1)
      .map(([key, group]) => ({
        canonicalKey: key,
        reason: "Multiple objects share the same canonical key or title fingerprint.",
        objectIds: group.map((object) => object.id),
        titles: group.map((object) => object.title),
      }));
  }

  private static findContradictions(objects: CuratedKnowledgeObject[]): ContradictionCandidate[] {
    const groups = new Map<string, CuratedKnowledgeObject[]>();
    for (const object of objects) {
      const group = groups.get(object.canonicalKey) || [];
      group.push(object);
      groups.set(object.canonicalKey, group);
    }

    const pairs: Array<[RegExp, RegExp, string[]]> = [
      [/\bactive\b|\benabled\b|\bcurrent\b/i, /\bplanned\b|\bdisabled\b|\binactive\b/i, ["active", "planned/disabled"]],
      [/\btrue\b|\byes\b|\bconfirmed\b/i, /\bfalse\b|\bno\b|\brejected\b/i, ["true/confirmed", "false/rejected"]],
      [/\bcanonical\b|\bapproved\b/i, /\bdraft\b|\bproposal\b|\barchived\b/i, ["canonical/approved", "draft/archived"]],
      [/\breplaces\b|\bsupersedes\b/i, /\boriginal\b|\bold\b|\blegacy\b/i, ["replacement", "legacy"]],
    ];

    const contradictions: ContradictionCandidate[] = [];
    for (const [key, group] of groups.entries()) {
      if (group.length < 2) continue;
      const combined = group.map((object) => `${object.title}\n${object.excerpt}`).join("\n");
      for (const [left, right, terms] of pairs) {
        if (left.test(combined) && right.test(combined)) {
          contradictions.push({
            canonicalKey: key,
            reason: "Objects with the same canonical key contain opposing status or decision terms.",
            objectIds: group.map((object) => object.id),
            terms,
            needsUserConfirmation: true,
          });
          break;
        }
      }
    }
    return contradictions;
  }

  private static applyGraphIssues(
    objects: CuratedKnowledgeObject[],
    duplicateGroups: DuplicateGroup[],
    contradictions: ContradictionCandidate[],
  ): void {
    const byId = new Map(objects.map((object) => [object.id, object]));

    for (const group of duplicateGroups) {
      for (const objectId of group.objectIds) {
        byId.get(objectId)?.issues.push({
          type: "duplicate_candidate",
          severity: "high",
          message: "Object may duplicate another object with the same canonical concept.",
          recommendation: "Merge into one canonical object and preserve the others as aliases or history.",
        });
      }
    }

    for (const contradiction of contradictions) {
      for (const objectId of contradiction.objectIds) {
        byId.get(objectId)?.issues.push({
          type: "contradiction_candidate",
          severity: "high",
          message: contradiction.reason,
          recommendation: "Ask the user before resolving this canonical conflict.",
        });
      }
    }
  }

  private static buildCollections(objects: CuratedKnowledgeObject[]): KnowledgeCollection[] {
    const collections = new Map<string, Set<string>>();
    for (const rule of COLLECTION_RULES) {
      collections.set(rule.name, new Set());
    }

    for (const object of objects) {
      for (const name of object.relationshipHints) {
        collections.get(name)?.add(object.id);
      }
    }

    return Array.from(collections.entries())
      .map(([name, ids]) => ({ name, objectIds: Array.from(ids), count: ids.size }))
      .filter((collection) => collection.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }

  private static buildRecommendedQuestions(
    objects: CuratedKnowledgeObject[],
    contradictions: ContradictionCandidate[],
  ): string[] {
    const questions = new Set<string>();

    for (const contradiction of contradictions) {
      questions.add(
        `Which version should be canonical for ${contradiction.canonicalKey}: ${contradiction.terms.join(" or ")}?`,
      );
    }

    for (const object of objects) {
      if (object.issues.some((issue) => issue.type === "missing_context")) {
        questions.add(`What context should ZED attach to "${object.title}"?`);
      }
      if (object.issues.some((issue) => issue.type === "missing_evidence")) {
        questions.add(`What evidence or source supports "${object.title}"?`);
      }
      if (object.issues.some((issue) => issue.type === "orphaned_knowledge")) {
        questions.add(`Which project, workflow, agent, or goal should "${object.title}" connect to?`);
      }
      if (/decision|decide|approved|rejected/i.test(object.excerpt) && !/because|rationale|reason/i.test(object.excerpt)) {
        object.issues.push({
          type: "missing_decision",
          severity: "medium",
          message: "Decision-like knowledge has no rationale marker.",
          recommendation: "Record why this decision was made.",
        });
        questions.add(`What rationale should ZED record for the decision in "${object.title}"?`);
      }
    }

    return Array.from(questions);
  }

  private static async persistReport(report: KnowledgeCurationReport): Promise<void> {
    await fs.mkdir(CURATION_DIR, { recursive: true });
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    await fs.writeFile(LATEST_REPORT_PATH, serialized, "utf8");
    await fs.appendFile(HISTORY_PATH, `${JSON.stringify(report)}\n`, "utf8");
  }
}

export function startKnowledgeCurationScheduler(): void {
  if (schedulerStarted || process.env.ZED_KNOWLEDGE_CURATION_DISABLED === "true") return;
  schedulerStarted = true;

  const intervalMs = Number(process.env.ZED_KNOWLEDGE_CURATION_INTERVAL_MS || DEFAULT_REVIEW_INTERVAL_MS);
  const runScheduledReview = async () => {
    try {
      const settings = await loadAdminSettings().catch(() => null);
      const userId = requireAuthenticatedMemoryUserId(
        settings?.users?.find((user) => user.isAdmin)?.id,
        "knowledge curation scheduler",
      );
      await KnowledgeCurationEngine.runReview({ userId, trigger: "scheduler" });
    } catch (error) {
      await logRuntimeEvent({
        level: "error",
        source: "server",
        event: "knowledge.curation.scheduler_failed",
        detail: error instanceof Error ? error.message : "Knowledge curation scheduler failed",
      });
    }
  };

  schedulerTimer = setTimeout(() => {
    void runScheduledReview();
  }, 30_000);
  schedulerInterval = setInterval(() => {
    void runScheduledReview();
  }, Math.max(intervalMs, 60_000));
}

export function stopKnowledgeCurationScheduler(): void {
  if (schedulerTimer) clearTimeout(schedulerTimer);
  if (schedulerInterval) clearInterval(schedulerInterval);
  schedulerTimer = null;
  schedulerInterval = null;
  schedulerStarted = false;
}

function inferCollections(text: string): string[] {
  return COLLECTION_RULES.filter((rule) => rule.patterns.some((pattern) => pattern.test(text))).map(
    (rule) => rule.name,
  );
}

function inferEvidenceHints(text: string): string[] {
  const hints: string[] = [];
  if (/\bsource\b|\bevidence\b|\bcitation\b|https?:\/\//i.test(text)) hints.push("source");
  if (/\bconfirmed\b|\bapproved\b|\buser said\b|\buser confirmation\b/i.test(text)) hints.push("confirmation");
  if (/\bdecision\b|\brationale\b|\bbecause\b|\breason\b/i.test(text)) hints.push("rationale");
  if (/\bversion\b|\bupdated\b|\bsupersedes\b|\breplaces\b/i.test(text)) hints.push("version_history");
  return Array.from(new Set(hints));
}

function canonicalKey(input: string): string {
  const tokens = tokenize(input).slice(0, 8).join("-");
  return tokens || contentFingerprint(input).slice(0, 12);
}

function contentFingerprint(input: string): string {
  return createHash("sha1").update(normalizeText(input)).digest("hex");
}

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenize(input: string): string[] {
  return normalizeText(input)
    .split(" ")
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

function jaccard(left: string[], right: string[]): number {
  const a = new Set(left);
  const b = new Set(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  return intersection / (a.size + b.size - intersection);
}

function freshnessScore(value: string | null): number {
  if (!value) return 0.25;
  const ageMs = Date.now() - Number(new Date(value));
  const dayMs = 24 * 60 * 60 * 1000;
  if (!Number.isFinite(ageMs) || ageMs < 0) return 0.5;
  const ageDays = ageMs / dayMs;
  if (ageDays <= 7) return 1;
  if (ageDays <= 30) return 0.82;
  if (ageDays <= 90) return 0.62;
  if (ageDays <= 180) return 0.42;
  if (ageDays <= 365) return 0.28;
  return 0.16;
}

function agingState(value: string | null): KnowledgeAgingState {
  if (!value) return "needs_review";
  const ageMs = Date.now() - Number(new Date(value));
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  if (!Number.isFinite(ageDays)) return "needs_review";
  if (ageDays <= 7) return "recently_updated";
  if (ageDays <= 90) return "stable";
  if (ageDays <= 180) return "needs_review";
  if (ageDays <= 365) return "potentially_outdated";
  return "historical";
}

function excerpt(input: string, maxLength: number): string {
  const compact = input.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1)}…`;
}

function scoreParts(parts: Array<[boolean, number]>): number {
  return parts.reduce((sum, [condition, weight]) => sum + (condition ? weight : 0), 0);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function recommendationForEffect(effect: IncomingKnowledgeEffect, needsUserConfirmation: boolean): string {
  if (needsUserConfirmation) {
    return "Stage this as a curation candidate and ask the user before changing canonical knowledge.";
  }
  if (effect === "confirms") return "Attach this as supporting evidence to the matching canonical object.";
  if (effect === "expands") return "Use this to refine and expand the matching canonical object.";
  if (effect === "creates") return "Create a new canonical object unless the user identifies an existing concept.";
  return "Ask a clarification question before curation.";
}
