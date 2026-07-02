import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";

import { HUB_SHARED_MEMORY_DIR } from "../../utils/repoPaths";
import type {
  DecisionRecord,
  DocumentType,
  IngestionReport,
  KnowledgeConflict,
  KnowledgeDomain,
  KnowledgeGraphSnapshot,
  KnowledgeObject,
  KnowledgeObjectType,
  KnowledgeRelationship,
  KnowledgeStatus,
  OpenQuestion,
  RawKnowledgeInput,
  ReasoningIndexes,
  SemanticUnit,
  SemanticUnitType,
  SourceAnalysis,
  SourceEvidence,
  TemporalStatus,
  TimelineEntry,
} from "./types";

interface StoredKnowledgeGraph extends KnowledgeGraphSnapshot {
  imports: Array<{
    importId: string;
    importedAt: string;
    sourceId: string;
    sourceName: string;
    sourceUri?: string;
    sourceTag?: string;
    metadata?: Record<string, unknown>;
    createdObjectIds: string[];
    updatedObjectIds: string[];
    createdConflictIds: string[];
  }>;
}

const GRAPH_DIR = path.join(HUB_SHARED_MEMORY_DIR, "knowledge-graph");
const GRAPH_FILE = path.join(GRAPH_DIR, "knowledge-graph.json");

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "add",
  "additional",
  "ask",
  "based",
  "best",
  "because",
  "before",
  "being",
  "between",
  "build",
  "can",
  "confused",
  "could",
  "create",
  "don",
  "download",
  "every",
  "goal",
  "from",
  "have",
  "how",
  "into",
  "learn",
  "make",
  "more",
  "must",
  "never",
  "next",
  "not",
  "nothing",
  "nwe",
  "off",
  "only",
  "open",
  "other",
  "remember",
  "right",
  "send",
  "show",
  "should",
  "start",
  "summary",
  "strong",
  "substantially",
  "suggested",
  "that",
  "their",
  "there",
  "these",
  "this",
  "through",
  "with",
  "would",
  "when",
  "where",
  "which",
  "who",
  "while",
  "your",
]);

const WEAK_OBJECT_NAMES = new Set([
  "a",
  "an",
  "add",
  "additional",
  "apps",
  "ask",
  "and",
  "are",
  "be",
  "based",
  "best",
  "build",
  "but",
  "can",
  "clean summary",
  "core strategy",
  "confused",
  "create",
  "don",
  "download",
  "final structure",
  "for",
  "get",
  "go",
  "goal",
  "here",
  "how",
  "instead",
  "introduction",
  "it",
  "just",
  "keep",
  "learn",
  "let",
  "lets",
  "make",
  "more",
  "most",
  "next",
  "not",
  "now",
  "nothing",
  "nwe",
  "off",
  "one",
  "open",
  "pick",
  "remember",
  "right",
  "send",
  "set",
  "show",
  "start",
  "summary",
  "strong",
  "substantially",
  "suggested",
  "target group a",
  "then",
  "there",
  "they",
  "this",
  "tool",
  "use",
  "use spend",
  "user",
  "value",
  "verdict",
  "visible",
  "what",
  "who",
  "why",
  "wire",
  "would",
  "you",
  "your",
]);

const DOMAIN_HINTS: Array<{ domain: KnowledgeDomain; hints: string[] }> = [
  { domain: "software", hints: ["api", "application", "backend", "frontend", "database", "service", "schema"] },
  { domain: "programming", hints: ["typescript", "javascript", "python", "function", "class", "framework"] },
  { domain: "research", hints: ["research", "paper", "hypothesis", "experiment", "study", "evidence"] },
  { domain: "business", hints: ["business", "company", "customer", "market", "revenue", "sales"] },
  { domain: "finance", hints: ["finance", "financial", "budget", "cash", "profit", "loss"] },
  { domain: "trading", hints: ["trading", "trade", "crypto", "forex", "stock", "market"] },
  { domain: "legal", hints: ["legal", "contract", "policy", "compliance", "liability"] },
  { domain: "health", hints: ["health", "medical", "clinical", "symptom", "diagnosis"] },
  { domain: "marketing", hints: ["marketing", "campaign", "audience", "positioning"] },
  { domain: "brand", hints: ["brand", "logo", "identity", "voice", "style"] },
  { domain: "education", hints: ["course", "lesson", "learning", "education", "training"] },
  { domain: "architecture", hints: ["architecture", "pipeline", "system", "modular", "integration"] },
  { domain: "operations", hints: ["workflow", "process", "operations", "task", "approval"] },
  { domain: "creative", hints: ["music", "creative", "writing", "story", "design"] },
  { domain: "relationships", hints: ["relationship", "person", "team", "family", "partner"] },
];

function nowIso(): string {
  return new Date().toISOString();
}

