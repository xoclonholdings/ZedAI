import { randomUUID } from "crypto";

import { getProject } from "../ProjectFilingStore";
import { generateChatFromProvider } from "../ModelProviderService";
import { buildWorkspaceMemoryContext } from "../WorkspaceMemoryService";
import { DocumentIntelligenceService } from "../intelligence-core/DocumentIntelligenceService";
import { LearningStore } from "./LearningStore";
import type {
  AssessmentAttempt,
  AssessmentAttemptAnswer,
  BlueprintRevision,
  CourseSource,
  CourseSourceIngestion,
  LearningAssessment,
  LearningBlueprint,
  LearningBlueprintLesson,
  LearningBlueprintUnit,
  LearningLesson,
  LearningPath,
  LearningPathDetail,
  LearningUnit,
  LessonCitation,
  MasteryRecord,
  QuizQuestion,
} from "../../../shared/learning-types";

interface SourceInput {
  kind: CourseSource["kind"];
  label: string;
  content: string;
  sourceUri?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateLearningBlueprintInput {
  userId: string;
  isAdmin?: boolean;
  topic: string;
  assumedLevel?: string;
  workspaceId?: string;
  projectId?: string;
  notes?: string;
  sources?: SourceInput[];
}

const WORKSPACE_LABEL: Record<string, string> = {
  research: "Research",
  operations: "Operations",
  finance: "Finance",
  marketing: "Marketing",
  education: "Education",
};

const STORED_SOURCE_CHARS = 60_000;
const GENERATION_LANE = "education";

function now(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 10)}`;
}

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cleanTopic(value: string): string {
  return normalizeSpace(value).slice(0, 120);
}

function titleCase(value: string): string {
  return normalizeSpace(value)
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function excerpt(value: string, length: number): string {
  const text = normalizeSpace(value || "");
  return text.length > length ? `${text.slice(0, length).trim()}...` : text;
}

function toStringArray(value: unknown, limit = 12): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v : String(v ?? "")))
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, limit);
}

/** Strips ```json fences and grabs the outermost JSON structure, matching the
 *  convention already used by TradingAssessmentEngine / WorkspaceDeskEngine. */
function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.search(/[[{]/);
  const end = Math.max(body.lastIndexOf("]"), body.lastIndexOf("}"));
  return start >= 0 && end > start ? body.slice(start, end + 1) : body.trim();
}

function describeGenerationFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");
  const lower = message.toLowerCase();
  if (lower.includes("lightning_base_url") || lower.includes("lightning_ai_url")) {
    return "the AI host is not configured";
  }
  if (lower.includes("timeout") || lower.includes("aborted")) {
    return "the AI host timed out";
  }
  if (lower.includes("fetch failed") || lower.includes("econnrefused") || lower.includes("enotfound")) {
    return "the AI host is unreachable";
  }
  if (/\b(401|403)\b/.test(message) || lower.includes("unauthorized") || lower.includes("forbidden")) {
    return "the AI host rejected the request";
  }
  return message || "the AI host returned an error";
}

async function askModelForJson(params: {
  prompt: string;
  systemPrompt: string;
  failureContext: string;
}): Promise<any> {
  let raw: string;
  try {
    raw = await generateChatFromProvider(
      [{ role: "user", content: params.prompt }],
      params.systemPrompt,
      { lane: GENERATION_LANE },
    );
  } catch (error) {
    throw new Error(`${params.failureContext} failed because ${describeGenerationFailure(error)}.`);
  }
  try {
    return JSON.parse(extractJson(raw));
  } catch {
    throw new Error(
      `${params.failureContext} failed because the AI host returned a response Zed could not parse.`,
    );
  }
}

/**
 * Push a source's full extracted text through the shared Knowledge
 * Ingestion pipeline (same graph used by conversation uploads / Document
 * Intelligence) instead of keeping Learning Studio as an isolated content
 * store. Best-effort: ingestion failure must not fail blueprint creation.
 */
async function ingestSource(
  userId: string,
  pathId: string,
  label: string,
  content: string,
): Promise<CourseSourceIngestion> {
  const summary = await DocumentIntelligenceService.ingestUploadedFile({
    originalName: label,
    content,
    userId,
    createdAt: now(),
  }).catch((error: any) => ({
    ingested: false,
    createdObjectIds: [],
    updatedObjectIds: [],
    topics: [],
    conflictCount: 0,
    skippedReason: `ingest_failed:${error?.message || String(error)}`,
  }));
  return {
    ingested: summary.ingested,
    topics: summary.topics || [],
    objectIds: [...(summary.createdObjectIds || []), ...(summary.updatedObjectIds || [])],
    conflictCount: summary.conflictCount || 0,
    skippedReason: summary.skippedReason,
  };
}

