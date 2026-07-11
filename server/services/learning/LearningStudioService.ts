import { randomUUID } from "crypto";

import { getProject } from "../ProjectFilingStore";
import { LearningStore } from "./LearningStore";
import type {
  AssessmentAttempt,
  AssessmentAttemptAnswer,
  CourseSource,
  LearningAssessment,
  LearningBlueprint,
  LearningBlueprintLesson,
  LearningBlueprintUnit,
  LearningLesson,
  LearningPath,
  LearningPathDetail,
  LearningUnit,
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

function excerpt(value: string, length = 900): string {
  const text = normalizeSpace(value || "");
  return text.length > length ? `${text.slice(0, length).trim()}...` : text;
}

function sentences(value: string): string[] {
  return normalizeSpace(value)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 24)
    .slice(0, 10);
}

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "before",
  "build",
  "course",
  "from",
  "have",
  "into",
  "learn",
  "lesson",
  "material",
  "more",
  "need",
  "should",
  "source",
  "that",
  "their",
  "there",
  "these",
  "this",
  "through",
  "topic",
  "with",
  "would",
  "your",
]);

function keywords(text: string, limit = 10): string[] {
  const counts = new Map<string, number>();
  for (const match of text.toLowerCase().matchAll(/[a-z][a-z0-9-]{2,}/g)) {
    const token = match[0];
    if (STOP_WORDS.has(token)) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([token]) => token);
}