function stableHash(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 16);
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${stableHash(value)}`;
}

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeKey(value: string): string {
  return normalizeSpace(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function toText(content: RawKnowledgeInput["content"]): string {
  return typeof content === "string" ? content : JSON.stringify(content, null, 2);
}

function sentences(text: string): string[] {
  return text
    .replace(/\r/g, "\n")
    .split(/(?<=[.!?])\s+|\n{2,}|\n(?=\s*[-*0-9])/g)
    .map(normalizeSpace)
    .filter((sentence) => sentence.length >= 8)
    .slice(0, 400);
}

function terms(text: string, limit = 12): string[] {
  const counts = new Map<string, number>();
  for (const match of text.toLowerCase().matchAll(/[a-z][a-z0-9-]{2,}/g)) {
    const token = match[0];
    if (!STOP_WORDS.has(token)) counts.set(token, (counts.get(token) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term]) => term);
}

function names(text: string): string[] {
  const result = new Set<string>();
  for (const match of text.matchAll(/\b[A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*){0,4}\b/g)) {
    const phrase = normalizeSpace(match[0]);
    if (phrase.length >= 3 && !/^(The|This|That|Every|After|Before|When|Where)$/.test(phrase)) result.add(phrase);
  }
  for (const match of text.matchAll(/\b[A-Z0-9]{2,}\b/g)) result.add(match[0]);
  return Array.from(result).slice(0, 80);
}

function detectDocumentType(input: RawKnowledgeInput, text: string): DocumentType {
  const combined = `${input.sourceName || ""} ${input.sourceUri || ""} ${input.contentType || ""} ${text.slice(0, 2000)}`.toLowerCase();
  const checks: Array<[DocumentType, RegExp]> = [
    ["email", /\b(subject:|from:|to:|email)\b/],
    ["conversation", /\b(user:|assistant:|chatgpt|claude|gemini|conversation|transcript)\b/],
    ["research", /\b(abstract|methodology|references|study|research paper|hypothesis)\b/],
    ["book", /\b(chapter|preface|isbn|book)\b/],
    ["meeting", /\b(meeting|agenda|minutes|attendees|action items)\b/],
    ["code", /\b(import |export |function |class |const |interface |def )\b/],
    ["financial", /\b(revenue|profit|loss|budget|cash flow|balance sheet)\b/],
    ["medical", /\b(patient|clinical|diagnosis|treatment|symptom)\b/],
    ["legal", /\b(contract|agreement|liability|terms|compliance)\b/],
    ["specification", /\b(requirement|specification|architecture|pipeline|success criteria)\b/],
    ["project", /\b(project|milestone|roadmap|feature|release)\b/],
    ["prompt", /\b(prompt|system message|instruction)\b/],
    ["journal", /\b(journal|diary|reflection)\b/],
    ["article", /\b(article|published|newsletter|blog)\b/],
  ];
  return checks.find(([, pattern]) => pattern.test(combined))?.[0] || "mixed";
}

function domains(text: string): KnowledgeDomain[] {
  const lower = text.toLowerCase();
  const detected = DOMAIN_HINTS.filter(({ hints }) => hints.some((hint) => lower.includes(hint))).map(({ domain }) => domain);
  return detected.length ? Array.from(new Set(detected)).slice(0, 4) : ["general"];
}

function temporal(text: string): TemporalStatus {
  const lower = text.toLowerCase();
  if (/\b(deprecated|obsolete|retired)\b/.test(lower)) return "deprecated";
  if (/\b(superseded|replaced by|renamed to)\b/.test(lower)) return "superseded";
  if (/\b(rejected|declined|not adopted)\b/.test(lower)) return "rejected";
  if (/\b(archived|archive)\b/.test(lower)) return "archived";
  if (/\b(experimental|prototype|trial)\b/.test(lower)) return "experimental";
  if (/\b(draft|proposal|proposed)\b/.test(lower)) return "draft";
  if (/\b(approved|adopted|canonical|current)\b/.test(lower)) return "approved";
  if (/\b(will|future|planned|roadmap)\b/.test(lower)) return "future";
  if (/\b(was|previously|historical|legacy|old)\b/.test(lower)) return "historical";
  return "unknown";
}

function statusFromTemporal(value: TemporalStatus): KnowledgeStatus {
  return ["deprecated", "rejected", "historical", "experimental"].includes(value) ? (value as KnowledgeStatus) : "candidate";
}

function unitType(text: string): SemanticUnitType {
  const lower = text.toLowerCase();
  if (text.endsWith("?")) return "question";
  if (/\b(must|shall|required|requirement|needs to)\b/.test(lower)) return "requirement";
  if (/\b(decision|decided|chosen|approved|adopted)\b/.test(lower)) return "fact";
  if (/\b(goal|objective|success criteria|purpose)\b/.test(lower)) return "goal";
  if (/\b(problem|issue|bug|failure|risk)\b/.test(lower)) return "problem";
  if (/\b(solution|fix|resolve|approach)\b/.test(lower)) return "solution";
  if (/\b(task|todo|action item|next step)\b/.test(lower)) return "task";
  if (/\b(assume|assumption)\b/.test(lower)) return "assumption";
  if (/\b(hypothesis|may|might|could)\b/.test(lower)) return "hypothesis";
  if (/\b(policy|rule|never|always)\b/.test(lower)) return "rule";
  if (/\b(defines|definition|means|is a)\b/.test(lower)) return "definition";
  if (/\b(metric|score|count|rate|confidence)\b/.test(lower)) return "metric";
  if (/\b(depends on|dependency|requires)\b/.test(lower)) return "dependency";
  if (/\b(constrains|constraint|limit|cannot)\b/.test(lower)) return "constraint";
  if (/\b(process|workflow|pipeline|phase)\b/.test(lower)) return "process";
  if (/\b(believe|think|opinion)\b/.test(lower)) return "opinion";
  if (/\b(claim|asserts|states)\b/.test(lower)) return "claim";
  return "concept";
}

function objectType(text: string): KnowledgeObjectType {
  const lower = text.toLowerCase();
  const checks: Array<[KnowledgeObjectType, RegExp]> = [
    ["project", /\b(project|initiative|app|platform)\b/],
    ["feature", /\b(feature|capability|module)\b/],
    ["workflow", /\b(workflow|pipeline|process)\b/],
    ["decision", /\b(decision|decided|adopted|approved)\b/],
    ["task", /\b(task|todo|action item)\b/],
    ["goal", /\b(goal|objective|outcome)\b/],
    ["requirement", /\b(requirement|must|shall)\b/],
    ["issue", /\b(issue|problem|risk)\b/],
    ["bug", /\b(bug|defect|regression)\b/],
    ["api", /\b(api|endpoint|route)\b/],
    ["agent", /\b(agent|assistant)\b/],
    ["policy", /\b(policy|rule)\b/],
    ["specification", /\b(specification|spec)\b/],
    ["question", /\?$/],
    ["hypothesis", /\b(hypothesis)\b/],
    ["constraint", /\b(constraint|cannot|limit)\b/],
    ["dependency", /\b(depends on|dependency|requires)\b/],
    ["metric", /\b(metric|score|confidence|count)\b/],
  ];
  return checks.find(([, pattern]) => pattern.test(lower))?.[0] || "concept";
}

function confidence(text: string, base = 0.58): number {
  let score = base;
  if (/\b(must|is|are|confirmed|approved|canonical|decided)\b/i.test(text)) score += 0.14;
  if (/\b(maybe|might|could|unknown|unclear|draft|proposal)\b/i.test(text)) score -= 0.12;
  if (text.length > 120) score += 0.04;
  return Math.max(0.15, Math.min(0.96, Number(score.toFixed(2))));
}

function subject(text: string, fallback: string): string {
  const named = names(text).find((name) => !isWeakObjectName(name));
  if (named) return named;
  const top = terms(text, 8).filter((term) => !isWeakObjectName(term)).slice(0, 3);
  return top.length ? top.map((term) => term[0].toUpperCase() + term.slice(1)).join(" ") : fallback;
}

function isWeakObjectName(name: string): boolean {
  const key = normalizeKey(name);
  if (!key || key.length < 3) return true;
  if (WEAK_OBJECT_NAMES.has(key)) return true;
  const words = key.split(" ").filter(Boolean);
  if (words.length > 0 && words.every((word) => WEAK_OBJECT_NAMES.has(word) || STOP_WORDS.has(word))) return true;
  if (/^(option|step|phase|item|thing|stuff|part|section|example|note|question)\s*[a-z0-9]*$/i.test(key)) return true;
  return false;
}

function evidence(source: SourceAnalysis, excerpt: string): SourceEvidence {
  return {
    sourceId: source.sourceId,
    sourceName: source.primaryTopic || source.sourceId,
    excerpt: normalizeSpace(excerpt).slice(0, 480),
    confidence: source.confidence,
    importedAt: nowIso(),
  };
}

function analyzeSource(input: RawKnowledgeInput, text: string): SourceAnalysis {
  const contentHash = stableHash(text);
  const sourceId = stableId("src", `${input.sourceName || "source"}:${input.sourceUri || ""}:${contentHash}`);
  const sourceTerms = terms(text, 10);
  const lower = text.toLowerCase();
  const sourceTemporal = temporal(text);
  return {
    sourceId,
    documentType: detectDocumentType(input, text),
    purpose: /\b(objective|purpose|goal)\b/.test(lower) ? "Defines objectives and operating intent." : "Provides imported information for candidate knowledge extraction.",
    intent: /\b(requirement|must|shall|build|design)\b/.test(lower) ? "Prescriptive" : /\b(question|why|how)\b/.test(lower) ? "Exploratory" : "Informational",
    origin: input.sourceUri || input.sourceName || "direct_import",
    author: input.author || null,
    confidence: confidence(text, input.sourceName || input.sourceUri ? 0.68 : 0.55),
    date: input.createdAt || null,
    version: input.version || (typeof input.metadata?.version === "string" ? input.metadata.version : null),
    currency: sourceTemporal === "historical" || sourceTemporal === "deprecated" ? "historical" : sourceTemporal === "unknown" ? "unknown" : "current",
    finality: /\b(draft|proposal|experimental)\b/.test(lower) ? "draft" : /\b(final|approved|canonical)\b/.test(lower) ? "final" : "unknown",
    audience: /\b(internal|private|admin)\b/.test(lower) ? "internal" : /\b(public|published|external)\b/.test(lower) ? "external" : "unknown",
    primaryTopic: input.sourceName || sourceTerms.slice(0, 4).join(" ") || "Imported Knowledge",
    secondaryTopics: sourceTerms.slice(0, 8),
    contentHash,
  };
}

function decompose(text: string, source: SourceAnalysis): SemanticUnit[] {
  return sentences(text).map((sentence, index) => {
    const type = unitType(sentence);
    return {
      id: stableId("unit", `${source.sourceId}:${index}:${sentence}`),
      type,
      text: sentence,
      confidence: confidence(sentence),
      sourceId: source.sourceId,
      tags: Array.from(new Set([type, ...domains(sentence)])).slice(0, 6),
    };
  });
}

function objectFromUnit(unit: SemanticUnit, source: SourceAnalysis): KnowledgeObject {
  const objectName = subject(unit.text, source.primaryTopic);
  const temporalStatus = temporal(unit.text);
  const objectDomains = domains(unit.text);
  const sourceEvidence = evidence(source, unit.text);
  return {
    id: stableId("obj", `${normalizeKey(objectName)}:${objectType(unit.text)}`),
    type: objectType(unit.text),
    name: objectName,
    aliases: names(unit.text)
      .filter((alias) => normalizeKey(alias) !== normalizeKey(objectName) && !isWeakObjectName(alias))
      .slice(0, 6),
    description: unit.text,
    created: nowIso(),
    updated: nowIso(),
    status: statusFromTemporal(temporalStatus),
    confidence: unit.confidence,
    source: sourceEvidence,
    relatedObjectIds: [],
    tags: Array.from(new Set([unit.type, ...objectDomains, ...terms(unit.text, 4)])).slice(0, 10),
    importance: Math.min(1, Number((0.35 + unit.confidence / 2 + (["requirement", "goal"].includes(unit.type) ? 0.15 : 0)).toFixed(2))),
    domains: objectDomains,
    temporalStatus,
    currentTruth: temporalStatus === "current" || temporalStatus === "approved" ? unit.text : null,
    historicalTruth: ["historical", "deprecated", "superseded", "rejected"].includes(temporalStatus) ? unit.text : null,
    evidence: [sourceEvidence],
    contradictions: [],
    openQuestions: [],
    lastReviewed: null,
    candidate: true,
  };
}

function detectObjects(units: SemanticUnit[], source: SourceAnalysis): KnowledgeObject[] {
  const importantTypes = new Set<SemanticUnitType>([
    "concept",
    "idea",
    "fact",
    "claim",
    "question",
    "hypothesis",
    "goal",
    "requirement",
    "problem",
    "solution",
    "task",
    "process",
    "rule",
    "definition",
    "metric",
    "constraint",
    "dependency",
  ]);
  const objects = new Map<string, KnowledgeObject>();
  for (const unit of units.filter((item) => importantTypes.has(item.type))) {
    const object = objectFromUnit(unit, source);
    if (isWeakObjectName(object.name)) continue;
    const key = normalizeKey(`${object.type}:${object.name}`);
    const existing = objects.get(key);
    if (existing) {
      existing.description = `${existing.description}\n${unit.text}`.slice(0, 1600);
      existing.confidence = Number(((existing.confidence + unit.confidence) / 2).toFixed(2));
      existing.evidence.push(evidence(source, unit.text));
      existing.tags = Array.from(new Set([...existing.tags, ...object.tags])).slice(0, 12);
      existing.aliases = Array.from(new Set([...existing.aliases, ...object.aliases])).slice(0, 10);
    } else {
      objects.set(key, object);
    }
  }
  return Array.from(objects.values()).slice(0, 120);
}

function findObject(objects: KnowledgeObject[], name: string): KnowledgeObject | undefined {
  const key = normalizeKey(name);
  return objects.find((object) => normalizeKey(object.name) === key || object.aliases.some((alias) => normalizeKey(alias) === key));
}

function detectRelationships(objects: KnowledgeObject[], units: SemanticUnit[], sourceId: string): KnowledgeRelationship[] {
  const relationships: KnowledgeRelationship[] = [];
  const patterns: Array<{ predicate: string; pattern: RegExp }> = [
    { predicate: "depends_on", pattern: /(.+?)\b(depends on|requires|needs)\b(.+)/i },
    { predicate: "replaces", pattern: /(.+?)\b(replaces|supersedes|renamed from)\b(.+)/i },
    { predicate: "belongs_to", pattern: /(.+?)\b(belongs to|part of|within)\b(.+)/i },
    { predicate: "supports", pattern: /(.+?)\b(supports|proves|evidences)\b(.+)/i },
    { predicate: "conflicts_with", pattern: /(.+?)\b(conflicts with|contradicts|disagrees with)\b(.+)/i },
    { predicate: "owns", pattern: /(.+?)\b(owns|controls|manages)\b(.+)/i },
    { predicate: "executes", pattern: /(.+?)\b(executes|runs|performs)\b(.+)/i },
  ];
  for (const unit of units) {
    for (const { predicate, pattern } of patterns) {
      const match = unit.text.match(pattern);
      if (!match) continue;
      const from = findObject(objects, subject(match[1], "subject"));
      const to = findObject(objects, subject(match[3], "object"));
      if (!from || !to || from.id === to.id) continue;
      relationships.push({
        id: stableId("rel", `${from.id}:${predicate}:${to.id}:${unit.id}`),
        subjectId: from.id,
        predicate,
        objectId: to.id,
        confidence: Math.min(0.92, unit.confidence + 0.08),
        sourceId,
        status: "candidate",
        evidence: unit.text,
      });
    }
  }
  return Array.from(new Map(relationships.map((rel) => [rel.id, rel])).values()).slice(0, 180);
}

function detectTimeline(objects: KnowledgeObject[], units: SemanticUnit[]): TimelineEntry[] {
  const datePattern = /\b(20\d{2}|19\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i;
  return units
    .map((unit) => {
      const temporalStatus = temporal(unit.text);
      if (temporalStatus === "unknown" && !datePattern.test(unit.text)) return null;
      const related = objects.find((object) => unit.text.includes(object.name));
      const date = unit.text.match(datePattern)?.[0] || null;
      return {
        id: stableId("time", `${unit.id}:${temporalStatus}:${date || "none"}`),
        objectId: related?.id || null,
        label: unit.text.slice(0, 180),
        date,
        temporalStatus,
        confidence: unit.confidence,
        evidence: unit.text,
      } satisfies TimelineEntry;
    })
    .filter((entry): entry is TimelineEntry => Boolean(entry))
    .slice(0, 80);
}

function detectDecisions(objects: KnowledgeObject[], units: SemanticUnit[], sourceId: string): DecisionRecord[] {
  return units
    .filter((unit) => /\b(decided|decision|chosen|approved|adopted|rejected|superseded|replaced)\b/i.test(unit.text))
    .map((unit) => ({
      id: stableId("decision", `${sourceId}:${unit.id}`),
      decision: unit.text,
      reason: unit.text.match(/\b(because|so that|in order to)\b(.+)/i)?.[2]?.trim() || null,
      alternatives: [],
      outcome: /\b(rejected|failed|not adopted)\b/i.test(unit.text) ? "Rejected" : null,
      date: unit.text.match(/\b20\d{2}\b/)?.[0] || null,
      confidence: unit.confidence,
      replacedBy: unit.text.match(/\b(replaced by|superseded by)\s+([^.;]+)/i)?.[2]?.trim() || null,
      status: (/\b(rejected|not adopted)\b/i.test(unit.text) ? "rejected" : "candidate") as KnowledgeStatus,
      sourceId,
      affectedObjectIds: objects
        .filter((object) => unit.text.includes(object.name) || object.aliases.some((alias) => unit.text.includes(alias)))
        .map((object) => object.id)
        .slice(0, 8),
    }))
    .slice(0, 60);
}

function detectConflicts(objects: KnowledgeObject[], units: SemanticUnit[], source: SourceAnalysis): KnowledgeConflict[] {
  const conflicts: KnowledgeConflict[] = [];
  for (const unit of units) {
    if (!/\b(conflict|contradicts|inconsistent|do not overwrite|unresolved)\b/i.test(unit.text)) continue;
    conflicts.push({
      id: stableId("conflict", `${source.sourceId}:${unit.id}`),
      objectIds: objects.filter((object) => unit.text.includes(object.name)).map((object) => object.id).slice(0, 6),
      field: "status",
      statements: [unit.text],
      status: "unresolved",
      confidence: unit.confidence,
      sourceIds: [source.sourceId],
      clarificationQuestion: "What is the correct current truth for this conflicting information?",
      createdAt: nowIso(),
      resolvedAt: null,
      resolution: null,
    });
  }
  return conflicts.slice(0, 40);
}

function questions(objects: KnowledgeObject[], conflicts: KnowledgeConflict[]): OpenQuestion[] {
  const result: OpenQuestion[] = conflicts.map((conflict) => ({
    id: stableId("question", `${conflict.id}:resolution`),
    category: "status",
    question: conflict.clarificationQuestion,
    targetObjectId: conflict.objectIds[0] || null,
    priority: 1,
    reason: "Unresolved contradiction blocks canonical knowledge promotion.",
  }));
  for (const object of objects) {
    if (object.temporalStatus === "unknown") {
      result.push({
        id: stableId("question", `${object.id}:status`),
        category: "status",
        question: `Is ${object.name} current, historical, experimental, rejected, or superseded?`,
        targetObjectId: object.id,
        priority: 0.86,
        reason: "Temporal status changes retrieval and reasoning policy.",
      });
    }
    if (!object.relatedObjectIds.length && object.importance > 0.65) {
      result.push({
        id: stableId("question", `${object.id}:relationship`),
        category: "relationship",
        question: `What project, goal, workflow, or person does ${object.name} belong to?`,
        targetObjectId: object.id,
        priority: 0.74,
        reason: "Important isolated objects need graph placement before long-term reasoning.",
      });
    }
  }
  return result.sort((a, b) => b.priority - a.priority).slice(0, 16);
}

function indexes(graph: KnowledgeGraphSnapshot): ReasoningIndexes {
  const semantic: Record<string, string[]> = {};
  const relational: Record<string, string[]> = {};
  const hierarchical: Record<string, string[]> = {};
  const procedural: Record<string, string[]> = {};
  const conceptual: Record<string, string[]> = {};
  const dependency: Record<string, string[]> = {};
  for (const object of graph.objects) {
    for (const tag of object.tags) semantic[tag] = [...(semantic[tag] || []), object.id];
    for (const domain of object.domains) conceptual[domain] = [...(conceptual[domain] || []), object.id];
    if (["workflow", "process", "task"].includes(object.type)) procedural[object.type] = [...(procedural[object.type] || []), object.id];
    if (["project", "company", "application"].includes(object.type)) hierarchical[object.id] = object.relatedObjectIds;
  }
  for (const relationship of graph.relationships) {
    relational[relationship.subjectId] = [...(relational[relationship.subjectId] || []), relationship.objectId];
    if (relationship.predicate === "depends_on") dependency[relationship.subjectId] = [...(dependency[relationship.subjectId] || []), relationship.objectId];
  }
  return {
    semantic,
    relational,
    chronological: [...graph.timeline].sort((a, b) => String(a.date || "").localeCompare(String(b.date || ""))),
    hierarchical,
    procedural,
    conceptual,
    dependency,
    graph: graph.relationships.map((relationship) => ({ from: relationship.subjectId, relation: relationship.predicate, to: relationship.objectId })),
  };
}

async function loadGraph(): Promise<StoredKnowledgeGraph> {
  try {
    const parsed = JSON.parse(await fs.readFile(GRAPH_FILE, "utf-8")) as StoredKnowledgeGraph;
    return {
      version: parsed.version || 1,
      updatedAt: parsed.updatedAt || nowIso(),
      objects: parsed.objects || [],
      relationships: parsed.relationships || [],
      timeline: parsed.timeline || [],
      decisions: parsed.decisions || [],
      conflicts: parsed.conflicts || [],
      openQuestions: parsed.openQuestions || [],
      imports: parsed.imports || [],
    };
  } catch {
    return { version: 1, updatedAt: nowIso(), objects: [], relationships: [], timeline: [], decisions: [], conflicts: [], openQuestions: [], imports: [] };
  }
}

async function saveGraph(graph: StoredKnowledgeGraph): Promise<void> {
  await fs.mkdir(GRAPH_DIR, { recursive: true });
  await fs.writeFile(GRAPH_FILE, JSON.stringify(graph, null, 2));
}

function mergeObjects(existing: KnowledgeObject, incoming: KnowledgeObject): KnowledgeObject {
  const incomingTruth = incoming.currentTruth || incoming.historicalTruth;
  const existingTruth = existing.currentTruth || existing.historicalTruth;
  const contradictions = [...existing.contradictions];
  if (incomingTruth && existingTruth && normalizeKey(incomingTruth) !== normalizeKey(existingTruth)) contradictions.push(incomingTruth);
  return {
    ...existing,
    aliases: Array.from(new Set([...existing.aliases, incoming.name, ...incoming.aliases])).slice(0, 18),
    description: normalizeSpace(`${existing.description}\n${incoming.description}`).slice(0, 2200),
    updated: nowIso(),
    status: contradictions.length ? "conflicting" : existing.status,
    confidence: Number(Math.max(existing.confidence, incoming.confidence).toFixed(2)),
    relatedObjectIds: Array.from(new Set([...existing.relatedObjectIds, ...incoming.relatedObjectIds])),
    tags: Array.from(new Set([...existing.tags, ...incoming.tags])).slice(0, 18),
    importance: Math.max(existing.importance, incoming.importance),
    domains: Array.from(new Set([...existing.domains, ...incoming.domains])).slice(0, 6),
    temporalStatus: existing.temporalStatus === "unknown" ? incoming.temporalStatus : existing.temporalStatus,
    currentTruth: existing.currentTruth || incoming.currentTruth,
    historicalTruth: existing.historicalTruth || incoming.historicalTruth,
    evidence: [...existing.evidence, ...incoming.evidence].slice(-20),
    contradictions: Array.from(new Set(contradictions)).slice(0, 12),
    openQuestions: Array.from(new Set([...existing.openQuestions, ...incoming.openQuestions])).slice(0, 12),
    candidate: existing.candidate || incoming.candidate,
  };
}

function graphSnapshot(graph: StoredKnowledgeGraph): KnowledgeGraphSnapshot {
  return {
    version: graph.version,
    updatedAt: graph.updatedAt,
    objects: graph.objects,
    relationships: graph.relationships,
    timeline: graph.timeline,
    decisions: graph.decisions,
    conflicts: graph.conflicts,
    openQuestions: graph.openQuestions,
  };
}

function resolveImportId(input: RawKnowledgeInput, source: SourceAnalysis, importedAt: string): string {
  const explicit = input.metadata?.importId;
  return typeof explicit === "string" && explicit.trim()
    ? explicit.trim()
    : stableId("import", `${source.sourceId}:${importedAt}`);
}

function resolveSourceTag(input: RawKnowledgeInput): string | undefined {
  const value = input.metadata?.source;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveImportMetadata(input: RawKnowledgeInput): Record<string, unknown> | undefined {
  return input.metadata && Object.keys(input.metadata).length ? input.metadata : undefined;
}

function hasImportedSource(graph: StoredKnowledgeGraph, sourceId: string, importId: string): boolean {
  if (graph.imports.some((entry) => entry.importId === importId || entry.sourceId === sourceId)) return true;
  if (graph.objects.some((object) => object.source.sourceId === sourceId || object.evidence.some((item) => item.sourceId === sourceId))) return true;
  if (graph.relationships.some((relationship) => relationship.sourceId === sourceId)) return true;
  if (graph.decisions.some((decision) => decision.sourceId === sourceId)) return true;
  if (graph.conflicts.some((conflict) => conflict.sourceIds.includes(sourceId))) return true;
  return false;
}

async function processInput(input: RawKnowledgeInput, options: { persist: boolean }): Promise<IngestionReport> {
    const text = normalizeSpace(toText(input.content));
    if (!text) throw new Error("content is required");

    const importedAt = nowIso();
    const source = analyzeSource(input, text);
    const importId = resolveImportId(input, source, importedAt);
    const semanticUnits = decompose(text, source);
    const extractedObjects = detectObjects(semanticUnits, source);
    const relationshipMap = detectRelationships(extractedObjects, semanticUnits, source.sourceId);
    const timeline = detectTimeline(extractedObjects, semanticUnits);
    const detectedDecisions = detectDecisions(extractedObjects, semanticUnits, source.sourceId);
    const detectedConflicts = detectConflicts(extractedObjects, semanticUnits, source);
    const openQuestions = questions(extractedObjects, detectedConflicts);
    const graph = await loadGraph();

    const createdObjectIds: string[] = [];
    const updatedObjectIds: string[] = [];
    const byName = new Map(graph.objects.map((object) => [normalizeKey(`${object.type}:${object.name}`), object]));
    for (const object of extractedObjects) {
      const existing = [object.name, ...object.aliases]
        .map((alias) => byName.get(normalizeKey(`${object.type}:${alias}`)))
        .find(Boolean);
      if (existing) {
        const merged = mergeObjects(existing, object);
        graph.objects = graph.objects.map((item) => (item.id === existing.id ? merged : item));
        byName.set(normalizeKey(`${merged.type}:${merged.name}`), merged);
        updatedObjectIds.push(existing.id);
      } else {
        graph.objects.push(object);
        byName.set(normalizeKey(`${object.type}:${object.name}`), object);
        createdObjectIds.push(object.id);
      }
    }

    const existingRelationshipIds = new Set(graph.relationships.map((relationship) => relationship.id));
    const newRelationships = relationshipMap.filter((relationship) => !existingRelationshipIds.has(relationship.id));
    graph.relationships.push(...newRelationships);
    for (const relationship of newRelationships) {
      graph.objects = graph.objects.map((object) => {
        if (object.id !== relationship.subjectId && object.id !== relationship.objectId) return object;
        const related = object.id === relationship.subjectId ? relationship.objectId : relationship.subjectId;
        return { ...object, relatedObjectIds: Array.from(new Set([...object.relatedObjectIds, related])) };
      });
    }

    const addUnique = <T extends { id: string }>(current: T[], incoming: T[]) => {
      const ids = new Set(current.map((item) => item.id));
      return [...current, ...incoming.filter((item) => !ids.has(item.id))];
    };
    const existingConflictIds = new Set(graph.conflicts.map((conflict) => conflict.id));
    const newConflicts = detectedConflicts.filter((conflict) => !existingConflictIds.has(conflict.id));
    graph.timeline = addUnique(graph.timeline, timeline);
    graph.decisions = addUnique(graph.decisions, detectedDecisions);
    graph.conflicts = [...graph.conflicts, ...newConflicts];
    graph.openQuestions = addUnique(graph.openQuestions, openQuestions);
    if (!graph.imports.some((entry) => entry.importId === importId || entry.sourceId === source.sourceId)) {
      graph.imports.unshift({
        importId,
        importedAt,
        sourceId: source.sourceId,
        sourceName: source.primaryTopic,
        sourceUri: source.origin,
        sourceTag: resolveSourceTag(input),
        metadata: resolveImportMetadata(input),
        createdObjectIds,
        updatedObjectIds,
        createdConflictIds: newConflicts.map((conflict) => conflict.id),
      });
      graph.imports = graph.imports.slice(0, 250);
    }
    graph.version += 1;
    graph.updatedAt = nowIso();
    if (options.persist) await saveGraph(graph);

    const snapshot = graphSnapshot(graph);
    const reasoningIndexes = indexes(snapshot);
    const topics = Array.from(new Set([...source.secondaryTopics, ...extractedObjects.flatMap((object) => object.tags)])).slice(0, 16);
    const blockers = [
      !source.author ? "Author or authoritative origin is unknown." : "",
      !source.date ? "Source date is unknown, so recency cannot be trusted." : "",
      source.finality === "unknown" ? "Draft/final status is unclear." : "",
      extractedObjects.some((object) => object.temporalStatus === "unknown") ? "Some objects have unknown current vs historical status." : "",
      detectedConflicts.length ? "Conflicts need user clarification before canonical promotion." : "",
    ].filter(Boolean);
    const extractionConfidence = semanticUnits.length
      ? Number((semanticUnits.reduce((sum, unit) => sum + unit.confidence, 0) / semanticUnits.length).toFixed(2))
      : 0;
    const overall = Number(((source.confidence + extractionConfidence + (relationshipMap.length ? 0.7 : 0.45) + (detectedConflicts.length ? 0.42 : 0.74)) / 4).toFixed(2));

    return {
      importId,
      importedAt,
      executiveSummary: `${sentences(text).slice(0, 2).join(" ") || "Imported source processed into structured candidate knowledge."} Main topics: ${topics.slice(0, 6).join(", ")}. Extracted ${extractedObjects.length} candidate objects and ${detectedConflicts.length} unresolved conflicts.`.slice(0, 900),
      sourceAnalysis: source,
      topics,
      semanticUnits,
      extractedObjects,
      relationshipMap,
      timeline,
      detectedDecisions,
      detectedConflicts,
      openQuestions,
      missingInformation: blockers,
      suggestedConnections: relationshipMap.filter((relationship) => relationship.confidence >= 0.62).slice(0, 20),
      knowledgeGraphChanges: {
        createdObjectIds,
        updatedObjectIds,
        createdRelationshipIds: newRelationships.map((relationship) => relationship.id),
        createdConflictIds: newConflicts.map((conflict) => conflict.id),
        promotedObjectIds: [],
      },
      confidenceReport: {
        overall,
        source: source.confidence,
        extraction: extractionConfidence,
        relationships: relationshipMap.length ? 0.7 : 0.45,
        conflicts: detectedConflicts.length ? 0.42 : 0.74,
      },
      reasoningReadiness: {
        ready: blockers.length === 0 && overall >= 0.68,
        score: Number((overall - Math.min(0.3, blockers.length * 0.06)).toFixed(2)),
        blockers,
        indexes: reasoningIndexes,
      },
      graph: snapshot,
    };
}

export class KnowledgeIngestionService {
  static async ingest(input: RawKnowledgeInput): Promise<IngestionReport> {
    return processInput(input, { persist: true });
  }

  static async preview(input: RawKnowledgeInput): Promise<IngestionReport> {
    return processInput(input, { persist: false });
  }

  static async getImportStatus(input: RawKnowledgeInput): Promise<{
    sourceId: string;
    importId: string;
    alreadyImported: boolean;
  }> {
    const text = normalizeSpace(toText(input.content));
    if (!text) throw new Error("content is required");
    const source = analyzeSource(input, text);
    const importId = resolveImportId(input, source, nowIso());
    const graph = await loadGraph();
    return {
      sourceId: source.sourceId,
      importId,
      alreadyImported: hasImportedSource(graph, source.sourceId, importId),
    };
  }

  static async backfillImportMetadata(input: RawKnowledgeInput): Promise<boolean> {
    const text = normalizeSpace(toText(input.content));
    if (!text) throw new Error("content is required");
    const source = analyzeSource(input, text);
    const importId = resolveImportId(input, source, nowIso());
    const graph = await loadGraph();
    let changed = false;

    graph.imports = graph.imports.map((entry) => {
      if (entry.importId !== importId && entry.sourceId !== source.sourceId) return entry;
      const sourceUri = entry.sourceUri || source.origin;
      const sourceTag = entry.sourceTag || resolveSourceTag(input);
      const metadata = entry.metadata || resolveImportMetadata(input);
      if (sourceUri !== entry.sourceUri || sourceTag !== entry.sourceTag || metadata !== entry.metadata) {
        changed = true;
      }
      return { ...entry, sourceUri, sourceTag, metadata };
    });

    if (changed) {
      graph.updatedAt = nowIso();
      await saveGraph(graph);
    }

    return changed;
  }

  static async getGraph(): Promise<KnowledgeGraphSnapshot> {
    return graphSnapshot(await loadGraph());
  }

  static async getReasoningIndexes(): Promise<ReasoningIndexes> {
    return indexes(await this.getGraph());
  }

  static async promoteObjects(objectIds: string[], reviewer = "user"): Promise<KnowledgeGraphSnapshot> {
    const graph = await loadGraph();
    const reviewedAt = nowIso();
    const ids = new Set(objectIds);
    graph.objects = graph.objects.map((object) =>
      ids.has(object.id)
        ? {
            ...object,
            status: object.status === "candidate" || object.status === "likely" ? "confirmed" : object.status,
            candidate: false,
            lastReviewed: `${reviewedAt} by ${reviewer}`,
            updated: reviewedAt,
          }
        : object,
    );
    graph.version += 1;
    graph.updatedAt = reviewedAt;
    await saveGraph(graph);
    return graphSnapshot(graph);
  }

  static async resolveConflict(conflictId: string, resolution: string, reviewer = "user"): Promise<KnowledgeGraphSnapshot> {
    const graph = await loadGraph();
    const resolvedAt = nowIso();
    graph.conflicts = graph.conflicts.map((conflict) =>
      conflict.id === conflictId ? { ...conflict, status: "resolved", resolution, resolvedAt } : conflict,
    );
    const conflict = graph.conflicts.find((item) => item.id === conflictId);
    if (conflict) {
      graph.objects = graph.objects.map((object) =>
        conflict.objectIds.includes(object.id)
          ? {
              ...object,
              status: "likely",
              currentTruth: resolution,
              contradictions: object.contradictions.filter((item) => normalizeKey(item) !== normalizeKey(resolution)),
              lastReviewed: `${resolvedAt} by ${reviewer}`,
              updated: resolvedAt,
            }
          : object,
      );
    }
    graph.version += 1;
    graph.updatedAt = resolvedAt;
    await saveGraph(graph);
    return graphSnapshot(graph);
  }
}