/** Semantic retrieval grounded in the shared knowledge graph, falling back
 *  to nothing (never to keyword-stuffed raw text) when nothing matches yet. */
async function retrieveGrounding(query: string, limit: number): Promise<{ block: string; citations: string[] }> {
  const result = await DocumentIntelligenceService.retrieveForQuery(query, limit).catch(() => ({
    block: "",
    objectIds: [],
    citations: [],
    conflictCount: 0,
  }));
  return { block: result.block, citations: result.citations };
}

function rawSourceExcerpts(sources: CourseSource[], perSourceChars: number, maxSources: number): string {
  const selected = sources
    .filter((source) => source.content.trim() && source.kind !== "topic")
    .slice(0, maxSources)
    .map((source) => `### ${source.label} (${source.kind})\n${excerpt(source.content, perSourceChars)}`);
  return selected.join("\n\n");
}

/** Flattens the blueprint's units/lessons in blueprint order — this is the
 *  single source of truth for lesson/unit sequencing (never a hardcoded
 *  constant like the old `order: 1` on every generated lesson). */
function flattenedLessonList(
  blueprint: LearningBlueprint,
): Array<{ unit: LearningBlueprintUnit; lesson: LearningBlueprintLesson }> {
  const list: Array<{ unit: LearningBlueprintUnit; lesson: LearningBlueprintLesson }> = [];
  for (const unit of blueprint.units) {
    for (const lesson of unit.lessons) list.push({ unit, lesson });
  }
  return list;
}

async function generateBlueprintFromModel(params: {
  topic: string;
  assumedLevel: string;
  notes: string;
  groundingBlock: string;
  rawExcerpts: string;
  workspacePrompt: string;
  projectPrompt: string;
}): Promise<{
  objective: string;
  assumedLevel: string;
  estimatedDepth: string;
  units: Array<{ title: string; objective: string; lessons: Array<Omit<LearningBlueprintLesson, "id">> }>;
  practiceActivities: string[];
  completionCriteria: string[];
  gaps: string[];
}> {
  const prompt = [
    `Design a mastery-based course blueprint on: "${params.topic}".`,
    `Assumed learner level: ${params.assumedLevel}.`,
    params.notes ? `\nUser notes / constraints:\n${params.notes}` : "",
    params.workspacePrompt ? `\n${params.workspacePrompt}` : "",
    params.projectPrompt ? `\n${params.projectPrompt}` : "",
    params.groundingBlock ? `\n${params.groundingBlock}` : "",
    params.rawExcerpts ? `\n## Raw source excerpts\n${params.rawExcerpts}` : "",
    !params.groundingBlock && !params.rawExcerpts
      ? "\nNo source material was supplied beyond the topic itself — design the blueprint from your own knowledge, and say so honestly in `gaps`."
      : "",
    `\nAnalyze the material: identify the real concepts it teaches, the dependencies between them (what must be understood before what), concrete learning objectives, and any gaps or missing information a learner should be warned about.`,
    `Then produce a blueprint with 2-4 units, each with 2-4 lessons, sized to how much real material actually supports them — do not pad to a fixed count. Every lesson must be specific to this source material, not a generic template.`,
    `Return ONLY JSON with this exact shape:`,
    `{`,
    `  "objective": "one paragraph: what mastery of this topic looks like",`,
    `  "assumedLevel": "confirmed/adjusted assumed level",`,
    `  "estimatedDepth": "one sentence describing scope (unit/lesson count and why)",`,
    `  "units": [`,
    `    {`,
    `      "title": "...",`,
    `      "objective": "...",`,
    `      "lessons": [`,
    `        { "title": "...", "objective": "...", "keyConcepts": ["..."], "practice": "a concrete practice task", "verification": "how mastery of this lesson is verified" }`,
    `      ]`,
    `    }`,
    `  ],`,
    `  "practiceActivities": ["2-4 activities that apply the whole course"],`,
    `  "completionCriteria": ["2-4 concrete, checkable criteria"],`,
    `  "gaps": ["gaps or missing information found in the source material, or [] if none"]`,
    `}`,
  ]
    .filter(Boolean)
    .join("\n");

  const parsed = await askModelForJson({
    prompt,
    systemPrompt:
      "You are Zed's Cognitive Core designing a course blueprint from real source material. Ground every unit and lesson in what was actually provided — never invent generic filler. Output only the JSON object requested, no commentary.",
    failureContext: "Blueprint generation",
  });

  const parsedUnits = Array.isArray(parsed.units) ? parsed.units : [];
  if (parsedUnits.length === 0) {
    throw new Error("Blueprint generation failed because the AI host did not return any units.");
  }

  return {
    objective: String(parsed.objective || "").trim() || `Understand and apply ${params.topic}.`,
    assumedLevel: String(parsed.assumedLevel || params.assumedLevel).trim(),
    estimatedDepth: String(parsed.estimatedDepth || "").trim() || `${parsedUnits.length} units.`,
    units: parsedUnits.map((unit: any) => ({
      title: String(unit?.title || "Untitled unit").trim(),
      objective: String(unit?.objective || "").trim(),
      lessons: (Array.isArray(unit?.lessons) ? unit.lessons : []).map((lesson: any) => ({
        title: String(lesson?.title || "Untitled lesson").trim(),
        objective: String(lesson?.objective || "").trim(),
        keyConcepts: toStringArray(lesson?.keyConcepts, 6),
        practice: String(lesson?.practice || "").trim(),
        verification: String(lesson?.verification || "").trim(),
      })),
    })).filter((unit) => unit.lessons.length > 0),
    practiceActivities: toStringArray(parsed.practiceActivities, 6),
    completionCriteria: toStringArray(parsed.completionCriteria, 6),
    gaps: toStringArray(parsed.gaps, 10),
  };
}