function conceptLabel(value: string): string {
  return value
    .split(/[-_]/g)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function conceptsFor(topic: string, sourceText: string): string[] {
  const fromText = keywords(`${topic} ${sourceText}`, 12).map(conceptLabel);
  const fallback = [
    "Core Vocabulary",
    "Mental Model",
    "Decision Rules",
    "Common Failure Modes",
    "Applied Practice",
    "Verification",
  ];
  return Array.from(new Set([...fromText, ...fallback])).slice(0, 8);
}

function buildBlueprint(pathId: string, topic: string, assumedLevel: string, sourceText: string): LearningBlueprint {
  const generatedAt = now();
  const concepts = conceptsFor(topic, sourceText);
  const unitTemplates = [
    {
      title: `Foundations of ${titleCase(topic)}`,
      objective: `Build the vocabulary and first mental model needed to reason about ${topic}.`,
    },
    {
      title: `${titleCase(topic)} in Practice`,
      objective: `Turn the core ideas into decisions, examples, and correction patterns.`,
    },
    {
      title: `Apply and Verify ${titleCase(topic)}`,
      objective: `Use ${topic} in a real task and prove what has been mastered.`,
    },
  ];

  const units: LearningBlueprintUnit[] = unitTemplates.map((unit, unitIndex) => {
    const unitConcepts = concepts.slice(unitIndex * 2, unitIndex * 2 + 4);
    const lessons: LearningBlueprintLesson[] = [0, 1].map((lessonOffset) => {
      const concept = unitConcepts[lessonOffset] || concepts[(unitIndex + lessonOffset) % concepts.length];
      return {
        id: makeId("lesson"),
        title:
          lessonOffset === 0
            ? `${concept}: working understanding`
            : `${concept}: mistakes and application`,
        objective:
          lessonOffset === 0
            ? `Explain ${concept.toLowerCase()} clearly and connect it to ${topic}.`
            : `Use ${concept.toLowerCase()} in a realistic ${topic} scenario.`,
        keyConcepts: Array.from(new Set([concept, ...unitConcepts])).slice(0, 4),
        practice: `Answer a scenario question where ${concept.toLowerCase()} changes the decision.`,
        verification: `Pass a short quiz and explain the answer without relying on notes.`,
      };
    });
    return {
      id: makeId("unit"),
      title: unit.title,
      objective: unit.objective,
      lessons,
    };
  });

  return {
    pathId,
    objective: `Understand, practice, and apply ${topic} well enough to use it in Zed work without guessing.`,
    assumedLevel,
    estimatedDepth: "Focused first pass: 3 units, 6 lessons, one complete starter lesson now.",
    units,
    practiceActivities: [
      `Explain ${topic} in plain language from memory.`,
      `Classify examples into correct, risky, and incomplete uses of ${topic}.`,
      `Apply ${topic} to one active Zed project or workspace task.`,
    ],
    completionCriteria: [
      "Complete every lesson check with at least 80%.",
      "Finish one applied task using the learned material.",
      "Resolve all concepts marked needs_review in mastery.",
    ],
    generatedAt,
    updatedAt: generatedAt,
  };
}

function sourceSection(sources: CourseSource[]): string {
  const selected = sources
    .filter((source) => source.content.trim())
    .slice(0, 4)
    .map((source) => `Source: ${source.label}\n${excerpt(source.content, 700)}`);
  return selected.length ? selected.join("\n\n") : "No supporting source text was provided beyond the topic.";
}

function buildLesson(
  userId: string,
  path: LearningPath,
  unit: LearningBlueprintUnit,
  lessonBlueprint: LearningBlueprintLesson,
  sources: CourseSource[],
): LearningLesson {
  const createdAt = now();
  const concepts = lessonBlueprint.keyConcepts.slice(0, 5);
  const sourceText = sourceSection(sources);
  const firstEvidence = sentences(sourceText).slice(0, 3);
  const content = [
    `# ${lessonBlueprint.title}`,
    "",
    `Objective: ${lessonBlueprint.objective}`,
    "",
    "## Core Explanation",
    `${lessonBlueprint.title} is the first working frame for ${path.topic}. Treat it as a practical model: define the terms, connect them to decisions, then test the model against examples.`,
    "",
    "## Source-Grounded Notes",
    ...(firstEvidence.length ? firstEvidence.map((item) => `- ${item}`) : ["- The current source set is thin. Use this lesson as a starting scaffold and attach stronger material when available."]),
    "",
    "## What To Watch For",
    `The common mistake is recognizing the words around ${concepts[0] || path.topic} without knowing what decision changes because of it. When studying, keep asking: what would I do differently now?`,
    "",
    "## Worked Scenario",
    `Imagine Zed needs to use ${path.topic} inside an active workspace. First name the concept, then identify the source evidence, then choose the smallest action that proves understanding.`,
  ].join("\n");

  return {
    id: lessonBlueprint.id,
    userId,
    pathId: path.id,
    unitId: unit.id,
    title: lessonBlueprint.title,
    objective: lessonBlueprint.objective,
    order: 1,
    summary: `${lessonBlueprint.title} introduces ${concepts.slice(0, 3).join(", ")} and turns them into a practical decision model.`,
    content,
    concepts,
    sourceIds: sources.map((source) => source.id),
    modes: ["learn", "discuss", "recall", "check", "practice", "apply", "review"],
    flashcards: concepts.slice(0, 5).map((concept) => ({
      id: makeId("card"),
      front: `What does ${concept} mean in this lesson?`,
      back: `${concept} is part of the working model for ${path.topic}; explain it by naming the decision or action it changes.`,
    })),
    practicePrompt: lessonBlueprint.practice,
    applyPrompt: `Apply this lesson to one real Zed context: ${path.projectId ? "the selected project" : path.workspaceId ? `${WORKSPACE_LABEL[path.workspaceId] || path.workspaceId} workspace` : "an active project or decision"}. Produce the smallest useful artifact that proves the concept.`,
    reviewSummary: `${concepts.slice(0, 3).join(", ")} are the concepts to recall before moving on. Passing the quiz updates mastery.`,
    createdAt,
    updatedAt: createdAt,
  };
}

function buildAssessment(userId: string, path: LearningPath, lesson: LearningLesson): LearningAssessment {
  const createdAt = now();
  const questions: QuizQuestion[] = lesson.concepts.slice(0, 5).map((concept, index) => {
    const correct = `${concept} should be explained by the decision, action, or evidence it changes.`;
    const distractors = [
      `${concept} is complete once the term has been memorized.`,
      `${concept} should be treated as separate from the source material.`,
      `${concept} is only useful after the whole course is finished.`,
    ];
    const answerIndex = index % 4;
    const choices = [...distractors];
    choices.splice(answerIndex, 0, correct);
    return {
      id: makeId("question"),
      prompt: `Which statement best matches ${concept} in this lesson?`,
      choices,
      answerIndex,
      explanation: `The lesson is designed around usable understanding. ${concept} matters when it changes a decision or action.`,
      concept,
    };
  });

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
    const sourceInputs: SourceInput[] = [
      { kind: "topic", label: "Topic", content: topic },
      ...(input.notes?.trim()
        ? [{ kind: "note" as const, label: "User notes", content: input.notes.trim() }]
        : []),
      ...(input.sources || []),
    ];

    if (input.workspaceId) {
      sourceInputs.push({
        kind: "workspace",
        label: `${WORKSPACE_LABEL[input.workspaceId] || input.workspaceId} workspace`,
        content: `The user selected ${WORKSPACE_LABEL[input.workspaceId] || input.workspaceId} as the workspace context for this learning path.`,
        metadata: { workspaceId: input.workspaceId },
      });
    }

    if (input.projectId) {
      const project = await getProject(input.userId, input.projectId);
      if (project) {
        sourceInputs.push({
          kind: "project",
          label: `Project: ${project.name}`,
          content: [
            project.instructions ? `Instructions: ${project.instructions}` : "",
            ...(project.sources || []).map((source) =>
              [source.label, source.text, source.notes, source.url].filter(Boolean).join("\n"),
            ),
          ].filter(Boolean).join("\n\n") || `Project context for ${project.name}.`,
          metadata: { projectId: project.id },
        });
      }
    }

    const sources: CourseSource[] = sourceInputs.map((source) => ({
      id: makeId("source"),
      userId: input.userId,
      pathId,
      kind: source.kind,
      label: source.label.slice(0, 100),
      content: excerpt(source.content, 12_000),
      sourceUri: source.sourceUri,
      metadata: source.metadata,
      createdAt,
    }));
    const sourceText = sources.map((source) => source.content).join("\n\n");
    const assumedLevel = input.assumedLevel || "Beginner with some Zed context";
    const blueprint = buildBlueprint(pathId, topic, assumedLevel, sourceText);
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
    const lesson = existingLesson || buildLesson(userId, path, firstUnit, firstBlueprintLesson, detail.sources);
    const existingAssessment = detail.assessments.find((assessment) => assessment.lessonId === lesson.id);
    const assessment = existingAssessment || buildAssessment(userId, path, lesson);

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
