import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

import { HUB_DIR, SERVER_DIR } from "../utils/repoPaths";
import type {
  FlowDefinition,
  FlowRun,
  FlowStageRun,
} from "../../shared/flow-types";

/**
 * File-system layout (under hub/flows/):
 *   library/<slug>.json     — editable flow definitions (admin reads/writes)
 *   runs/<runId>.json       — execution state for active/completed runs
 *
 * Seed flow templates ship at server/seeds/flows/*.json and are copied to
 * library/ on first boot only — admin edits aren't overwritten on update.
 */

const FLOWS_DIR = path.resolve(HUB_DIR, "flows");
const LIBRARY_DIR = path.resolve(FLOWS_DIR, "library");
const RUNS_DIR = path.resolve(FLOWS_DIR, "runs");
const SEEDS_DIR = path.resolve(SERVER_DIR, "seeds", "flows");

async function ensureDirs() {
  await fs.mkdir(LIBRARY_DIR, { recursive: true });
  await fs.mkdir(RUNS_DIR, { recursive: true });
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJson(file: string, data: unknown) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || `flow-${Date.now()}`;
}

let didSeedRun = false;

async function seedLibraryFromTemplatesOnce() {
  if (didSeedRun) return;
  didSeedRun = true;

  await ensureDirs();
  let seedFiles: string[];
  try {
    seedFiles = await fs.readdir(SEEDS_DIR);
  } catch {
    return; // no seeds shipped
  }

  for (const file of seedFiles) {
    if (!file.endsWith(".json")) continue;
    const seedPath = path.resolve(SEEDS_DIR, file);
    const libraryPath = path.resolve(LIBRARY_DIR, file);
    try {
      await fs.access(libraryPath);
      // Already present — admin may have edited it. Don't overwrite.
      continue;
    } catch {
      // Not present — copy seed in.
    }
    const seed = await readJson<FlowDefinition>(seedPath);
    if (!seed) continue;
    const now = new Date().toISOString();
    const definition: FlowDefinition = {
      ...seed,
      id: seed.id || randomUUID(),
      createdAt: seed.createdAt || now,
      updatedAt: seed.updatedAt || now,
    };
    await writeJson(libraryPath, definition);
  }
}

export const FlowStore = {
  async listDefinitions(opts?: { includeArchived?: boolean }): Promise<FlowDefinition[]> {
    await seedLibraryFromTemplatesOnce();
    await ensureDirs();
    const files = await fs.readdir(LIBRARY_DIR);
    const flows: FlowDefinition[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const flow = await readJson<FlowDefinition>(path.resolve(LIBRARY_DIR, file));
      if (!flow) continue;
      if (flow.status === "archived" && !opts?.includeArchived) continue;
      flows.push(flow);
    }
    return flows.sort((a, b) => a.name.localeCompare(b.name));
  },

  async getDefinition(id: string): Promise<FlowDefinition | null> {
    await seedLibraryFromTemplatesOnce();
    const all = await this.listDefinitions({ includeArchived: true });
    return all.find((f) => f.id === id || f.slug === id) || null;
  },

  async listPublished(): Promise<FlowDefinition[]> {
    const all = await this.listDefinitions();
    return all.filter((f) => f.status === "published");
  },

  async createDefinition(input: Omit<FlowDefinition, "id" | "createdAt" | "updatedAt" | "slug"> & { slug?: string }): Promise<FlowDefinition> {
    await ensureDirs();
    const now = new Date().toISOString();
    const slug = input.slug || slugify(input.name);
    const flow: FlowDefinition = {
      ...input,
      id: randomUUID(),
      slug,
      createdAt: now,
      updatedAt: now,
    };
    await writeJson(path.resolve(LIBRARY_DIR, `${slug}.json`), flow);
    return flow;
  },

  async updateDefinition(id: string, patch: Partial<FlowDefinition>): Promise<FlowDefinition | null> {
    const existing = await this.getDefinition(id);
    if (!existing) return null;
    const merged: FlowDefinition = {
      ...existing,
      ...patch,
      id: existing.id,
      slug: existing.slug,
      version: patch.stages || patch.name ? existing.version + 1 : existing.version,
      updatedAt: new Date().toISOString(),
    };
    await writeJson(path.resolve(LIBRARY_DIR, `${existing.slug}.json`), merged);
    return merged;
  },

  async publishDefinition(id: string): Promise<FlowDefinition | null> {
    const existing = await this.getDefinition(id);
    if (!existing) return null;
    return this.updateDefinition(id, {
      status: "published",
      publishedAt: existing.publishedAt || new Date().toISOString(),
    });
  },

  async archiveDefinition(id: string): Promise<FlowDefinition | null> {
    return this.updateDefinition(id, { status: "archived" });
  },

  async duplicateDefinition(id: string): Promise<FlowDefinition | null> {
    const existing = await this.getDefinition(id);
    if (!existing) return null;
    const copy = {
      ...existing,
      name: `${existing.name} (copy)`,
      status: "draft" as const,
      version: 1,
      publishedAt: undefined,
    };
    const { id: _id, createdAt: _c, updatedAt: _u, slug: _s, ...rest } = copy;
    return this.createDefinition(rest);
  },

  // ── Runs ────────────────────────────────────────────────────────────

  async listRuns(opts?: { userId?: string; limit?: number }): Promise<FlowRun[]> {
    await ensureDirs();
    const files = await fs.readdir(RUNS_DIR);
    const runs: FlowRun[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const run = await readJson<FlowRun>(path.resolve(RUNS_DIR, file));
      if (!run) continue;
      if (opts?.userId && run.userId !== opts.userId) continue;
      runs.push(run);
    }
    runs.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
    return opts?.limit ? runs.slice(0, opts.limit) : runs;
  },

  async getRun(runId: string): Promise<FlowRun | null> {
    return readJson<FlowRun>(path.resolve(RUNS_DIR, `${runId}.json`));
  },

  async startRun(input: {
    flow: FlowDefinition;
    userId: string;
    conversationId?: string;
    context?: Record<string, unknown>;
  }): Promise<FlowRun> {
    await ensureDirs();
    const now = new Date().toISOString();
    const stageRuns: FlowStageRun[] = input.flow.stages.map((stage) => ({
      stageId: stage.id,
      status: "pending",
    }));
    const run: FlowRun = {
      id: randomUUID(),
      flowId: input.flow.id,
      flowSlug: input.flow.slug,
      flowName: input.flow.name,
      userId: input.userId,
      conversationId: input.conversationId,
      status: "queued",
      startedAt: now,
      currentStageId: input.flow.stages[0]?.id,
      context: input.context || {},
      stageRuns,
    };
    await writeJson(path.resolve(RUNS_DIR, `${run.id}.json`), run);
    return run;
  },

  async updateRun(runId: string, patch: Partial<FlowRun>): Promise<FlowRun | null> {
    const existing = await this.getRun(runId);
    if (!existing) return null;
    const merged: FlowRun = { ...existing, ...patch, id: existing.id };
    await writeJson(path.resolve(RUNS_DIR, `${runId}.json`), merged);
    return merged;
  },
};
