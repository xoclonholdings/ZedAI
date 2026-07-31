import fs from "fs/promises";
import path from "path";

import { HUB_DIR } from "../utils/repoPaths";
import {
  readTradingState,
  tradingDbAvailable,
  tradingPersistenceRequired,
  writeTradingState,
} from "../zcos/trading/tradingPersistence";
import {
  DEFAULT_PROGRESSION,
  TRADING_STAGES,
  nextStageOf,
  type StageAssessmentRecord,
  type TradingProgression,
  type TradingStageId,
} from "../../shared/trading-progression";

/**
 * Persists the trader's 7-stage progression per user.
 *
 * PostgreSQL is authoritative in production. The JSON file under
 * hub/trading/progression is only a local/offline development fallback.
 *
 * The 7-stage architecture (Learn -> Strategy -> Validation ->
 * Sandbox -> Evaluation -> Qualification -> Live) is fully defined
 * in shared/trading-progression.ts. This store only holds which
 * stages the user has unlocked, where they currently are, and
 * their per-stage progress. Nothing here interprets the stages —
 * that stays in the shared model.
 */

const PROGRESSION_DIR = path.join(HUB_DIR, "trading", "progression");

function fileFor(userId: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(PROGRESSION_DIR, `${safe}.json`);
}

async function ensureDir(): Promise<void> {
  if (tradingPersistenceRequired()) return;
  await fs.mkdir(PROGRESSION_DIR, { recursive: true });
}

function mergeProgression(parsed: TradingProgression): TradingProgression {
  return {
    ...DEFAULT_PROGRESSION,
    ...parsed,
    assessments: { ...(DEFAULT_PROGRESSION.assessments || {}), ...(parsed.assessments || {}) },
  };
}

export async function loadProgression(userId: string): Promise<TradingProgression> {
  // Durable store first. In production/Render, do not fall back to JSON.
  if (tradingDbAvailable() || tradingPersistenceRequired()) {
    const stored = await readTradingState<TradingProgression>("progression", userId);
    if (stored) return mergeProgression(stored);
    if (tradingPersistenceRequired()) {
      return { ...DEFAULT_PROGRESSION, lastUpdated: new Date().toISOString() };
    }
  }
  try {
    const raw = await fs.readFile(fileFor(userId), "utf-8");
    return mergeProgression(JSON.parse(raw) as TradingProgression);
  } catch {
    return { ...DEFAULT_PROGRESSION, lastUpdated: new Date().toISOString() };
  }
}

async function writeProgression(userId: string, progression: TradingProgression): Promise<void> {
  if (tradingDbAvailable() || tradingPersistenceRequired()) {
    const ok = await writeTradingState("progression", userId, progression);
    if (ok) return;
    if (tradingPersistenceRequired()) {
      throw new Error("Unable to persist trading progression to PostgreSQL.");
    }
  }
  await ensureDir();
  await fs.writeFile(fileFor(userId), JSON.stringify(progression, null, 2), "utf-8");
}

export async function updateStageProgress(
  userId: string,
  stageId: TradingStageId,
  update: {
    completionPercent?: number;
    notes?: string;
    markStarted?: boolean;
    markCompleted?: boolean;
  },
): Promise<TradingProgression> {
  const current = await loadProgression(userId);
  const now = new Date().toISOString();
  const stagePrev = current.stageProgress[stageId] || {};
  const stageNext = {
    ...stagePrev,
    ...(update.markStarted && !stagePrev.startedAt ? { startedAt: now } : {}),
    ...(update.markCompleted ? { completedAt: now, completionPercent: 100 } : {}),
    ...(typeof update.completionPercent === "number"
      ? { completionPercent: Math.max(0, Math.min(100, update.completionPercent)) }
      : {}),
    ...(typeof update.notes === "string" ? { notes: update.notes } : {}),
  };

  const next: TradingProgression = {
    ...current,
    stageProgress: { ...current.stageProgress, [stageId]: stageNext },
    lastUpdated: now,
  };

  await writeProgression(userId, next);
  return next;
}

export async function unlockStage(
  userId: string,
  stageId: TradingStageId,
): Promise<TradingProgression> {
  const current = await loadProgression(userId);
  if (current.unlockedStages.includes(stageId)) return current;
  const next: TradingProgression = {
    ...current,
    unlockedStages: [...current.unlockedStages, stageId],
    lastUpdated: new Date().toISOString(),
  };
  await writeProgression(userId, next);
  return next;
}

export async function setCurrentStage(
  userId: string,
  stageId: TradingStageId,
): Promise<TradingProgression> {
  const current = await loadProgression(userId);
  if (!current.unlockedStages.includes(stageId)) {
    throw new Error(`Stage ${stageId} is not yet unlocked for this user.`);
  }
  const next: TradingProgression = {
    ...current,
    currentStage: stageId,
    lastUpdated: new Date().toISOString(),
  };
  await writeProgression(userId, next);
  return next;
}

/** Persist the latest "Test ZAR" result for a stage (the advance gate). */
export async function recordAssessment(
  userId: string,
  stageId: TradingStageId,
  record: StageAssessmentRecord,
): Promise<TradingProgression> {
  const current = await loadProgression(userId);
  const next: TradingProgression = {
    ...current,
    assessments: { ...(current.assessments || {}), [stageId]: record },
    lastUpdated: new Date().toISOString(),
  };
  await writeProgression(userId, next);
  return next;
}

/**
 * Advance out of a stage — only allowed once ZAR has PASSED that
 * stage's assessment. Unlocks and focuses the next stage.
 */
export async function advanceStage(
  userId: string,
  stageId: TradingStageId,
): Promise<{ progression: TradingProgression; unlockedStage: TradingStageId }> {
  const current = await loadProgression(userId);
  const record = current.assessments?.[stageId];
  if (!record?.passed) {
    throw new Error("ZAR has not passed this stage's test yet. Run the test first.");
  }
  const next = nextStageOf(stageId);
  if (!next) {
    throw new Error("This is the final stage — there is nothing to advance to.");
  }

  const now = new Date().toISOString();
  const unlockedStages = current.unlockedStages.includes(next.id)
    ? current.unlockedStages
    : [...current.unlockedStages, next.id];

  const progression: TradingProgression = {
    ...current,
    unlockedStages,
    currentStage: next.id,
    stageProgress: {
      ...current.stageProgress,
      [stageId]: { ...current.stageProgress[stageId], completedAt: now, completionPercent: 100 },
      [next.id]: { ...current.stageProgress[next.id], startedAt: current.stageProgress[next.id]?.startedAt || now },
    },
    lastUpdated: now,
  };
  await writeProgression(userId, progression);
  return { progression, unlockedStage: next.id };
}

export function stageOrder(stageId: TradingStageId): number {
  return TRADING_STAGES.find((s) => s.id === stageId)?.order ?? 0;
}