async function generateLesson(
  userId: string,
  path: LearningPath,
  unit: LearningBlueprintUnit,
  lessonBlueprint: LearningBlueprintLesson,
  order: number,
  sources: CourseSource[],
): Promise<LearningLesson> {
  const createdAt = now();
  const concepts = lessonBlueprint.keyConcepts.slice(0, 6);
  const query = `${lessonBlueprint.title} ${lessonBlueprint.objective} ${concepts.join(" ")}`.trim();
  const grounding = await retrieveGrounding(query || path.topic, 6);
  const excerpts = rawSourceExcerpts(sources, 900, 5);

  const prompt = [
    `Course: ${path.title} — ${path.objective}`,
    `Unit: ${unit.title} — ${unit.objective}`,
    `Lesson to write: "${lessonBlueprint.title}"`,
    `Lesson objective: ${lessonBlueprint.objective}`,
    `Key concepts to cover: ${concepts.join(", ") || "(none listed — infer from the objective)"}`,
    grounding.block ? `\n${grounding.block}` : "",
    excerpts ? `\n## Raw source excerpts\n${excerpts}` : "",
    !grounding.block && !excerpts
      ? "\nNo grounded source material matched this lesson yet — write it from established knowledge and say so plainly instead of inventing citations."
      : "",
    `\nWrite the full lesson. Ground claims in the material above and reference sources by name inline (e.g. "According to <source>...") wherever you draw on them — never fabricate a citation.`,
    `Return ONLY JSON with this exact shape:`,
    `{`,
    `  "content": "the full lesson body as markdown, with headings for explanation, source-grounded notes, common mistakes, and a worked scenario",`,
    `  "summary": "1-2 sentence summary",`,
    `  "flashcards": [{ "front": "...", "back": "..." }],`,
    `  "practicePrompt": "a concrete practice task specific to this lesson",`,
    `  "applyPrompt": "how to apply this lesson to a real, active task",`,
    `  "reviewSummary": "what to recall before moving on",`,
    `  "citations": [{ "sourceLabel": "exact source name used above", "note": "what claim it supports" }]`,
    `}`,
  ]
    .filter(Boolean)
    .join("\n");

  const parsed = await askModelForJson({
    prompt,
    systemPrompt:
      "You are Zed's Cognitive Core writing one lesson of a course, grounded strictly in the retrieved material provided. Output only the JSON object requested.",
    failureContext: "Lesson generation",
  });

  const labelToId = new Map(sources.map((source) => [source.label, source.id]));
  const citations: LessonCitation[] = (Array.isArray(parsed.citations) ? parsed.citations : [])
    .map((c: any) => {
      const sourceLabel = String(c?.sourceLabel || "").trim();
      return {
        sourceId: labelToId.get(sourceLabel) || "",
        sourceLabel,
        note: String(c?.note || "").trim(),
      };
    })
    .filter((c: LessonCitation) => c.sourceLabel)
    .slice(0, 8);

  const content = String(parsed.content || "").trim();
  if (!content) {
    throw new Error("Lesson generation failed because the AI host returned an empty lesson body.");
  }

  return {
    id: lessonBlueprint.id,
    userId,
    pathId: path.id,
    unitId: unit.id,
    title: lessonBlueprint.title,
    objective: lessonBlueprint.objective,
    order,
    summary: String(parsed.summary || "").trim() || lessonBlueprint.objective,
    content,
    concepts,
    sourceIds: Array.from(new Set(citations.map((c) => c.sourceId).filter(Boolean))),
    citations,
    modes: ["learn", "discuss", "recall", "check", "practice", "apply", "review"],
    flashcards: (Array.isArray(parsed.flashcards) ? parsed.flashcards : [])
      .slice(0, 6)
      .map((card: any) => ({
        id: makeId("card"),
        front: String(card?.front || "").trim(),
        back: String(card?.back || "").trim(),
      }))
      .filter((card) => card.front && card.back),
    practicePrompt: String(parsed.practicePrompt || "").trim() || lessonBlueprint.practice,
    applyPrompt:
      String(parsed.applyPrompt || "").trim() ||
      `Apply this lesson to one real Zed context: ${path.projectId ? "the selected project" : path.workspaceId ? `${WORKSPACE_LABEL[path.workspaceId] || path.workspaceId} workspace` : "an active project or decision"}.`,
    reviewSummary: String(parsed.reviewSummary || "").trim() || lessonBlueprint.verification,
    createdAt,
    updatedAt: createdAt,
  };
}

