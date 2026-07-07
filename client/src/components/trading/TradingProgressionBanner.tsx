import { useCallback, useEffect, useMemo, useState } from "react";
import {
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

/**
 * Full 7-stage progression banner shown at the top of /trading.
 *
 * Every stage is architected from day one. The user's currently
 * ACTIVE stage determines what the workspace focuses on; locked
 * stages remain visible so the user always sees the full path
 * ahead. Real capability under each stage is added incrementally
 * (Sandbox first — that maps to the existing paper-trading flow).
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

export default function TradingProgressionBanner() {
  const [progression, setProgression] = useState<TradingProgression>(DEFAULT_PROGRESSION);
  const [expandedId, setExpandedId] = useState<TradingStageId | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/trading/progression", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data?.progression) setProgression(data.progression);
      }
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const currentDef = useMemo(
    () => TRADING_STAGES.find((s) => s.id === progression.currentStage) || TRADING_STAGES[0],
    [progression.currentStage],
  );

  const setCurrent = useCallback(
    async (stageId: TradingStageId) => {
      try {
        const res = await fetch(`/api/trading/progression/current/${stageId}`, {
          method: "POST",
          credentials: "include",
        });
        if (res.ok) setProgression(await res.json());
      } catch {
        /* silent */
      }
    },
    [],
  );

  const unlockedCount = progression.unlockedStages.length;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 md:p-5 mb-4">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-cyan-400/80 mb-1">
            Your progression
          </div>
          <div className="text-[16px] font-semibold text-white tracking-[-0.01em]">
            {currentDef.label}
          </div>
          <div className="mt-1 text-[12.5px] text-white/55 max-w-full sm:max-w-[62ch] leading-snug">
            {currentDef.purpose}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[10px] uppercase tracking-[0.08em] text-white/40">Unlocked</div>
          <div className="text-[20px] font-semibold text-white tabular-nums leading-none mt-1">
            {unlockedCount}
            <span className="text-white/40 text-[13px]"> / {TRADING_STAGES.length}</span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        {TRADING_STAGES.map((stage) => (
          <StageRow
            key={stage.id}
            stage={stage}
            progression={progression}
            expanded={expandedId === stage.id}
            onToggle={() => setExpandedId((v) => (v === stage.id ? null : stage.id))}
            onFocus={() => void setCurrent(stage.id)}
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
  onToggle,
  onFocus,
}: {
  stage: TradingStageDefinition;
  progression: TradingProgression;
  expanded: boolean;
  onToggle: () => void;
  onFocus: () => void;
}) {
  const Icon = STAGE_ICON[stage.id];
  const unlocked = progression.unlockedStages.includes(stage.id);
  const isCurrent = progression.currentStage === stage.id;
  const done = Boolean(progression.stageProgress[stage.id]?.completedAt);

  return (
    <div
      className={`rounded-lg border transition-colors ${
        isCurrent
          ? "border-cyan-400/40 bg-cyan-400/[0.06]"
          : "border-white/10 bg-white/[0.02]"
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
            <span
              className={`text-[13.5px] font-medium ${
                unlocked ? "text-white" : "text-white/50"
              }`}
            >
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
            <div
              className={`mt-0.5 text-[12px] leading-snug truncate ${
                unlocked ? "text-white/50" : "text-white/30"
              }`}
            >
              {stage.purpose}
            </div>
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-white/[0.06]">
          <Block title="What you do">{stage.whatYouDo}</Block>
          <Block title="What Zed does">{stage.whatZedDoes}</Block>
          <div className="mt-3">
            <div className="text-[10.5px] uppercase tracking-[0.08em] text-white/50 mb-1.5">
              Done when
            </div>
            <ul className="space-y-1">
              {stage.completionCriteria.map((c, i) => (
                <li key={i} className="text-[12.5px] text-white/70 leading-snug flex gap-2">
                  <span className="shrink-0 mt-1 w-1 h-1 rounded-full bg-cyan-400/60" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
          {stage.nextUnlocks && (
            <div className="mt-3 text-[11.5px] text-white/40">
              Completing this unlocks{" "}
              <span className="text-white/60">
                {TRADING_STAGES.find((s) => s.id === stage.nextUnlocks)?.label}
              </span>
              .
            </div>
          )}
          {unlocked && !isCurrent && (
            <button
              type="button"
              onClick={onFocus}
              className="mt-4 rounded-lg bg-cyan-400 text-black font-medium px-3 py-1.5 text-[12.5px] hover:bg-cyan-300 transition-colors active:opacity-80"
            >
              Focus on this stage
            </button>
          )}
          {!unlocked && (
            <div className="mt-4 text-[11.5px] text-white/40">
              Finish the earlier stages first.
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
      <div className="text-[10.5px] uppercase tracking-[0.08em] text-white/50 mb-1">
        {title}
      </div>
      <p className="text-[12.5px] text-white/70 leading-snug">{children}</p>
    </div>
  );
}
