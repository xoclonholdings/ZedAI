import { createHash } from "crypto";

import { KnowledgeIngestionService } from "./KnowledgeIngestionService";
import type {
  ContextAssessment,
  ContextEngineResult,
  ContextQuestion,
  ContextScore,
  DecisionJournalEntry,
  KnowledgeConflict,
  KnowledgeObject,
} from "./types";

export interface ContextEngineInput {
  userInput: string;
  candidateObjectIds?: string[];
  includeGraph?: boolean;
  clarification?: {
    text: string;
    affectedObjectIds?: string[];
    previousClassification?: string | null;
    newClassification?: string | null;
  };
}

function stableId(prefix: string, value: string): string {
  return `${prefix}_${createHash("sha1").update(value).digest("hex").slice(0, 16)}`;
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreObject(object: KnowledgeObject): ContextScore {
  const unknownFields: string[] = [];
  if (!object.name) unknownFields.push("identity");
  if (!object.description) unknownFields.push("description");
  if (object.temporalStatus === "unknown") unknownFields.push("temporalStatus");
  if (object.status === "unknown" || object.status === "candidate") unknownFields.push("validationStatus");
  if (!object.relatedObjectIds.length) unknownFields.push("relationships");
  if (!object.currentTruth && !object.historicalTruth) unknownFields.push("truthState");

  const completeness = Math.max(0, 1 - unknownFields.length / 7);
  const relationshipDensity = Math.min(1, object.relatedObjectIds.length / 5);
  const contextDepth = Math.min(1, (object.evidence.length + object.tags.length / 3 + object.domains.length) / 8);
  const updatedAt = Number(new Date(object.updated));
  const ageDays = Number.isFinite(updatedAt) ? (Date.now() - updatedAt) / 86400000 : 999;

  return {
    completeness: Number(completeness.toFixed(2)),
    confidence: object.confidence,
    recency: Number(Math.max(0.1, Math.min(1, 1 - ageDays / 365)).toFixed(2)),
    relationshipDensity: Number(relationshipDensity.toFixed(2)),
    conflictCount: object.contradictions.length,
    contextDepth: Number(contextDepth.toFixed(2)),
    unknownFields,
  };
}

function aggregateScore(objects: KnowledgeObject[], conflicts: KnowledgeConflict[]): ContextScore {
  if (!objects.length) {
    return {
      completeness: 0,
      confidence: 0,
      recency: 0,
      relationshipDensity: 0,
      conflictCount: conflicts.length,
      contextDepth: 0,
      unknownFields: ["identity", "purpose", "relationships", "status"],
    };
  }
  const scores = objects.map(scoreObject);
  const average = (field: keyof Omit<ContextScore, "unknownFields" | "conflictCount">) =>
    Number((scores.reduce((sum, score) => sum + Number(score[field]), 0) / scores.length).toFixed(2));
  return {
    completeness: average("completeness"),
    confidence: average("confidence"),
    recency: average("recency"),
    relationshipDensity: average("relationshipDensity"),
    conflictCount: conflicts.length + scores.reduce((sum, score) => sum + score.conflictCount, 0),
    contextDepth: average("contextDepth"),
    unknownFields: Array.from(new Set(scores.flatMap((score) => score.unknownFields))),
  };
}

function queryTerms(input: string): string[] {
  return Array.from(input.toLowerCase().matchAll(/[a-z][a-z0-9-]{2,}/g))
    .map((match) => match[0])
    .filter((term) => !["what", "why", "how", "when", "where", "this", "that", "about", "with", "from"].includes(term))
    .slice(0, 20);
}

function findRelevantObjects(userInput: string, objects: KnowledgeObject[], explicitIds?: string[]): KnowledgeObject[] {
  const explicit = explicitIds?.length ? objects.filter((object) => explicitIds.includes(object.id)) : [];
  const terms = queryTerms(userInput);
  const inferred = objects
    .map((object) => {
      const haystack = normalizeKey(`${object.name} ${object.aliases.join(" ")} ${object.description} ${object.tags.join(" ")}`);
      const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      return { object, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.object.importance - a.object.importance)
    .slice(0, 8)
    .map((item) => item.object);
  return Array.from(new Map([...explicit, ...inferred].map((object) => [object.id, object])).values()).slice(0, 10);
}

function requestsProjectContext(userInput: string): boolean {
  return /\b(research|competitor|competitors|market|business|niche|audience|positioning|strategy|next move|launch|customers)\b/i.test(userInput);
}

function hasExplicitProjectReference(userInput: string, objects: KnowledgeObject[]): boolean {
  const normalizedInput = normalizeKey(userInput);
  return objects.some((object) => {
    if (!["project", "product", "company"].includes(object.type)) return false;
    const names = [object.name, ...object.aliases]
      .map(normalizeKey)
      .filter((name) => /\b(zwap|zed|zcos|zebcom|zebulon|stepwise)\b/.test(name));
    return names.some((name) => normalizedInput.includes(name));
  });
}

function projectFamilyKey(name: string): string {
  const normalized = normalizeKey(name);
  if (/\bzwap\b/i.test(name) || /\bzwap\b/.test(normalized)) return "ZWAP";
  if (/\bzed\b/i.test(name) || /\bzed\b/.test(normalized)) return "ZED";
  if (/\bzcos\b/i.test(name) || /\bzcos\b/.test(normalized)) return "ZCOS";
  return name
    .replace(/\b(the|app|project|platform|system|promo|strategy|design|redesign|implementation|flow|plan)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function temporalWeight(object: KnowledgeObject): number {
  if (["rejected", "superseded"].includes(object.temporalStatus)) return -3;
  if (object.temporalStatus === "historical") return -1;
  if (["approved", "current", "future", "draft", "unknown"].includes(object.temporalStatus)) return 0.4;
  return 0;
}

function inferProjectContext(userInput: string, objects: KnowledgeObject[]): ContextAssessment["inferredContext"] {
  if (!requestsProjectContext(userInput)) return null;
  if (hasExplicitProjectReference(userInput, objects)) return null;

  const projectObjects = objects.filter((object) => {
    if (!["project", "product", "company", "concept", "feature", "goal"].includes(object.type)) return false;
    if (["rejected", "superseded"].includes(object.temporalStatus)) return false;
    if (/\bstepwise\b/i.test(object.name) && object.status !== "confirmed") return false;
    return /\b(zwap|zed|zcos|zebcom|zebulon)\b/i.test([object.name, ...object.aliases, object.description].join(" "));
  });

  const grouped = new Map<string, { label: string; objects: KnowledgeObject[]; score: number }>();
  for (const object of projectObjects) {
    const label = projectFamilyKey(object.name);
    if (!label || label.length < 3) continue;
    const current = grouped.get(label) || { label, objects: [], score: 0 };
    const evidenceScore = Math.min(2, object.evidence.length * 0.2);
    const relationshipScore = Math.min(1, object.relatedObjectIds.length * 0.15);
    const statusScore = object.status === "confirmed" ? 1.2 : object.status === "candidate" ? 0.55 : object.status === "conflicting" ? 0.25 : 0;
    const nameScore = label === "ZWAP" ? 1.2 : label === "ZED" ? 0.4 : 0.2;
    current.objects.push(object);
    current.score += object.confidence + evidenceScore + relationshipScore + statusScore + temporalWeight(object) + nameScore;
    grouped.set(label, current);
  }

  const ranked = [...grouped.values()]
    .map((item) => ({
      ...item,
      confidence: Number(Math.min(0.92, (item.score / Math.max(1, item.objects.length * 2.7)) + Math.min(0.18, item.objects.length * 0.02)).toFixed(2)),
    }))
    .filter((item) => item.objects.length >= 3 && item.confidence >= 0.68)
    .sort((a, b) => b.confidence - a.confidence || b.objects.length - a.objects.length);

  const best = ranked[0];
  if (!best) return null;
  return {
    label: best.label,
    confidence: best.confidence,
    objectIds: best.objects.slice(0, 10).map((object) => object.id),
    reason: `${best.label} appears repeatedly in foundation-reparsed project knowledge and is the strongest available business/project context for this generic request.`,
  };
}

function findRelevantConflicts(objects: KnowledgeObject[], conflicts: KnowledgeConflict[]): KnowledgeConflict[] {
  const ids = new Set(objects.map((object) => object.id));
  if (!ids.size) return [];
  return conflicts.filter((conflict) => conflict.objectIds.some((id) => ids.has(id))).slice(0, 10);
}

function questionForField(object: KnowledgeObject, field: string): ContextQuestion | null {
  if (field === "temporalStatus") {
    return {
      id: stableId("ctxq", `${object.id}:temporalStatus`),
      category: "status",
      question: `Is ${object.name} current, historical, rejected, or superseded?`,
      targetObjectId: object.id,
      priority: 0.94,
      wouldChange: ["classification", "reasoning", "retrieval"],
    };
  }
  if (field === "relationships") {
    return {
      id: stableId("ctxq", `${object.id}:relationships`),
      category: "relationship",
      question: `What does ${object.name} belong to or directly affect in ZED?`,
      targetObjectId: object.id,
      priority: 0.82,
      wouldChange: ["storage", "reasoning", "retrieval"],
    };
  }
  if (field === "validationStatus") {
    return {
      id: stableId("ctxq", `${object.id}:validationStatus`),
      category: "priority",
      question: `Should ${object.name} remain candidate knowledge or become canonical knowledge?`,
      targetObjectId: object.id,
      priority: 0.78,
      wouldChange: ["storage", "reasoning"],
    };
  }
  if (field === "truthState") {
    return {
      id: stableId("ctxq", `${object.id}:truthState`),
      category: "purpose",
      question: `What is the current truth ZED should remember about ${object.name}?`,
      targetObjectId: object.id,
      priority: 0.76,
      wouldChange: ["storage", "reasoning", "retrieval"],
    };
  }
  return null;
}

function generateQuestions(objects: KnowledgeObject[], conflicts: KnowledgeConflict[], score: ContextScore): ContextQuestion[] {
  const questions: ContextQuestion[] = conflicts
    .filter((conflict) => conflict.status === "unresolved")
    .map((conflict) => ({
      id: stableId("ctxq", `${conflict.id}:conflict`),
      category: "status",
      question: conflict.clarificationQuestion,
      targetObjectId: conflict.objectIds[0] || null,
      priority: 1,
      wouldChange: ["conflict_resolution", "reasoning", "storage"],
    }));

  for (const object of objects) {
    const objectScore = scoreObject(object);
    for (const field of objectScore.unknownFields) {
      const question = questionForField(object, field);
      if (question) questions.push(question);
    }
    if (object.confidence < 0.55) {
      questions.push({
        id: stableId("ctxq", `${object.id}:confidence`),
        category: "confidence",
        question: `How certain should ZED be about ${object.name}?`,
        targetObjectId: object.id,
        priority: 0.68,
        wouldChange: ["storage", "reasoning"],
      });
    }
  }

  if (!objects.length && score.unknownFields.includes("identity")) {
    questions.push({
      id: stableId("ctxq", `unknown:${Date.now()}`),
      category: "identity",
      question: "What existing project, person, workflow, or topic should this connect to?",
      targetObjectId: null,
      priority: 0.86,
      wouldChange: ["classification", "storage", "retrieval"],
    });
  }

  return Array.from(new Map(questions.map((question) => [question.id, question])).values())
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);
}

function createDecisionJournalEntry(input: ContextEngineInput, relevantObjects: KnowledgeObject[]): DecisionJournalEntry | null {
  if (!input.clarification) return null;
  const affectedObjectIds = input.clarification.affectedObjectIds?.length
    ? input.clarification.affectedObjectIds
    : relevantObjects.map((object) => object.id).slice(0, 5);
  return {
    id: stableId("journal", `${input.userInput}:${input.clarification.text}:${Date.now()}`),
    originalUnderstanding: input.userInput,
    userClarification: input.clarification.text,
    reasonForChange: "User clarification materially changed classification, storage, or reasoning context.",
    affectedObjectIds,
    previousClassification: input.clarification.previousClassification || null,
    newClassification: input.clarification.newClassification || null,
    timestamp: new Date().toISOString(),
    confidence: 0.92,
  };
}

export class ContextInquiryEngine {
  static async assess(input: ContextEngineInput): Promise<ContextEngineResult> {
    const graph = await KnowledgeIngestionService.getGraph();
    const inferredContext = inferProjectContext(input.userInput, graph.objects);
    const relevantObjects = findRelevantObjects(input.userInput, graph.objects, [
      ...(input.candidateObjectIds || []),
      ...(inferredContext?.objectIds || []),
    ]);
    const relevantConflicts = findRelevantConflicts(relevantObjects, graph.conflicts);
    const contextScore = aggregateScore(relevantObjects, relevantConflicts);
    const questions = generateQuestions(relevantObjects, relevantConflicts, contextScore);
    const canProceedWithAssumption =
      Boolean(inferredContext) &&
      inferredContext!.confidence >= 0.68 &&
      requestsProjectContext(input.userInput);

    const knowsIdentity = relevantObjects.length > 0 && !contextScore.unknownFields.includes("identity");
    const knowsPurpose = relevantObjects.some((object) => object.description.length > 20 || object.currentTruth || object.historicalTruth);
    const knowsSignificance = relevantObjects.some((object) => object.importance >= 0.62 || object.status === "confirmed");
    const knowsCurrency = relevantObjects.length > 0 && !contextScore.unknownFields.includes("temporalStatus");
    const knowsAdoptionStatus = relevantObjects.length > 0 && !contextScore.unknownFields.includes("validationStatus");
    const knowsRelationships = relevantObjects.some((object) => object.relatedObjectIds.length > 0);
    const hasRelevantStoredContext = relevantObjects.length > 0;
    const materialUncertainty =
      !canProceedWithAssumption &&
      hasRelevantStoredContext &&
      (relevantConflicts.some((conflict) => conflict.status === "unresolved") ||
        contextScore.completeness < 0.62 ||
        contextScore.confidence < 0.58 ||
        questions.some((question) => question.priority >= 0.86));

    const assessment: ContextAssessment = {
      knowsIdentity,
      knowsPurpose,
      knowsSignificance,
      knowsCurrency,
      knowsAdoptionStatus,
      knowsRelationships,
      materialUncertainty,
      inferredContext,
      contextScore,
      questions,
      responsePolicy: materialUncertainty ? "inquire_first" : "answer",
    };

    return {
      assessment,
      relevantObjects,
      relevantConflicts,
      decisionJournalEntry: createDecisionJournalEntry(input, relevantObjects),
    };
  }
}
