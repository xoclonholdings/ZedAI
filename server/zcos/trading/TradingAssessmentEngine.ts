import { generateChatFromProvider } from "../../services/ModelProviderService";
import { buildTradingKnowledgeContext } from "./TradingKnowledgeBase";
import { TradingStore } from "./TradingStore";
import { TRADING_KNOWLEDGE_AREAS } from "./TradingCurriculum";
import {
  stageDefinition,
  type TradingStageId,
} from "../../../shared/trading-progression";
import type {
  AssessmentBreakdownItem,
  AssessmentQuizItem,
  StageAssessmentResult,
} from "../../../shared/trading-training-types";

/**
 * Tests ZED before it may advance a stage.
 *
 * Learn stage: scores how much of the required curriculum Zed has
 * ingested (deterministic) AND quizzes Zed on that material, grading
 * its answers (LLM). The two combine into one score.
 *
 * Strategy / Validation / Sandbox: deterministic gates on the real
 * artifacts Zed produced (governance verdicts, paper-trade sample).
 *
 * Locked stages: honestly report that they can't be assessed until
 * their provider integrations are connected — no fabricated pass.
 */

const QUIZ_SIZE = 5;

function now(): string {
  return new Date().toISOString();
}

function haystackForEntry(entry: {
  title: string;
  category: string;
  concepts: string[];
  rules: string[];
  patterns: string[];
  tags: string[];
}): string {
  return [entry.title, entry.category, ...entry.concepts, ...entry.rules, ...entry.patterns, ...entry.tags]
    .join(" ")
    .toLowerCase();
}

function coverageForArea(
  area: (typeof TRADING_KNOWLEDGE_AREAS)[number],
  haystacks: Array<{ category: string; text: string }>,
): boolean {
  const title = area.title.toLowerCase();
  const topics = area.requiredTopics.map((t) => t.toLowerCase());
  return haystacks.some(
    (h) =>
      h.category === area.id ||
      h.text.includes(title) ||
      topics.some((topic) => topic.length > 3 && h.text.includes(topic)),
  );
}

