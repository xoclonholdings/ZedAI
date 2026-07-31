import { randomUUID } from "crypto";
import type {
  AnyMemoryObject,
  ObjectRelationship,
  ObjectSourceRef,
  PromotionTier,
  RelationshipType,
} from "../../../shared/object-memory-types";

/**
 * Heuristic object extractor for the base-memory reparse.
 *
 * This is intentionally deterministic — pattern-based rules over the
 * source text — so extraction is reproducible and testable. A future
 * pass may layer LLM extraction on top for looser inference, but that
 * lands behind an --llm flag.
 *
 * Every extracted object carries at least one ObjectSourceRef with a
 * verbatim evidenceQuote. Nothing is fabricated: an object is only
 * emitted when a pattern anchor actually matches in the text.
 */

const now = () => new Date().toISOString();

function makeId(type: string): string {
  return `obj_${type}_${randomUUID().slice(0, 8)}`;
}

function makeRelId(): string {
  return `rel_${randomUUID().slice(0, 8)}`;
}

export interface ExtractInput {
  sourceFile: string;
  conversationTitle?: string;
  text: string;
  messageIndex?: number;
}

export interface ExtractOutput {
  objects: AnyMemoryObject[];
  relationships: ObjectRelationship[];
}

function classifyPromotion(type: string, confidence: number): PromotionTier {
  if (confidence < 0.5) return "requires_review";
  if (type === "user_profile" || type === "rule" || type === "preference") {
    return "core_memory_candidate";
  }
  if (type === "project" || type === "system" || type === "feature" || type === "repository") {
    return "project_memory_candidate";
  }
  if (type === "task" || type === "open_question" || type === "event") {
    return "working_memory_candidate";
  }
  if (type === "memory_conflict") return "requires_review";
  return "project_memory_candidate";
}

function ref(input: ExtractInput, evidence: string): ObjectSourceRef {
  return {
    sourceFile: input.sourceFile,
    conversationTitle: input.conversationTitle,
    messageIndex: input.messageIndex,
    evidenceQuote: evidence.slice(0, 240),
    extractedAt: now(),
  };
}

/**
 * Pattern set. Each pattern is anchored on a distinctive phrase or
 * marker likely to appear in real ZAR foundation text.
 */
const PROJECT_PATTERN = /\b(ZAR|ZarAI|ZebCom|xoclon(?:holdings)?|Fantasma)\b/gi;
const REPO_PATTERN = /\b(xoclonholdings\/[A-Za-z0-9_-]+|github\.com\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+)\b/gi;
const SYSTEM_PATTERN = /\b(ManagerAgent|OperationsAgent|IntelligenceAgent|BusinessManagerAgent|FinanceAgent|KnowledgeService|MemoryService|ChatExecutionService|ContextInquiryEngine|ZarReflectionEngine|ZarPrincipleEngine|ZarStrategicReasoningEngine|ZarVoiceFormationEngine|ZarResponseGovernance|AccessPolicyService|TraceValidator|SelfRepairService)\b/g;
const INTEGRATION_PATTERN = /\b(Lightning ?AI|Gmail|Google (?:Calendar|Drive)|GitHub|Neon|ChromaDB|Brave|Serper|SMTP|Stripe|PayPal|Kalshi|TradingView)\b/g;
const DECISION_MARKERS = /\b(I decided|We decided|The decision is|We're going with|Going with|Chose to|Ruled out|Moving to|Switched to)\b/gi;
const PREFERENCE_MARKERS = /\b(I prefer|I want|I like|I do not want|I don't want|I hate|Avoid|Never|Always)\b/gi;
const RULE_MARKERS = /\b(Rule:|ZAR must|ZAR should never|Do not|Must not|Should not|Always must)\b/gi;
const CONSTRAINT_MARKERS = /\b(I can only|The constraint is|Limited to|Cannot|Blocked by|Only has|Budget of)\b/gi;
const OPEN_QUESTION_MARKERS = /\b(TBD|Not sure|Undecided|Open question|Still deciding|What should)\b/gi;
const TASK_MARKERS = /\b(TODO|To do:|Task:|Need to|Have to|Should\b)\b/gi;
const EVENT_MARKERS = /\b(Shipped|Deployed|Merged|Fixed|Broke|Failed|Migrated|Rolled out)\b/gi;

function splitIntoSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 6 && s.length <= 400);
}

