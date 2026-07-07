import fs from "fs/promises";
import path from "path";

import { HUB_DIR } from "../utils/repoPaths";
import {
  DEFAULT_PROGRESSION,
  type TradingProgression,
  type TradingStageId,
} from "../../shared/trading-progression";

/**
 * Persists the trader's 7-stage progression per user.
 *
 * Storage layout:
 *   hub/trading/progression/<userId>.json
 *
 * The 7-stage architecture (Learn → Strategy → Validation →
 * Sandbox → Evaluation → Qualification → Live) is fully defined
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
  await fs.mkdir(PROGRESSION_DIR, { recursive: true });
}

export async function loadProgression(userId: string): Promise<TradingProgression> {
  try {
    const raw = await fs.readFile(fileFor(userId), "utf-8");
    const parsed = JSON.parse(raw) as TradingProgression;
    return { ...DEFAULT_PROGRESSION, ...parsed };
  } catch {
    return { ...DEFAULT_PROGRESSION, lastUpdated: new Date().toISOString() };
  }
}

async function writeProgression(userId: string, progression: TradingProgression): Promise<void> {
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