async function generateAssessment(
  userId: string,
  path: LearningPath,
  lesson: LearningLesson,
): Promise<LearningAssessment> {
  const createdAt = now();
  const prompt = [
    `Lesson: "${lesson.title}"`,
    `Objective: ${lesson.objective}`,
    `Concepts: ${lesson.concepts.join(", ")}`,
    `\n## Lesson content\n${excerpt(lesson.content, 6000)}`,
    `\nWrite a 5-question multiple-choice assessment that tests real understanding of THIS lesson's content — not generic recall. Each question must be derived from a specific claim, application, or common misconception in the lesson content above. Vary the question style across: a direct claim check, a scenario/decision question, a misconception trap, an application question, and a comparison/contrast question. Distractors must be plausible wrong answers specific to this material, not reused boilerplate.`,
    `Return ONLY a JSON array of exactly 5 objects with this shape:`,
    `[{ "prompt": "...", "choices": ["...", "...", "...", "..."], "answerIndex": 0, "explanation": "why the correct choice is right and grounded in the lesson", "concept": "the concept this tests" }]`,
  ].join("\n");

  const parsed = await askModelForJson({
    prompt,
    systemPrompt:
      "You are a strict examiner writing an assessment strictly from the given lesson content. Output only the JSON array requested.",
    failureContext: "Assessment generation",
  });

  const questions: QuizQuestion[] = (Array.isArray(parsed) ? parsed : [])
    .map((q: any) => {
      const choices = toStringArray(q?.choices, 6);
      const answerIndex = Number(q?.answerIndex);
      if (choices.length < 2 || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= choices.length) {
        return null;
      }
      return {
        id: makeId("question"),
        prompt: String(q?.prompt || "").trim(),
        choices,
        answerIndex,
        explanation: String(q?.explanation || "").trim(),
        concept: String(q?.concept || lesson.concepts[0] || "").trim(),
      };
    })
    .filter((q): q is QuizQuestion => Boolean(q && q.prompt));

  if (questions.length === 0) {
    throw new Error("Assessment generation failed because the AI host did not return usable questions.");
  }

  return {
    id: `assessment_${lesson.id}`,
    userId,
    pathId: path.id,
    lessonId: lesson.id,
    type: "quiz",
    passThreshold: 80,
    questions,
    createdAt,
    updatedAt: createdAt,
  };
}