async function assessLearn(userId: string): Promise<StageAssessmentResult> {
  const def = stageDefinition("learn");
  const entries = await TradingStore.listKnowledge();
  const haystacks = entries.map((e) => ({ category: e.category, text: haystackForEntry(e) }));

  const coveredAreas = TRADING_KNOWLEDGE_AREAS.filter((area) => coverageForArea(area, haystacks));
  const coverageRatio = TRADING_KNOWLEDGE_AREAS.length
    ? coveredAreas.length / TRADING_KNOWLEDGE_AREAS.length
    : 0;
  const coverageScore = Math.round(coverageRatio * 100);

  const breakdown: AssessmentBreakdownItem[] = [
    {
      label: "Curriculum coverage",
      detail:
        entries.length === 0
          ? "Zed has no trading knowledge yet — feed it sources first."
          : `Zed has structured knowledge across ${coveredAreas.length} of ${TRADING_KNOWLEDGE_AREAS.length} required areas.`,
      points: coverageScore,
      max: 100,
    },
  ];

  const quiz: AssessmentQuizItem[] = [];
  let comprehensionScore = 0;
  let comprehensionRan = false;

  if (entries.length > 0) {
    try {
      const focusAreas = (coveredAreas.length ? coveredAreas : TRADING_KNOWLEDGE_AREAS).slice(0, QUIZ_SIZE);
      const questions = focusAreas.map(
        (area) => `In your own words, explain ${area.title} and how you'd use it in a trade decision.`,
      );
      const context = await buildTradingKnowledgeContext(
        focusAreas.map((a) => a.title).join(", "),
      ).catch(() => "");

      const answerPrompt = `You are ZED being tested on the trading knowledge you have ingested. Answer each question ONLY from what you actually learned below. If you don't know, say "I have not learned this yet." Keep each answer to 2-3 sentences.\n\n## Your ingested knowledge\n${context}\n\nReturn a JSON array of strings, one answer per question, in order. Questions:\n${questions
        .map((q, i) => `${i + 1}. ${q}`)
        .join("\n")}`;
      const answersRaw = await generateChatFromProvider(
        [{ role: "user", content: answerPrompt }],
        "You answer strictly from the provided knowledge. Output only a JSON array of strings.",
        { lane: "finance" },
      );
      const answers = safeJsonArray(answersRaw, questions.length);

      const gradePrompt = `Grade ZED's answers about trading concepts. For each, decide "correct", "partial", or "incorrect" and give a one-line note. Base it on trading accuracy, not verbosity. An answer of "I have not learned this yet" is "incorrect".\n\n${questions
        .map((q, i) => `Q${i + 1}: ${q}\nA${i + 1}: ${answers[i] || "(no answer)"}`)
        .join("\n\n")}\n\nReturn ONLY a JSON array of objects: [{"verdict":"correct|partial|incorrect","note":"..."}] in order.`;
      const gradesRaw = await generateChatFromProvider(
        [{ role: "user", content: gradePrompt }],
        "You are a strict trading examiner. Output only the JSON array.",
        { lane: "finance" },
      );
      const grades = safeJsonObjectArray(gradesRaw, questions.length);

      let earned = 0;
      questions.forEach((question, i) => {
        const verdict = normalizeVerdict(grades[i]?.verdict);
        const value = verdict === "correct" ? 1 : verdict === "partial" ? 0.5 : 0;
        earned += value;
        quiz.push({
          question,
          answer: answers[i] || "(no answer)",
          verdict,
          note: String(grades[i]?.note || ""),
        });
      });
      comprehensionScore = Math.round((earned / questions.length) * 100);
      comprehensionRan = true;
      breakdown.push({
        label: "Comprehension test",
        detail: `Zed answered ${questions.length} questions on the material it ingested and scored ${comprehensionScore}.`,
        points: comprehensionScore,
        max: 100,
      });
    } catch {
      breakdown.push({
        label: "Comprehension test",
        detail: "The comprehension quiz could not run right now — scored on coverage only.",
        points: 0,
        max: 0,
      });
    }
  }

  const score = comprehensionRan
    ? Math.round(coverageScore * 0.5 + comprehensionScore * 0.5)
    : coverageScore;
  const passed = score >= def.assessment.passThreshold;

  const summary = passed
    ? `Zed is ready — it covers ${coveredAreas.length}/${TRADING_KNOWLEDGE_AREAS.length} areas${comprehensionRan ? ` and scored ${comprehensionScore} on the quiz` : ""}. Advance to Build the strategy.`
    : entries.length === 0
      ? "Zed hasn't learned anything yet. Feed it sources, then test again."
      : `Zed isn't ready. It covers ${coveredAreas.length}/${TRADING_KNOWLEDGE_AREAS.length} areas${comprehensionRan ? ` and scored ${comprehensionScore} on the quiz` : ""}. Feed more material on the gaps and re-test.`;

  return {
    stageId: "learn",
    kind: "knowledge_quiz",
    score,
    threshold: def.assessment.passThreshold,
    passed,
    summary,
    breakdown,
    quiz,
    assessedAt: now(),
  };
}

async function assessStrategy(userId: string): Promise<StageAssessmentResult> {
  const def = stageDefinition("strategy");
  const theses = await TradingStore.listTheses(userId);
  const cleared = theses.filter((t) =>
    ["APPROVED", "AUTHORIZED", "PAPER_TRADE_ONLY"].includes(String(t.governanceDecision)),
  );
  const passed = cleared.length > 0;
  return {
    stageId: "strategy",
    kind: "data_check",
    score: passed ? 100 : 0,
    threshold: def.assessment.passThreshold,
    passed,
    summary: passed
      ? `Zed holds ${cleared.length} strategy(ies) its governance review cleared. Advance to Validate.`
      : "No strategy has cleared governance yet. Build one with full rules and let Zed review it.",
    breakdown: [
      {
        label: "Cleared strategies",
        detail: `${cleared.length} of ${theses.length} strategies carry Approved / Paper Trade Only.`,
        points: passed ? 100 : 0,
        max: 100,
      },
    ],
    quiz: [],
    assessedAt: now(),
  };
}

