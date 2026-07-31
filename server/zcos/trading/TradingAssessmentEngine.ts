import { generateChatFromProvider } from "../../services/ModelProviderService";
import { buildTradingKnowledgeContext } from "./TradingKnowledgeBase";
import { TradingStore } from "./TradingStore";
import { getExternalPaperReport } from "./ExternalPaperEngine";
import { getEvaluationReport } from "./EvaluationEngine";
import { getQualificationReport } from "./QualificationEngine";
import { getLiveState } from "./LiveTradingEngine";
import { TRADING_KNOWLEDGE_AREAS } from "./TradingCurriculum";
import {
  stageDefinition,
  type TradingStageId,
} from "../../../shared/trading-progression";
import type {
  AssessmentBreakdownItem,
  AssessmentQuizItem,
  KnowledgeAreaAssessment,
  KnowledgeAreaInfo,
  StageAssessmentResult,
} from "../../../shared/trading-training-types";

/** ZAR must score this to pass a single knowledge section. */
const AREA_PASS_THRESHOLD = 70;

/**
 * Tests ZAR before it may advance a stage.
 *
 * Learn stage: scores how much of the required curriculum ZAR has
 * ingested (deterministic) AND quizzes ZAR on that material, grading
 * its answers (LLM). The two combine into one score.
 *
 * Strategy / Validation / Sandbox: deterministic gates on the real
 * artifacts ZAR produced (governance verdicts, paper-trade sample).
 *
 * Locked stages: honestly report that they can't be assessed until
 * their provider integrations are connected — no fabricated pass.
 */

const QUIZ_SIZE = 5;

function now(): string {
  return new Date().toISOString();
}

function describeQuizFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");
  const lower = message.toLowerCase();
  if (lower.includes("lightning_base_url") || lower.includes("lightning_ai_url")) {
    return "AI host is not configured";
  }
  if (lower.includes("timeout") || lower.includes("aborted")) {
    return "AI host timed out";
  }
  if (lower.includes("fetch failed") || lower.includes("econnrefused") || lower.includes("enotfound")) {
    return "AI host is unreachable";
  }
  if (/\b(401|403)\b/.test(message) || lower.includes("unauthorized") || lower.includes("forbidden")) {
    return "AI host rejected the request";
  }
  return "AI host returned an error";
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
          ? "ZAR has no trading knowledge yet — feed it sources first."
          : `ZAR has structured knowledge across ${coveredAreas.length} of ${TRADING_KNOWLEDGE_AREAS.length} required areas.`,
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

      const answerPrompt = `You are ZAR being tested on the trading knowledge you have ingested. Answer each question ONLY from what you actually learned below. If you don't know, say "I have not learned this yet." Keep each answer to 2-3 sentences.\n\n## Your ingested knowledge\n${context}\n\nReturn a JSON array of strings, one answer per question, in order. Questions:\n${questions
        .map((q, i) => `${i + 1}. ${q}`)
        .join("\n")}`;
      const answersRaw = await generateChatFromProvider(
        [{ role: "user", content: answerPrompt }],
        "You answer strictly from the provided knowledge. Output only a JSON array of strings.",
        { lane: "finance" },
      );
      const answers = safeJsonArray(answersRaw, questions.length);

      const gradePrompt = `Grade ZAR's answers about trading concepts. For each, decide "correct", "partial", or "incorrect" and give a one-line note. Base it on trading accuracy, not verbosity. An answer of "I have not learned this yet" is "incorrect".\n\n${questions
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
        detail: `ZAR answered ${questions.length} questions on the material it ingested and scored ${comprehensionScore}.`,
        points: comprehensionScore,
        max: 100,
      });
    } catch (error) {
      console.warn("[TradingAssessment] Learn comprehension quiz failed:", error);
      breakdown.push({
        label: "Comprehension test",
        detail: `The comprehension quiz could not run right now (${describeQuizFailure(error)}) — scored on coverage only.`,
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
    ? `ZAR is ready — it covers ${coveredAreas.length}/${TRADING_KNOWLEDGE_AREAS.length} areas${comprehensionRan ? ` and scored ${comprehensionScore} on the quiz` : ""}. Advance to Build the strategy.`
    : entries.length === 0
      ? "ZAR hasn't learned anything yet. Feed it sources, then test again."
      : `ZAR isn't ready. It covers ${coveredAreas.length}/${TRADING_KNOWLEDGE_AREAS.length} areas${comprehensionRan ? ` and scored ${comprehensionScore} on the quiz` : ""}. Feed more material on the gaps and re-test.`;

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
      ? `ZAR holds ${cleared.length} strategy(ies) its governance review cleared. Advance to Validate.`
      : "No strategy has cleared governance yet. Build one with full rules and let ZAR review it.",
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
      ? "ZAR has produced a passing governance verdict. Advance to Sandbox."
      : "ZAR hasn't produced a passing verdict yet. Submit a strategy for review.",
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
      ? `ZAR has ${closed} closed sandbox trades with positive expectancy. External evaluation is next.`
      : `ZAR has ${closed}/20 closed sandbox trades (expectancy ${expectancy}). Keep logging paper trades.`,
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