export class LearningStudioService {
  static async createBlueprint(input: CreateLearningBlueprintInput): Promise<LearningPathDetail> {
    const topic = cleanTopic(input.topic);
    if (!topic) throw new Error("Topic is required.");
    const createdAt = now();
    const pathId = makeId("path");
    const notes = input.notes?.trim() || "";

    const sourceInputs: SourceInput[] = [
      { kind: "topic", label: "Topic", content: topic },
      ...(notes ? [{ kind: "note" as const, label: "User notes", content: notes }] : []),
      ...(input.sources || []),
    ];

    const workspaceMemory = input.workspaceId
      ? await buildWorkspaceMemoryContext(input.workspaceId, `${topic} ${notes}`, input.userId, input.isAdmin).catch(
          () => ({ prompt: "", count: 0, used: false }),
        )
      : { prompt: "", count: 0, used: false };
    if (input.workspaceId) {
      sourceInputs.push({
        kind: "workspace",
        label: `${WORKSPACE_LABEL[input.workspaceId] || input.workspaceId} workspace`,
        content: workspaceMemory.used
          ? workspaceMemory.prompt
          : `No workspace memory has been taught yet for ${WORKSPACE_LABEL[input.workspaceId] || input.workspaceId}.`,
        metadata: { workspaceId: input.workspaceId },
      });
    }

    let projectPrompt = "";
    if (input.projectId) {
      const project = await getProject(input.userId, input.projectId);
      if (project) {
        const content =
          [
            project.instructions ? `Instructions: ${project.instructions}` : "",
            ...(project.sources || []).map((source) =>
              [source.label, source.text, source.notes, source.url].filter(Boolean).join("\n"),
            ),
          ]
            .filter(Boolean)
            .join("\n\n") || `Project context for ${project.name}.`;
        sourceInputs.push({
          kind: "project",
          label: `Project: ${project.name}`,
          content,
          metadata: { projectId: project.id },
        });
        projectPrompt = `## Project context — ${project.name}\n${excerpt(content, 2000)}`;
      }
    }

    const sources: CourseSource[] = [];
    for (const source of sourceInputs) {
      const id = makeId("source");
      const content = excerpt(source.content, STORED_SOURCE_CHARS);
      const ingestion =
        source.kind === "topic" ? undefined : await ingestSource(input.userId, pathId, source.label.slice(0, 100), content);
      sources.push({
        id,
        userId: input.userId,
        pathId,
        kind: source.kind,
        label: source.label.slice(0, 100),
        content,
        sourceUri: source.sourceUri,
        metadata: source.metadata,
        ingestion,
        createdAt,
      });
    }

    const grounding = await retrieveGrounding(`${topic} ${notes}`.trim(), 10);
    const rawExcerpts = rawSourceExcerpts(sources, 1200, 6);
    const assumedLevel = input.assumedLevel || "Beginner with some Zed context";

    const generated = await generateBlueprintFromModel({
      topic,
      assumedLevel,
      notes,
      groundingBlock: grounding.block,
      rawExcerpts,
      workspacePrompt: workspaceMemory.used ? workspaceMemory.prompt : "",
      projectPrompt,
    });

    const generatedAt = now();
    const blueprint: LearningBlueprint = {
      pathId,
      objective: generated.objective,
      assumedLevel: generated.assumedLevel,
      estimatedDepth: generated.estimatedDepth,
      units: generated.units.map((unit) => ({
        id: makeId("unit"),
        title: unit.title,
        objective: unit.objective,
        lessons: unit.lessons.map((lesson) => ({ id: makeId("lesson"), ...lesson })),
      })),
      practiceActivities: generated.practiceActivities,
      completionCriteria: generated.completionCriteria,
      gaps: generated.gaps,
      revisions: [],
      approved: false,
      generatedAt,
      updatedAt: generatedAt,
    };

    const path: LearningPath = {
      id: pathId,
      userId: input.userId,
      title: titleCase(topic),
      topic,
      objective: blueprint.objective,
      assumedLevel: blueprint.assumedLevel,
      estimatedDepth: blueprint.estimatedDepth,
      status: "blueprint",
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      sourceIds: sources.map((source) => source.id),
      createdAt,
      updatedAt: createdAt,
    };

    await LearningStore.writeObjects(input.userId, [
      { type: "learning_path", object: path },
      { type: "learning_blueprint", object: blueprint },
      ...sources.map((source) => ({ type: "course_source" as const, object: source })),
    ]);

    const detail = await LearningStore.getPathDetail(input.userId, pathId);
    if (!detail) throw new Error("Learning path was not saved.");
    return detail;
  }

  static async listPaths(userId: string): Promise<LearningPath[]> {
    return LearningStore.listPaths(userId);
  }