async function assessValidation(userId: string): Promise<StageAssessmentResult> {
  const def = stageDefinition("validation");
  const decisions = await TradingStore.listGovernanceDecisions(userId);
  const cleared = decisions.filter((d) =>
    ["APPROVED", "AUTHORIZED", "PAPER_TRADE_ONLY"].includes(String(d.decision)),
  );
  const passed = cleared.length > 0;
  return {
    stageId: "validation",
    kind: "data_check",
    score: passed ? 100 : 0,
    threshold: def.assessment.passThreshold,
    passed,
    summary: passed
      ? "Zed has produced a passing governance verdict. Advance to Sandbox."
      : "Zed hasn't produced a passing verdict yet. Submit a strategy for review.",
    breakdown: [
      {
        label: "Governance verdicts",
        detail: `${cleared.length} of ${decisions.length} verdicts are Approved / Paper Trade Only.`,
        points: passed ? 100 : 0,
        max: 100,
      },
    ],
    quiz: [],
    assessedAt: now(),
  };
}

async function assessSandbox(userId: string): Promise<StageAssessmentResult> {
  const def = stageDefinition("sandbox");
  const perf = await TradingStore.getPerformance(userId).catch(() => null);
  const closed = perf?.closedTrades || 0;
  const expectancy = perf?.expectancy || 0;
  const passed = closed >= 20 && expectancy > 0;
  return {
    stageId: "sandbox",
    kind: "data_check",
    score: passed ? 100 : Math.min(99, Math.round((closed / 20) * 100)),
    threshold: def.assessment.passThreshold,
    passed,
    summary: passed
      ? `Zed has ${closed} closed sandbox trades with positive expectancy. External evaluation is next.`
      : `Zed has ${closed}/20 closed sandbox trades (expectancy ${expectancy}). Keep logging paper trades.`,
    breakdown: [
      {
        label: "Sample size",
        detail: `${closed} of 20 closed paper trades.`,
        points: Math.min(100, Math.round((closed / 20) * 100)),
        max: 100,
      },
      {
        label: "Expectancy",
        detail: `Expectancy is ${expectancy} (needs to be positive).`,
        points: expectancy > 0 ? 100 : 0,
        max: 100,
      },
    ],
    quiz: [],
    assessedAt: now(),
  };
}

function lockedResult(stageId: TradingStageId): StageAssessmentResult {
  const def = stageDefinition(stageId);
  return {
    stageId,
    kind: "locked",
    score: 0,
    threshold: def.assessment.passThreshold,
    passed: false,
    summary: def.assessment.blurb,
    breakdown: [
      {
        label: "Locked",
        detail: def.assessment.blurb,
        points: 0,
        max: 100,
      },
    ],
    quiz: [],
    assessedAt: now(),
  };
}

export async function assessStage(userId: string, stageId: TradingStageId): Promise<StageAssessmentResult> {
  switch (stageId) {
    case "learn":
      return assessLearn(userId);
    case "strategy":
      return assessStrategy(userId);
    case "validation":
      return assessValidation(userId);
    case "sandbox":
      return assessSandbox(userId);
    default:
      return lockedResult(stageId);
  }
}

function normalizeVerdict(v: unknown): AssessmentQuizItem["verdict"] {
  const s = String(v || "").toLowerCase();
  if (s.startsWith("correct")) return "correct";
  if (s.startsWith("partial")) return "partial";
  if (s.startsWith("incorrect")) return "incorrect";
  return "unknown";
}

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.search(/[[{]/);
  const end = Math.max(body.lastIndexOf("]"), body.lastIndexOf("}"));
  return start >= 0 && end > start ? body.slice(start, end + 1) : body.trim();
}

function safeJsonArray(raw: string, expected: number): string[] {
  try {
    const parsed = JSON.parse(extractJson(raw));
    if (Array.isArray(parsed)) return parsed.map((v) => String(v));
  } catch {
    /* fall through */
  }
  return Array.from({ length: expected }, () => "");
}

function safeJsonObjectArray(raw: string, expected: number): Array<{ verdict?: string; note?: string }> {
  try {
    const parsed = JSON.parse(extractJson(raw));
    if (Array.isArray(parsed)) return parsed as Array<{ verdict?: string; note?: string }>;
  } catch {
    /* fall through */
  }
  return Array.from({ length: expected }, () => ({ verdict: "unknown", note: "" }));
}