function areaById(areaId: string): (typeof TRADING_KNOWLEDGE_AREAS)[number] | undefined {
  return TRADING_KNOWLEDGE_AREAS.find((a) => a.id === areaId);
}

/**
 * Count / detect which ingested entries belong to a single section.
 * An entry belongs to a section when it was tagged with the section id
 * on upload, or when its structured content covers that section.
 */
function entryBelongsToArea(
  entry: { category: string; tags: string[] } & Parameters<typeof haystackForEntry>[0],
  area: (typeof TRADING_KNOWLEDGE_AREAS)[number],
): boolean {
  const tags = (entry.tags || []).map((t) => t.toLowerCase());
  if (tags.includes(area.id) || tags.includes(area.title.toLowerCase())) return true;
  return coverageForArea(area, [{ category: entry.category, text: haystackForEntry(entry) }]);
}

/** List the Learn-stage sections with per-section coverage + entry counts. */
export async function listKnowledgeAreas(): Promise<KnowledgeAreaInfo[]> {
  const entries = await TradingStore.listKnowledge();
  return TRADING_KNOWLEDGE_AREAS.map((area) => {
    const matched = entries.filter((e) => entryBelongsToArea(e as any, area));
    return {
      id: area.id,
      title: area.title,
      requiredTopics: area.requiredTopics,
      entryCount: matched.length,
      covered: matched.length > 0,
    };
  });
}

/**
 * Test ZAR on ONE knowledge section. Scores how much of that section's
 * required topics ZAR has ingested (deterministic) and quizzes ZAR on
 * that section specifically, grading the answers (LLM). The two combine
 * into a single section score. Honest when nothing has been fed yet —
 * no fabricated pass.
 */