  static async getPath(userId: string, pathId: string): Promise<LearningPathDetail | null> {
    return LearningStore.getPathDetail(userId, pathId);
  }

  /** Conversational blueprint revision: "add a unit about X", "make this
   *  less beginner-oriented", etc. Preserves everything not implicated by
   *  the request and records the change in blueprint.revisions. */
  static async reviseBlueprint(userId: string, pathId: string, instruction: string): Promise<LearningPathDetail> {
    const trimmedInstruction = instruction?.trim();
    if (!trimmedInstruction) throw new Error("A revision instruction is required.");
    const detail = await LearningStore.getPathDetail(userId, pathId);
    if (!detail?.blueprint) throw new Error("Learning blueprint not found.");
    if (detail.path.status !== "blueprint") {
      throw new Error("Only an unapproved blueprint can be revised through chat.");
    }
    const current = detail.blueprint;

    const knownIds = new Set<string>();
    for (const unit of current.units) {
      knownIds.add(unit.id);
      for (const lesson of unit.lessons) knownIds.add(lesson.id);
    }

    const prompt = [
      `Current course blueprint (JSON):`,
      JSON.stringify(
        {
          objective: current.objective,
          assumedLevel: current.assumedLevel,
          estimatedDepth: current.estimatedDepth,
          units: current.units,
          practiceActivities: current.practiceActivities,
          completionCriteria: current.completionCriteria,
          gaps: current.gaps,
        },
        null,
        2,
      ),
      `\nRequested change: "${trimmedInstruction}"`,
      `\nApply ONLY this change. Keep every unit, lesson, id, title, and objective not implicated by the request byte-for-byte identical — echo back existing "id" fields exactly for anything you keep or modify, and omit "id" only for genuinely new units/lessons.`,
      `Return ONLY JSON with this exact shape:`,
      `{`,
      `  "changeSummary": "one sentence describing what changed",`,
      `  "blueprint": { "objective": "...", "assumedLevel": "...", "estimatedDepth": "...", "units": [ { "id": "existing id or omit if new", "title": "...", "objective": "...", "lessons": [ { "id": "existing id or omit if new", "title": "...", "objective": "...", "keyConcepts": ["..."], "practice": "...", "verification": "..." } ] } ], "practiceActivities": ["..."], "completionCriteria": ["..."], "gaps": ["..."] }`,
      `}`,
    ].join("\n");

    const parsed = await askModelForJson({
      prompt,
      systemPrompt:
        "You are Zed's Cognitive Core revising a course blueprint per a specific user request. Preserve unaffected content exactly. Output only the JSON object requested.",
      failureContext: "Blueprint revision",
    });

    const revisedRaw = parsed.blueprint;
    const parsedUnits = Array.isArray(revisedRaw?.units) ? revisedRaw.units : [];
    if (parsedUnits.length === 0) {
      throw new Error("Blueprint revision failed because the AI host did not return any units.");
    }

    const updatedAt = now();
    const revision: BlueprintRevision = {
      id: makeId("revision"),
      instruction: trimmedInstruction,
      summary: String(parsed.changeSummary || "").trim() || "Blueprint revised.",
      createdAt: updatedAt,
    };

    const blueprint: LearningBlueprint = {
      pathId,
      objective: String(revisedRaw.objective || current.objective).trim(),
      assumedLevel: String(revisedRaw.assumedLevel || current.assumedLevel).trim(),
      estimatedDepth: String(revisedRaw.estimatedDepth || current.estimatedDepth).trim(),
      units: parsedUnits
        .map((unit: any) => ({
          id: unit?.id && knownIds.has(String(unit.id)) ? String(unit.id) : makeId("unit"),
          title: String(unit?.title || "Untitled unit").trim(),
          objective: String(unit?.objective || "").trim(),
          lessons: (Array.isArray(unit?.lessons) ? unit.lessons : []).map((lesson: any) => ({
            id: lesson?.id && knownIds.has(String(lesson.id)) ? String(lesson.id) : makeId("lesson"),
            title: String(lesson?.title || "Untitled lesson").trim(),
            objective: String(lesson?.objective || "").trim(),
            keyConcepts: toStringArray(lesson?.keyConcepts, 6),
            practice: String(lesson?.practice || "").trim(),
            verification: String(lesson?.verification || "").trim(),
          })),
        }))
        .filter((unit: LearningBlueprintUnit) => unit.lessons.length > 0),
      practiceActivities: toStringArray(revisedRaw.practiceActivities, 6),
      completionCriteria: toStringArray(revisedRaw.completionCriteria, 6),
      gaps: toStringArray(revisedRaw.gaps, 10),
      revisions: [...current.revisions, revision],
      approved: false,
      generatedAt: current.generatedAt,
      updatedAt,
    };

    const path: LearningPath = {
      ...detail.path,
      objective: blueprint.objective,
      assumedLevel: blueprint.assumedLevel,
      estimatedDepth: blueprint.estimatedDepth,
      updatedAt,
    };

    await LearningStore.writeObjects(userId, [
      { type: "learning_path", object: path },
      { type: "learning_blueprint", object: blueprint },
    ]);

    const next = await LearningStore.getPathDetail(userId, pathId);
    if (!next) throw new Error("Revised learning path could not be loaded.");
    return next;
  }