export function extractObjectsFromSource(input: ExtractInput): ExtractOutput {
  const objects: AnyMemoryObject[] = [];
  const relationships: ObjectRelationship[] = [];
  const nameToId = new Map<string, string>();

  const upsertNamed = (
    type: AnyMemoryObject["type"],
    canonicalName: string,
    summary: string,
    properties: Record<string, unknown>,
    evidence: string,
    confidence: number,
  ) => {
    const key = `${type}:${canonicalName.toLowerCase()}`;
    if (nameToId.has(key)) return nameToId.get(key)!;
    const id = makeId(type);
    nameToId.set(key, id);
    objects.push({
      id,
      type,
      canonicalName,
      aliases: [],
      summary,
      properties,
      sourceRefs: [ref(input, evidence)],
      confidence,
      createdAt: now(),
      updatedAt: now(),
      status: "active",
      promotionTier: classifyPromotion(type, confidence),
    } as AnyMemoryObject);
    return id;
  };

  const addRel = (
    fromId: string,
    rel: RelationshipType,
    toId: string,
    evidence: string,
  ) => {
    if (fromId === toId) return;
    relationships.push({
      id: makeRelId(),
      fromObjectId: fromId,
      relationshipType: rel,
      toObjectId: toId,
      evidence: evidence.slice(0, 240),
      confidence: 0.75,
      createdAt: now(),
    });
  };

  const text = input.text;

  // Projects
  for (const match of text.matchAll(PROJECT_PATTERN)) {
    upsertNamed(
      "project",
      match[1],
      `Project ${match[1]} referenced in foundation memory.`,
      { domain: "software" },
      match[0],
      0.85,
    );
  }

  // Repositories
  for (const match of text.matchAll(REPO_PATTERN)) {
    const repoName = match[1].replace(/^github\.com\//, "");
    const [owner, name] = repoName.split("/");
    upsertNamed(
      "repository",
      repoName,
      `Repository ${repoName}.`,
      { repoName: name, owner, project: name },
      match[0],
      0.9,
    );
  }

  // Systems / services
  for (const match of text.matchAll(SYSTEM_PATTERN)) {
    upsertNamed(
      "system",
      match[1],
      `System component ${match[1]}.`,
      { role: match[1].endsWith("Agent") ? "agent" : "service" },
      match[0],
      0.9,
    );
  }

  // Integrations
  for (const match of text.matchAll(INTEGRATION_PATTERN)) {
    upsertNamed(
      "integration",
      match[1],
      `Integration ${match[1]}.`,
      { provider: match[1] },
      match[0],
      0.8,
    );
  }

  // Sentence-level scans
  for (const sentence of splitIntoSentences(text)) {
    if (DECISION_MARKERS.test(sentence)) {
      upsertNamed(
        "decision",
        sentence.slice(0, 60),
        sentence,
        { decision: sentence },
        sentence,
        0.7,
      );
    }
    DECISION_MARKERS.lastIndex = 0;

    if (PREFERENCE_MARKERS.test(sentence)) {
      upsertNamed(
        "preference",
        sentence.slice(0, 60),
        sentence,
        { preference: sentence, strength: /never|always|hate/i.test(sentence) ? "strong" : "medium" },
        sentence,
        0.7,
      );
    }
    PREFERENCE_MARKERS.lastIndex = 0;

    if (RULE_MARKERS.test(sentence)) {
      upsertNamed(
        "rule",
        sentence.slice(0, 60),
        sentence,
        { rule: sentence, severity: /must|never/i.test(sentence) ? "high" : "normal" },
        sentence,
        0.75,
      );
    }
    RULE_MARKERS.lastIndex = 0;

    if (CONSTRAINT_MARKERS.test(sentence)) {
      upsertNamed(
        "constraint",
        sentence.slice(0, 60),
        sentence,
        { constraint: sentence, permanence: "long_term" },
        sentence,
        0.65,
      );
    }
    CONSTRAINT_MARKERS.lastIndex = 0;

    if (OPEN_QUESTION_MARKERS.test(sentence)) {
      upsertNamed(
        "open_question",
        sentence.slice(0, 60),
        sentence,
        { question: sentence },
        sentence,
        0.6,
      );
    }
    OPEN_QUESTION_MARKERS.lastIndex = 0;

    if (TASK_MARKERS.test(sentence)) {
      upsertNamed(
        "task",
        sentence.slice(0, 60),
        sentence,
        { task: sentence, taskStatus: "pending" },
        sentence,
        0.55,
      );
    }
    TASK_MARKERS.lastIndex = 0;

    if (EVENT_MARKERS.test(sentence)) {
      upsertNamed(
        "event",
        sentence.slice(0, 60),
        sentence,
        { event: sentence },
        sentence,
        0.7,
      );
    }
    EVENT_MARKERS.lastIndex = 0;
  }

  // Relationships: agents belong to ZAR
  const zarId = Array.from(nameToId.entries()).find(([k]) => k === "project:zar")?.[1];
  if (zarId) {
    for (const [key, id] of nameToId) {
      if (key.startsWith("system:") && key.includes("agent")) {
        addRel(zarId, "USES", id, "System is a component of ZAR.");
      }
    }
  }

  // Repository BELONGS_TO project
  for (const [key, id] of nameToId) {
    if (!key.startsWith("repository:")) continue;
    const repoName = key.replace("repository:", "");
    for (const [pkey, pid] of nameToId) {
      if (!pkey.startsWith("project:")) continue;
      const projectName = pkey.replace("project:", "");
      if (repoName.toLowerCase().includes(projectName.toLowerCase())) {
        addRel(id, "BELONGS_TO", pid, `${repoName} is the repository for ${projectName}.`);
      }
    }
  }

  return { objects, relationships };
}