export async function assessKnowledgeArea(areaId: string): Promise<KnowledgeAreaAssessment> {
  const area = areaById(areaId);
  if (!area) throw new Error(`Unknown knowledge section: ${areaId}`);

  const entries = await TradingStore.listKnowledge();
  const areaEntries = entries.filter((e) => entryBelongsToArea(e as any, area));

  const haystacks = areaEntries.map((e) => ({ category: e.category, text: haystackForEntry(e as any) }));
  const topics = area.requiredTopics;
  const coveredTopics = topics.filter((topic) => {
    const t = topic.toLowerCase();
    return haystacks.some((h) => h.text.includes(t) || t.split(/[()]/).some((part) => part.trim().length > 3 && h.text.includes(part.trim())));
  });
  const coverageScore = topics.length ? Math.round((coveredTopics.length / topics.length) * 100) : 0;

  const breakdown: AssessmentBreakdownItem[] = [
    {
      label: "Section coverage",
      detail:
        areaEntries.length === 0
          ? `ZAR has no material on ${area.title} yet — feed this section first.`
          : `ZAR has structured knowledge on ${coveredTopics.length} of ${topics.length} required topics for ${area.title}.`,
      points: coverageScore,
      max: 100,
    },
  ];

  const quiz: AssessmentQuizItem[] = [];
  let comprehensionScore = 0;
  let comprehensionRan = false;

  if (areaEntries.length > 0) {
    try {
      const questions = topics
        .slice(0, QUIZ_SIZE)
        .map((topic) => `In your own words, explain ${topic} within ${area.title}, and how you'd use it in a trade decision.`);
      const context = await buildTradingKnowledgeContext(
        `${area.title} ${topics.join(" ")}`,
      ).catch(() => "");

      const answerPrompt = `You are ZAR being tested on the "${area.title}" section of your trading knowledge. Answer each question ONLY from what you actually learned below. If you don't know, say "I have not learned this yet." Keep each answer to 2-3 sentences.\n\n## Your ingested knowledge\n${context}\n\nReturn a JSON array of strings, one answer per question, in order. Questions:\n${questions
        .map((q, i) => `${i + 1}. ${q}`)
        .join("\n")}`;
      const answersRaw = await generateChatFromProvider(
        [{ role: "user", content: answerPrompt }],
        "You answer strictly from the provided knowledge. Output only a JSON array of strings.",
        { lane: "finance" },
      );
      const answers = safeJsonArray(answersRaw, questions.length);

      const gradePrompt = `Grade ZAR's answers about ${area.title}. For each, decide "correct", "partial", or "incorrect" and give a one-line note. Base it on trading accuracy, not verbosity. An answer of "I have not learned this yet" is "incorrect".\n\n${questions
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
        earned += verdict === "correct" ? 1 : verdict === "partial" ? 0.5 : 0;
        quiz.push({
          question,
          answer: answers[i] || "(no answer)",
          verdict,
          note: String(grades[i]?.note || ""),
        });
      });
      comprehensionScore = questions.length ? Math.round((earned / questions.length) * 100) : 0;
      comprehensionRan = true;
      breakdown.push({
        label: "Comprehension test",
        detail: `ZAR answered ${questions.length} question(s) on ${area.title} and scored ${comprehensionScore}.`,
        points: comprehensionScore,
        max: 100,
      });
    } catch (error) {
      console.warn(`[TradingAssessment] ${area.id} comprehension quiz failed:`, error);
      breakdown.push({
        label: "Comprehension test",
        detail: `The comprehension quiz could not run right now (${describeQuizFailure(error)}) — scored on coverage only.`,
        points: 0,
        max: 0,
      });
    }
  }

  const score = comprehensionRan
    ? Math.round(coverageScore * 0.5 + comprehensionScore * 0.5)
    : coverageScore;
  const passed = score >= AREA_PASS_THRESHOLD;

  const summary = areaEntries.length === 0
    ? `ZAR hasn't learned ${area.title} yet. Feed this section, then test again.`
    : passed
      ? `ZAR passed ${area.title} — ${coveredTopics.length}/${topics.length} topics covered${comprehensionRan ? `, quiz ${comprehensionScore}` : ""}.`
      : `ZAR isn't ready on ${area.title}. ${coveredTopics.length}/${topics.length} topics covered${comprehensionRan ? `, quiz ${comprehensionScore}` : ""}. Feed more material on the gaps and re-test.`;

  return {
    areaId: area.id,
    areaTitle: area.title,
    score,
    threshold: AREA_PASS_THRESHOLD,
    passed,
    summary,
    breakdown,
    quiz,
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
    case "external_paper":
      return assessExternalPaper(userId);
    case "evaluation":
      return assessEvaluation(userId);
    case "qualification":
      return assessQualification(userId);
    case "live":
      return assessLive(userId);
    default:
      return lockedResult(stageId);
  }
}

async function assessExternalPaper(userId: string): Promise<StageAssessmentResult> {
  const def = stageDefinition("external_paper");
  const report = await getExternalPaperReport(userId);
  const sampleScore = Math.min(100, Math.round((report.closedTrades / report.requiredTrades) * 100));
  return {
    stageId: "external_paper",
    kind: "data_check",
    score: report.passed ? 100 : report.providerConnected ? sampleScore : 0,
    threshold: def.assessment.passThreshold,
    passed: report.passed,
    summary: report.summary,
    breakdown: [
      {
        label: "Paper provider connected",
        detail: report.providerConnected ? `Connected: ${report.providerLabel}.` : "No paper/demo provider connected.",
        points: report.providerConnected ? 100 : 0,
        max: 100,
      },
      {
        label: "External sample",
        detail: `${report.closedTrades} of ${report.requiredTrades} external paper trades.`,
        points: sampleScore,
        max: 100,
      },
      {
        label: "Edge & compliance",
        detail: `Expectancy ${report.expectancy}, ${report.ruleViolations} rule-violation type(s).`,
        points: report.expectancy > 0 && report.ruleViolations === 0 ? 100 : 0,
        max: 100,
      },
    ],
    quiz: [],
    assessedAt: now(),
  };
}

async function assessEvaluation(userId: string): Promise<StageAssessmentResult> {
  const def = stageDefinition("evaluation");
  const report = await getEvaluationReport(userId);
  const passed = report.status === "passed";
  return {
    stageId: "evaluation",
    kind: "data_check",
    score: passed ? 100 : report.profitTargetProgressPct,
    threshold: def.assessment.passThreshold,
    passed,
    summary: report.summary,
    breakdown: [
      {
        label: "Profit objective",
        detail: `Net +$${report.netProfit} of $${report.config.profitTarget} target.`,
        points: report.profitTargetProgressPct,
        max: 100,
      },
      {
        label: "Trading days",
        detail: `${report.tradingDays} of ${report.config.minTradingDays} required.`,
        points: Math.min(100, Math.round((report.tradingDays / report.config.minTradingDays) * 100)),
        max: 100,
      },
      {
        label: "Rule breaches",
        detail: report.breaches.length ? report.breaches.join(" ") : "No daily-loss or drawdown breaches.",
        points: report.breaches.length ? 0 : 100,
        max: 100,
      },
    ],
    quiz: [],
    assessedAt: now(),
  };
}

async function assessQualification(userId: string): Promise<StageAssessmentResult> {
  const def = stageDefinition("qualification");
  const report = await getQualificationReport(userId);
  return {
    stageId: "qualification",
    kind: "data_check",
    score: report.overallScore,
    threshold: def.assessment.passThreshold,
    passed: report.ready,
    summary: report.summary,
    breakdown: report.scores.map((s) => ({
      label: s.label,
      detail: s.detail,
      points: s.score,
      max: 100,
    })),
    quiz: [],
    assessedAt: now(),
  };
}

async function assessLive(userId: string): Promise<StageAssessmentResult> {
  const def = stageDefinition("live");
  const state = await getLiveState(userId);
  // "Passed" here means the promotion gates are satisfied — qualification
  // passed AND a broker connected. Arming the kill switch is an operational
  // toggle, not part of the promotion gate.
  const passed = state.qualificationPassed && state.brokerConnected;
  return {
    stageId: "live",
    kind: "data_check",
    score: passed ? 100 : state.qualificationPassed ? 50 : 0,
    threshold: def.assessment.passThreshold,
    passed,
    summary: state.summary,
    breakdown: [
      {
        label: "Qualification",
        detail: state.qualificationPassed ? "Qualification passed." : "Qualification not passed yet.",
        points: state.qualificationPassed ? 100 : 0,
        max: 100,
      },
      {
        label: "Broker connection",
        detail: state.brokerConnected ? `Broker connected: ${state.brokerLabel}.` : "No broker connected for order routing.",
        points: state.brokerConnected ? 100 : 0,
        max: 100,
      },
    ],
    quiz: [],
    assessedAt: now(),
  };
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