  static async approveBlueprint(
    userId: string,
    pathId: string,
    blueprintPatch?: LearningBlueprint,
  ): Promise<LearningPathDetail> {
    const detail = await LearningStore.getPathDetail(userId, pathId);
    if (!detail?.blueprint) throw new Error("Learning blueprint not found.");
    const updatedAt = now();
    const blueprint: LearningBlueprint = {
      ...(blueprintPatch || detail.blueprint),
      pathId,
      approved: true,
      updatedAt,
    };
    const firstUnit = blueprint.units[0];
    const firstBlueprintLesson = firstUnit?.lessons?.[0];
    if (!firstUnit || !firstBlueprintLesson) {
      throw new Error("Blueprint must include at least one unit and lesson.");
    }

    const units: LearningUnit[] = blueprint.units.map((unit, index) => ({
      id: unit.id,
      userId,
      pathId,
      title: unit.title,
      objective: unit.objective,
      order: index + 1,
      lessonIds: unit.lessons.map((lesson) => lesson.id),
      createdAt: detail.units.find((existing) => existing.id === unit.id)?.createdAt || updatedAt,
      updatedAt,
    }));

    const path: LearningPath = {
      ...detail.path,
      objective: blueprint.objective,
      assumedLevel: blueprint.assumedLevel,
      estimatedDepth: blueprint.estimatedDepth,
      status: "active",
      activeUnitId: firstUnit.id,
      activeLessonId: firstBlueprintLesson.id,
      approvedAt: detail.path.approvedAt || updatedAt,
      updatedAt,
    };

    const existingLesson = detail.lessons.find((lesson) => lesson.id === firstBlueprintLesson.id);
    const lesson =
      existingLesson ||
      (await generateLesson(userId, path, firstUnit, firstBlueprintLesson, 1, detail.sources));
    const existingAssessment = detail.assessments.find((assessment) => assessment.lessonId === lesson.id);
    const assessment = existingAssessment || (await generateAssessment(userId, path, lesson));

    await LearningStore.writeObjects(userId, [
      { type: "learning_path", object: path },
      { type: "learning_blueprint", object: blueprint },
      ...units.map((unit) => ({ type: "unit" as const, object: unit })),
      { type: "lesson", object: lesson },
      { type: "assessment", object: assessment },
    ]);

    const next = await LearningStore.getPathDetail(userId, pathId);
    if (!next) throw new Error("Approved learning path could not be loaded.");
    return next;
  }

