export type LearningPathStatus = "blueprint" | "approved" | "active" | "completed" | "archived";

export type LearningSourceKind = "topic" | "note" | "file" | "workspace" | "project";

export type LearningMode =
  | "learn"
  | "discuss"
  | "recall"
  | "check"
  | "practice"
  | "apply"
  | "review";

export type MasteryStatus = "introduced" | "practicing" | "mastered" | "needs_review";

export interface CourseSourceIngestion {
  ingested: boolean;
  topics: string[];
  objectIds: string[];
  conflictCount: number;
  skippedReason?: string;
}

export interface CourseSource {
  id: string;
  userId: string;
  pathId: string;
  kind: LearningSourceKind;
  label: string;
  content: string;
  sourceUri?: string;
  metadata?: Record<string, unknown>;
  ingestion?: CourseSourceIngestion;
  createdAt: string;
}

export interface LearningBlueprintLesson {
  id: string;
  title: string;
  objective: string;
  keyConcepts: string[];
  practice: string;
  verification: string;
}

export interface LearningBlueprintUnit {
  id: string;
  title: string;
  objective: string;
  lessons: LearningBlueprintLesson[];
}

export interface BlueprintRevision {
  id: string;
  instruction: string;
  summary: string;
  createdAt: string;
}

export interface LearningBlueprint {
  pathId: string;
  objective: string;
  assumedLevel: string;
  estimatedDepth: string;
  units: LearningBlueprintUnit[];
  practiceActivities: string[];
  completionCriteria: string[];
  /** Gaps or missing information Zed found in the source material while designing the course. */
  gaps: string[];
  revisions: BlueprintRevision[];
  approved: boolean;
  generatedAt: string;
  updatedAt: string;
}

export interface LearningPath {
  id: string;
  userId: string;
  title: string;
  topic: string;
  objective: string;
  assumedLevel: string;
  estimatedDepth: string;
  status: LearningPathStatus;
  workspaceId?: string;
  projectId?: string;
  sourceIds: string[];
  activeUnitId?: string;
  activeLessonId?: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  completedAt?: string;
}

export interface LearningUnit {
  id: string;
  userId: string;
  pathId: string;
  title: string;
  objective: string;
  order: number;
  lessonIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
  concept: string;
}

export interface LessonCitation {
  sourceId: string;
  sourceLabel: string;
  note: string;
}

export interface LearningLesson {
  id: string;
  userId: string;
  pathId: string;
  unitId: string;
  title: string;
  objective: string;
  order: number;
  summary: string;
  content: string;
  concepts: string[];
  sourceIds: string[];
  citations: LessonCitation[];
  modes: LearningMode[];
  flashcards: Flashcard[];
  practicePrompt: string;
  applyPrompt: string;
  reviewSummary: string;
  createdAt: string;
  updatedAt: string;
}

export interface LearningAssessment {
  id: string;
  userId: string;
  pathId: string;
  lessonId: string;
  type: "quiz";
  passThreshold: number;
  questions: QuizQuestion[];
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentAttemptAnswer {
  questionId: string;
  selectedIndex: number;
  correct: boolean;
}

export interface AssessmentAttempt {
  id: string;
  userId: string;
  pathId: string;
  lessonId: string;
  assessmentId: string;
  answers: AssessmentAttemptAnswer[];
  score: number;
  passed: boolean;
  feedback: string;
  createdAt: string;
}

export interface MasteryRecord {
  id: string;
  userId: string;
  pathId: string;
  lessonId: string;
  concept: string;
  status: MasteryStatus;
  strength: number;
  evidence: string;
  updatedAt: string;
}

export interface LearningPathDetail {
  path: LearningPath;
  blueprint?: LearningBlueprint;
  sources: CourseSource[];
  units: LearningUnit[];
  lessons: LearningLesson[];
  assessments: LearningAssessment[];
  attempts: AssessmentAttempt[];
  mastery: MasteryRecord[];
}

export type LearningObject =
  | LearningPath
  | LearningBlueprint
  | CourseSource
  | LearningUnit
  | LearningLesson
  | LearningAssessment
  | AssessmentAttempt
  | MasteryRecord;

export type LearningObjectType =
  | "learning_path"
  | "learning_blueprint"
  | "course_source"
  | "unit"
  | "lesson"
  | "assessment"
  | "attempt"
  | "mastery_record";
