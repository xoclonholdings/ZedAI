import { LearningStore } from "./LearningStore";

export interface LearningTutorContextInput {
  userId: string;
  pathId?: string;
  lessonId?: string;
}

export interface LearningTutorContext {
  prompt: string;
  pathId?: string;
  lessonId?: string;
  sourceCount: number;
  masteryCount: number;
}

function short(value: string, limit = 700): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit).trim()}...` : text;
}

export async function buildLearningTutorContext(
  input: LearningTutorContextInput,
): Promise<LearningTutorContext> {
  if (!input.pathId) {
    return { prompt: "", sourceCount: 0, masteryCount: 0 };
  }
  const detail = await LearningStore.getPathDetail(input.userId, input.pathId);
  if (!detail) return { prompt: "", sourceCount: 0, masteryCount: 0 };

  const lesson =
    detail.lessons.find((item) => item.id === input.lessonId) ||
    detail.lessons.find((item) => item.id === detail.path.activeLessonId) ||
    detail.lessons[0];
  const attempts = lesson
    ? detail.attempts.filter((attempt) => attempt.lessonId === lesson.id).slice(0, 3)
    : [];
  const mastery = lesson
    ? detail.mastery.filter((record) => record.lessonId === lesson.id)
    : detail.mastery;

  const sourceLines = detail.sources.slice(0, 4).map((source) => {
    return `- ${source.label} (${source.kind}): ${short(source.content, 420)}`;
  });

  const masteryLines = mastery.slice(0, 8).map((record) => {
    return `- ${record.concept}: ${record.status}, strength ${record.strength}`;
  });

  const attemptLines = attempts.map((attempt) => {
    return `- ${attempt.createdAt}: ${attempt.score}% (${attempt.passed ? "passed" : "needs review"})`;
  });

  const prompt = [
    "## Active Learning Path Context",
    "You are tutoring inside ZAR Learning Studio. Stay course-aware: use the active path, lesson, source material, attempts, and mastery records before giving generic advice.",
    `Path: ${detail.path.title}`,
    `Objective: ${detail.path.objective}`,
    `Assumed level: ${detail.path.assumedLevel}`,
    `Status: ${detail.path.status}`,
    lesson
      ? [
          "",
          "### Active Lesson",
          `Title: ${lesson.title}`,
          `Objective: ${lesson.objective}`,
          `Summary: ${lesson.summary}`,
          `Concepts: ${lesson.concepts.join(", ")}`,
          `Practice: ${lesson.practicePrompt}`,
          `Apply: ${lesson.applyPrompt}`,
        ].join("\n")
      : "",
    sourceLines.length ? `\n### Supporting Sources\n${sourceLines.join("\n")}` : "",
    masteryLines.length ? `\n### Learner Mastery\n${masteryLines.join("\n")}` : "",
    attemptLines.length ? `\n### Recent Attempts\n${attemptLines.join("\n")}` : "",
    "",
    "Tutor behavior: explain the current lesson, ask targeted questions, identify confusion, and suggest the next smallest practice or apply step. Do not claim the user mastered a concept unless mastery records support it.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    prompt,
    pathId: detail.path.id,
    lessonId: lesson?.id,
    sourceCount: detail.sources.length,
    masteryCount: mastery.length,
  };
}