  /** Advance to the next lesson in blueprint order once the current one is
   *  passed. Generates the lesson + assessment on first visit (lazy), same
   *  pattern as approval, but positioned correctly via the blueprint's real
   *  unit/lesson order instead of a hardcoded value. */
  static async advanceLesson(userId: string, pathId: string): Promise<LearningPathDetail> {
    const detail = await LearningStore.getPathDetail(userId, pathId);
    if (!detail?.blueprint) throw new Error("Learning path not found.");
    const currentLessonId = detail.path.activeLessonId;
    if (!currentLessonId) throw new Error("No active lesson to advance from.");

    const currentAssessment = detail.assessments.find((a) => a.lessonId === currentLessonId);
    const passed = currentAssessment
      ? detail.attempts.some((attempt) => attempt.assessmentId === currentAssessment.id && attempt.passed)
      : false;
    if (!passed) {
      throw new Error("Pass the current lesson's assessment before continuing.");
    }

    const flat = flattenedLessonList(detail.blueprint);
    const currentIndex = flat.findIndex(({ lesson }) => lesson.id === currentLessonId);
    if (currentIndex < 0 || currentIndex + 1 >= flat.length) {
      const updatedAt = now();
      const path: LearningPath = { ...detail.path, status: "completed", completedAt: updatedAt, updatedAt };
      await LearningStore.writeObjects(userId, [{ type: "learning_path", object: path }]);
      const finished = await LearningStore.getPathDetail(userId, pathId);
      if (!finished) throw new Error("Learning path could not be reloaded.");
      return finished;
    }

    const { unit: nextUnit, lesson: nextLessonBlueprint } = flat[currentIndex + 1];
    const order = currentIndex + 2;
    const updatedAt = now();

    const existingLesson = detail.lessons.find((lesson) => lesson.id === nextLessonBlueprint.id);
    const lesson =
      existingLesson ||
      (await generateLesson(userId, detail.path, nextUnit, nextLessonBlueprint, order, detail.sources));
    const existingAssessment = detail.assessments.find((a) => a.lessonId === lesson.id);
    const assessment = existingAssessment || (await generateAssessment(userId, detail.path, lesson));

    const path: LearningPath = {
      ...detail.path,
      activeUnitId: nextUnit.id,
      activeLessonId: lesson.id,
      updatedAt,
    };

    await LearningStore.writeObjects(userId, [
      { type: "learning_path", object: path },
      { type: "lesson", object: lesson },
      { type: "assessment", object: assessment },
    ]);

    const next = await LearningStore.getPathDetail(userId, pathId);
    if (!next) throw new Error("Learning path could not be reloaded.");
    return next;
  }

  static async submitAssessment(
    userId: string,
    pathId: string,
    lessonId: string,
    selectedAnswers: number[],
  ): Promise<{ attempt: AssessmentAttempt; mastery: MasteryRecord[]; detail: LearningPathDetail }> {
    const detail = await LearningStore.getPathDetail(userId, pathId);
    if (!detail) throw new Error("Learning path not found.");
    const assessment = detail.assessments.find((item) => item.lessonId === lessonId);
    if (!assessment) throw new Error("Assessment not found.");
    const createdAt = now();
    const answers: AssessmentAttemptAnswer[] = assessment.questions.map((question, index) => {
      const selectedIndex = Number(selectedAnswers[index]);
      return {
        questionId: question.id,
        selectedIndex: Number.isFinite(selectedIndex) ? selectedIndex : -1,
        correct: selectedIndex === question.answerIndex,
      };
    });
    const correct = answers.filter((answer) => answer.correct).length;
    const score = assessment.questions.length
      ? Math.round((correct / assessment.questions.length) * 100)
      : 0;
    const passed = score >= assessment.passThreshold;
    const attempt: AssessmentAttempt = {
      id: makeId("attempt"),
      userId,
      pathId,
      lessonId,
      assessmentId: assessment.id,
      answers,
      score,
      passed,
      feedback: passed
        ? `Passed at ${score}%. Mastery moved forward for this lesson.`
        : `Scored ${score}%. Review the missed concepts before continuing.`,
      createdAt,
    };

    const masteryRecords: MasteryRecord[] = assessment.questions.map((question) => {
      const answer = answers.find((item) => item.questionId === question.id);
      const strength = answer?.correct ? (passed ? 0.86 : 0.68) : 0.35;
      const safeConcept = question.concept.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      return {
        id: `mastery_${pathId}_${lessonId}_${safeConcept || question.id}`,
        userId,
        pathId,
        lessonId,
        concept: question.concept,
        status: answer?.correct ? (passed ? "mastered" : "practicing") : "needs_review",
        strength,
        evidence: answer?.correct
          ? `Answered quiz item correctly on attempt ${attempt.id}.`
          : `Missed quiz item on attempt ${attempt.id}.`,
        updatedAt: createdAt,
      };
    });

    await LearningStore.writeObjects(userId, [
      { type: "attempt", object: attempt },
      ...masteryRecords.map((record) => ({ type: "mastery_record" as const, object: record })),
      {
        type: "learning_path",
        object: {
          ...detail.path,
          status: passed ? "active" : detail.path.status,
          updatedAt: createdAt,
        },
      },
    ]);

    const nextDetail = await LearningStore.getPathDetail(userId, pathId);
    if (!nextDetail) throw new Error("Learning path could not be reloaded.");
    return { attempt, mastery: masteryRecords, detail: nextDetail };
  }
}

export default LearningStudioService;
