import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Compass,
  Layers,
  Lock,
  Radar,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";

import {
  DEFAULT_PROGRESSION,
  TRADING_STAGES,
  type TradingProgression,
  type TradingStageDefinition,
  type TradingStageId,
} from "@shared/trading-progression";
import type { StageAssessmentResult } from "@shared/trading-training-types";

/**
 * Zed's training path — the 7 stages along which ZED becomes a
 * capable trading intelligence. This is not a course the user climbs:
 * the user feeds Zed and makes decisions; Zed learns and is TESTED
 * before it may advance.
 *
 * Every stage is architected from day one. The active stage
 * determines what the workspace focuses on. Zed must pass a stage's
 * test before the next stage unlocks.
 */

const STAGE_ICON: Record<TradingStageId, typeof BookOpen> = {
  learn: BookOpen,
  strategy: Layers,
  validation: Radar,
  sandbox: Zap,
  evaluation: Target,
  qualification: Compass,
  live: TrendingUp,
};

export default function TradingProgressionBanner({
  onOpenStageTool,
  onProgressionChange,
}: {
  onOpenStageTool?: () => void;
  onProgressionChange?: (progression: TradingProgression) => void;
} = {}) {
  const [progression, setProgression] = useState<TradingProgression>(DEFAULT_PROGRESSION);
  const [expandedId, setExpandedId] = useState<TradingStageId | null>(null);
  const [results, setResults] = useState<Partial<Record<TradingStageId, StageAssessmentResult>>>({});
  const [busyStage, setBusyStage] = useState<TradingStageId | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(
    (next: TradingProgression) => {
      setProgression(next);
      onProgressionChange?.(next);
    },
    [onProgressionChange],
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/trading/progression", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data?.progression) apply(data.progression);
      }
    } catch {
      /* silent */
    }
  }, [apply]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentDef = useMemo(
    () => TRADING_STAGES.find((s) => s.id === progression.currentStage) || TRADING_STAGES[0],
    [progression.currentStage],
  );

  // Expand the current stage by default so its test/actions are visible.
  useEffect(() => {
    setExpandedId((v) => v ?? currentDef.id);
  }, [currentDef.id]);

  const setCurrent = useCallback(
    async (stageId: TradingStageId) => {
      try {
        const res = await fetch(`/api/trading/progression/current/${stageId}`, {
          method: "POST",
          credentials: "include",
        });
        if (res.ok) apply(await res.json());
      } catch {
        /* silent */
      }
    },
    [apply],
  );

  const runTest = useCallback(
    async (stageId: TradingStageId) => {
      setBusyStage(stageId);
      setError(null);
      setNotice(null);
      try {
        const res = await fetch(`/api/trading/progression/assess/${stageId}`, {
          method: "POST",
          credentials: "include",
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        const result: StageAssessmentResult = body.assessment;
        setResults((r) => ({ ...r, [stageId]: result }));
        // Reflect the recorded pass/fail so the advance button gates correctly.
        apply({
          ...progression,
          assessments: {
            ...(progression.assessments || {}),
            [stageId]: { score: result.score, passed: result.passed, assessedAt: result.assessedAt },
          },
        });
        setNotice(result.passed ? "Zed passed. You can advance." : "Zed isn't ready yet.");
      } catch (err: any) {
        setError(err?.message || "Test failed");
      } finally {
        setBusyStage(null);
      }
    },
    [apply, progression],
  );

  const advance = useCallback(
    async (stageId: TradingStageId) => {
      setBusyStage(stageId);
      setError(null);
      try {
        const res = await fetch(`/api/trading/progression/advance/${stageId}`, {
          method: "POST",
          credentials: "include",
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        apply(body.progression);
        setExpandedId(body.progression.currentStage);
        setNotice("Stage unlocked. Zed advanced.");
      } catch (err: any) {
        setError(err?.message || "Cannot advance yet");
      } finally {
        setBusyStage(null);
      }
    },
    [apply],
  );

  const unlockedCount = progression.unlockedStages.length;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5 mb-4">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-400/80 mb-1">
            Zed's training
          </div>
          <div className="text-[16px] font-semibold text-white tracking-[-0.01em]">
            {currentDef.label}
          </div>
          <div className="mt-1 text-[12.5px] text-white/55 max-w-full sm:max-w-[62ch] leading-snug">
            {currentDef.purpose}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] uppercase tracking-[0.08em] text-white/40">Stages unlocked</div>
          <div className="text-[20px] font-semibold text-white tabular-nums leading-none mt-1">
            {unlockedCount}
            <span className="text-white/40 text-[13px]"> / {TRADING_STAGES.length}</span>
          </div>
        </div>
      </div>

      {notice && (
        <div className="mb-3 rounded-lg border border-cyan-400/30 bg-cyan-400/5 px-3 py-2 text-[12px] text-cyan-100">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-3 rounded-lg border border-red-400/30 bg-red-400/5 px-3 py-2 text-[12px] text-red-200">
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        {TRADING_STAGES.map((stage) => (
          <StageRow
            key={stage.id}
            stage={stage}
            progression={progression}
            expanded={expandedId === stage.id}
            result={results[stage.id]}
            busy={busyStage === stage.id}
            onToggle={() => setExpandedId((v) => (v === stage.id ? null : stage.id))}
            onFocus={() => void setCurrent(stage.id)}
            onOpenTool={onOpenStageTool}
            onTest={() => void runTest(stage.id)}
            onAdvance={() => void advance(stage.id)}
          />
        ))}
      </div>
    </section>
  );
}

function StageRow({
  stage,
  progression,
  expanded,
  result,
  busy,
  onToggle,
  onFocus,
  onOpenTool,
  onTest,
  onAdvance,
}: {
  stage: TradingStageDefinition;
  progression: TradingProgression;
  expanded: boolean;
  result?: StageAssessmentResult;
  busy: boolean;
  onToggle: () => void;
  onFocus: () => void;
  onOpenTool?: () => void;
  onTest: () => void;
  onAdvance: () => void;
}) {
  const Icon = STAGE_ICON[stage.id];
  const unlocked = progression.unlockedStages.includes(stage.id);
  const isCurrent = progression.currentStage === stage.id;
  const record = progression.assessments?.[stage.id];
  const done = Boolean(progression.stageProgress[stage.id]?.completedAt);
  const passed = Boolean(result?.passed ?? record?.passed);
  const locked = stage.assessment.kind === "locked";

  return (
    <div
      className={`rounded-lg border transition-colors ${
        isCurrent ? "border-cyan-400/40 bg-cyan-400/[0.06]" : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-3 py-2.5 flex items-center gap-3"
      >
        <div
          className={`shrink-0 w-7 h-7 rounded-full border flex items-center justify-center ${
            done
              ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
              : unlocked
                ? "border-white/15 bg-white/[0.04] text-white/80"
                : "border-white/10 bg-white/[0.02] text-white/30"
          }`}
        >
          {done ? <Check size={13} /> : unlocked ? <Icon size={13} /> : <Lock size={12} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[13.5px] font-medium ${unlocked ? "text-white" : "text-white/50"}`}>
              {stage.order}. {stage.label}
            </span>
            {isCurrent && (
              <span className="text-[9.5px] uppercase tracking-[0.06em] rounded-full bg-cyan-400/15 text-cyan-300 px-2 py-0.5">
                current
              </span>
            )}
            {done && (
              <span className="text-[9.5px] uppercase tracking-[0.06em] rounded-full bg-emerald-400/15 text-emerald-300 px-2 py-0.5">
                done
              </span>
            )}
            {!unlocked && (
              <span className="text-[9.5px] uppercase tracking-[0.06em] rounded-full bg-white/[0.06] text-white/40 px-2 py-0.5">
                locked
              </span>
            )}
          </div>
          {!expanded && (
            <div className={`mt-0.5 text-[12px] leading-snug truncate ${unlocked ? "text-white/50" : "text-white/30"}`}>
              {stage.purpose}
            </div>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-white/[0.06]">
          <Block title="Your move">{stage.yourMove}</Block>
          <Block title="What Zed does">{stage.whatZedDoes}</Block>
          <div className="mt-3">
            <div className="text-[10.5px] uppercase tracking-[0.08em] text-white/50 mb-1.5">Ready when</div>
            <ul className="space-y-1">
              {stage.readyWhen.map((c, i) => (
                <li key={i} className="text-[12.5px] text-white/70 leading-snug flex gap-2">
                  <span className="shrink-0 mt-1 w-1 h-1 rounded-full bg-cyan-400/60" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/20 p-2.5">
            <div className="text-[10.5px] uppercase tracking-[0.08em] text-white/40 mb-1">How Zed is tested</div>
            <p className="text-[11.5px] text-white/60 leading-snug">{stage.assessment.blurb}</p>
          </div>

          {/* Actions — the current stage always hands you the action. */}
          {isCurrent && (
            <div className="mt-3 flex flex-wrap gap-2">
              {onOpenTool && !locked && (
                <button
                  type="button"
                  onClick={onOpenTool}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 text-black font-medium px-3 py-1.5 text-[12.5px] hover:bg-cyan-300 transition-colors active:opacity-80"
                >
                  Open this stage
                  <ArrowRight size={12} />
                </button>
              )}
              <button
                type="button"
                onClick={onTest}
                disabled={busy || locked}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-400/10 text-cyan-100 font-medium px-3 py-1.5 text-[12.5px] hover:bg-cyan-400/20 disabled:opacity-40 transition-colors"
              >
                {busy ? "Testing Zed…" : "Test Zed"}
              </button>
              {passed && stage.nextUnlocks && (
                <button
                  type="button"
                  onClick={onAdvance}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-400 text-black font-medium px-3 py-1.5 text-[12.5px] hover:bg-emerald-300 disabled:opacity-50 transition-colors"
                >
                  Advance
                  <ArrowRight size={12} />
                </button>
              )}
            </div>
          )}

          {locked && (
            <div className="mt-2 text-[11.5px] text-white/40">
              This stage can't be tested until its provider integrations are connected.
            </div>
          )}

          {/* Latest test result */}
          {result && <AssessmentResult result={result} />}
          {!result && record && (
            <div className="mt-2 text-[11.5px] text-white/45">
              Last test: {record.score}/100 — {record.passed ? "passed" : "not passed"}.
            </div>
          )}

          {unlocked && !isCurrent && (
            <button
              type="button"
              onClick={onFocus}
              className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-white/70 hover:text-white transition-colors"
            >
              Focus on this stage
            </button>
          )}
          {!unlocked && (
            <div className="mt-3 text-[11.5px] text-white/40">Zed unlocks this by passing the earlier stages.</div>
          )}
        </div>
      )}
    </div>
  );
}

function AssessmentResult({ result }: { result: StageAssessmentResult }) {
  const [showQuiz, setShowQuiz] = useState(false);
  return (
    <div
      className={`mt-3 rounded-lg border p-3 ${
        result.passed
          ? "border-emerald-400/30 bg-emerald-400/[0.05]"
          : "border-orange-400/30 bg-orange-400/[0.05]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-white">
          Zed scored {result.score}/100
          <span className="text-white/50 font-normal"> · needs {result.threshold}</span>
        </span>
        <span
          className={`text-[10px] uppercase tracking-[0.06em] rounded-full px-2 py-0.5 ${
            result.passed ? "bg-emerald-400/15 text-emerald-300" : "bg-orange-400/15 text-orange-200"
          }`}
        >
          {result.passed ? "passed" : "not ready"}
        </span>
      </div>
      <p className="mt-1.5 text-[12px] text-white/70 leading-snug">{result.summary}</p>

      {result.breakdown.length > 0 && (
        <div className="mt-2 space-y-1">
          {result.breakdown.map((b, i) => (
            <div key={i} className="text-[11.5px] text-white/60 flex justify-between gap-2">
              <span>{b.label}: {b.detail}</span>
              {b.max > 0 && <span className="tabular-nums text-white/45 shrink-0">{b.points}/{b.max}</span>}
            </div>
          ))}
        </div>
      )}

      {result.quiz.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowQuiz((v) => !v)}
            className="text-[11.5px] text-cyan-300 hover:text-cyan-200"
          >
            {showQuiz ? "Hide" : "Show"} what Zed answered ({result.quiz.length})
          </button>
          {showQuiz && (
            <div className="mt-2 space-y-2">
              {result.quiz.map((q, i) => (
                <div key={i} className="rounded-md border border-white/[0.06] bg-black/20 p-2">
                  <div className="text-[11.5px] text-white/70">Q: {q.question}</div>
                  <div className="mt-1 text-[11.5px] text-white/55">A: {q.answer}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`text-[9.5px] uppercase tracking-[0.06em] rounded-full px-1.5 py-0.5 ${
                        q.verdict === "correct"
                          ? "bg-emerald-400/15 text-emerald-300"
                          : q.verdict === "partial"
                            ? "bg-yellow-400/15 text-yellow-200"
                            : "bg-red-400/15 text-red-300"
                      }`}
                    >
                      {q.verdict}
                    </span>
                    {q.note && <span className="text-[10.5px] text-white/45">{q.note}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="text-[10.5px] uppercase tracking-[0.08em] text-white/50 mb-1">{title}</div>
      <p className="text-[12.5px] text-white/70 leading-snug">{children}</p>
    </div>
  );
}
