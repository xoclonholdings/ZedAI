import fs from "fs/promises";
import path from "path";

import { isDatabaseRequired } from "../../db";
import { HUB_SHARED_MEMORY_DIR, HUB_USER_MEMORY_DIR } from "../../utils/repoPaths";
import { readAppState, writeAppState } from "../appState";
import type {
  AnyMemoryObject,
  ObjectGraph,
  ObjectMemoryType,
  ObjectRelationship,
} from "../../../shared/object-memory-types";

/**
 * Persistence for the object-memory reparse.
 *
 * Unscoped dry-run/apply writes remain in hub/shared-memory for explicit
 * system memory. User-scoped writes land under hub/user-memory/<userId>/ so
 * admin/project data does not become system memory by accident.
 * Apply mode is implemented by writeAppliedGraph - it backs up any
 * existing graph, writes the new one alongside a reparse-history
 * entry, and never destroys prior data.
 */

const REPARSE_DIR = path.resolve(HUB_SHARED_MEMORY_DIR, "object-reparse");
const APPLIED_DIR = path.resolve(HUB_SHARED_MEMORY_DIR, "object-memory");

const INVALID_MEMORY_USER_IDS = new Set([
  "",
  "user",
  "user_001",
  "default-user",
  "default_user",
  "anonymous",
  "unknown",
  "offline",
  "admin-user",
  "admin_user",
]);

export interface ObjectMemoryScope {
  userId?: string;
}

function requireObjectMemoryUserId(value: unknown, operation: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${operation} requires an authenticated userId.`);
  }
  const userId = value.trim();
  if (
    INVALID_MEMORY_USER_IDS.has(userId) ||
    userId.includes("..") ||
    userId.includes("/") ||
    userId.includes("\\")
  ) {
    throw new Error(`${operation} received an invalid or fallback userId.`);
  }
  return userId;
}

function safeUserId(userId: string): string {
  const owner = requireObjectMemoryUserId(userId, "object memory path");
  const safe = owner.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!safe) throw new Error("Authenticated userId could not be converted to a scoped memory path.");
  return safe;
}

function appliedDir(scope?: ObjectMemoryScope): string {
  if (scope?.userId) {
    return path.resolve(HUB_USER_MEMORY_DIR, safeUserId(scope.userId), "object-memory");
  }
  return APPLIED_DIR;
}

function graphPathFor(scope?: ObjectMemoryScope): string {
  return path.join(appliedDir(scope), "graph.json");
}

function historyPathFor(scope?: ObjectMemoryScope): string {
  return path.join(appliedDir(scope), "reparse-history.jsonl");
}

function appliedScopeKey(scope?: ObjectMemoryScope): string {
  return scope?.userId ? `user:${safeUserId(scope.userId)}` : "system";
}

function graphDbPath(scopeKey: string): string {
  return `app_state:object-memory:applied-graph:${scopeKey}`;
}

function historyDbPath(scopeKey: string): string {
  return `app_state:object-memory:reparse-history:${scopeKey}`;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function writeJson(file: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

export function graphStats(
  objects: AnyMemoryObject[],
  relationships: ObjectRelationship[],
): ObjectGraph["stats"] {
  const byType = objects.reduce((acc, obj) => {
    acc[obj.type] = (acc[obj.type] || 0) + 1;
    return acc;
  }, {} as Record<ObjectMemoryType, number>);
  return {
    totalObjects: objects.length,
    byType,
    totalRelationships: relationships.length,
    conflicts: objects.filter((o) => o.type === "memory_conflict").length,
    openQuestions: objects.filter((o) => o.type === "open_question").length,
  };
}

export interface WriteDryRunInput {
  sources: string[];
  objects: AnyMemoryObject[];
  relationships: ObjectRelationship[];
  perSourceCoverage: Array<{ source: string; objectsFound: number; bytes: number }>;
  writeMarkdown?: boolean;
}

export async function writeDryRunOutputs(input: WriteDryRunInput, scope?: ObjectMemoryScope): Promise<{
  outputs: string[];
  graph: ObjectGraph;
}> {
  const reparseDir = scope?.userId
    ? path.resolve(HUB_USER_MEMORY_DIR, safeUserId(scope.userId), "object-reparse")
    : REPARSE_DIR;
  const dryRunJson = path.join(reparseDir, "object-memory-dry-run.json");
  const dryRunMd = path.join(reparseDir, "object-memory-dry-run.md");
  const graphJson = path.join(reparseDir, "object-graph.json");
  const relationshipsJson = path.join(reparseDir, "object-relationships.json");
  const promotionJson = path.join(reparseDir, "promotion-candidates.json");
  const conflictsJson = path.join(reparseDir, "memory-conflicts.json");
  const unresolvedJson = path.join(reparseDir, "unresolved-questions.json");
  const manifestJson = path.join(reparseDir, "extraction-manifest.json");
  const coverageJson = path.join(reparseDir, "source-coverage-report.json");

  await ensureDir(reparseDir);
  const graph: ObjectGraph = {
    version: "1",
    generatedAt: new Date().toISOString(),
    sources: input.sources,
    objects: input.objects,
    relationships: input.relationships,
    stats: graphStats(input.objects, input.relationships),
  };

  await writeJson(dryRunJson, graph);
  await writeJson(graphJson, {
    version: graph.version,
    generatedAt: graph.generatedAt,
    objects: graph.objects,
  });
  await writeJson(relationshipsJson, {
    version: graph.version,
    generatedAt: graph.generatedAt,
    relationships: graph.relationships,
  });
  await writeJson(promotionJson, {
    version: graph.version,
    generatedAt: graph.generatedAt,
    candidates: input.objects.map((o) => ({
      id: o.id,
      type: o.type,
      canonicalName: o.canonicalName,
      promotionTier: o.promotionTier,
      confidence: o.confidence,
    })),
  });
  await writeJson(conflictsJson, {
    version: graph.version,
    generatedAt: graph.generatedAt,
    conflicts: input.objects.filter((o) => o.type === "memory_conflict"),
  });
  await writeJson(unresolvedJson, {
    version: graph.version,
    generatedAt: graph.generatedAt,
    questions: input.objects.filter((o) => o.type === "open_question"),
  });
  await writeJson(manifestJson, {
    version: graph.version,
    generatedAt: graph.generatedAt,
    sources: input.sources,
    stats: graph.stats,
    scope: scope?.userId ? "user" : "system",
    userId: scope?.userId || null,
  });
  await writeJson(coverageJson, {
    version: graph.version,
    generatedAt: graph.generatedAt,
    perSource: input.perSourceCoverage,
  });

  if (input.writeMarkdown) {
    await fs.writeFile(dryRunMd, renderMarkdown(graph), "utf-8");
  }

  return {
    outputs: [
      dryRunJson,
      graphJson,
      relationshipsJson,
      promotionJson,
      conflictsJson,
      unresolvedJson,
      manifestJson,
      coverageJson,
      ...(input.writeMarkdown ? [dryRunMd] : []),
    ],
    graph,
  };
}

/**
 * Apply mode: back up existing applied graph (if any), then write
 * the new one to the selected system or user-scoped graph.
 * Callers must be explicit - this only runs from the CLI --apply
 * path, never by default.
 */
export async function writeAppliedGraph(graph: ObjectGraph, scope?: ObjectMemoryScope): Promise<{
  graphPath: string;
  backupPath?: string;
  historyPath: string;
}> {
  const scopeKey = appliedScopeKey(scope);
  const historyEntry = {
    appliedAt: graph.generatedAt,
    sources: graph.sources,
    stats: graph.stats,
    backup: null,
    scope: scope?.userId ? "user" : "system",
    userId: scope?.userId || null,
  };

  const wroteGraph = await writeAppState("object-memory:applied-graph", scopeKey, graph);
  const previousHistory = (await readAppState<any[]>("object-memory:reparse-history", scopeKey)) || [];
  const wroteHistory = await writeAppState(
    "object-memory:reparse-history",
    scopeKey,
    [...previousHistory.slice(-99), historyEntry],
  );

  if (isDatabaseRequired()) {
    if (!wroteGraph || !wroteHistory) {
      throw new Error("Unable to persist applied object memory to PostgreSQL.");
    }
    return { graphPath: graphDbPath(scopeKey), historyPath: historyDbPath(scopeKey) };
  }

  const dir = appliedDir(scope);
  await ensureDir(dir);
  const graphPath = graphPathFor(scope);
  const historyPath = historyPathFor(scope);
  let backupPath: string | undefined;

  try {
    await fs.access(graphPath);
    backupPath = path.join(dir, `graph.backup.${Date.now()}.json`);
    await fs.copyFile(graphPath, backupPath);
  } catch {
    /* no existing graph - first apply */
  }

  await writeJson(graphPath, graph);
  await fs.appendFile(
    historyPath,
    JSON.stringify({ ...historyEntry, backup: backupPath ? path.basename(backupPath) : null }) + "\n",
    "utf-8",
  );

  return { graphPath, backupPath, historyPath };
}

export async function readAppliedGraph(scope?: ObjectMemoryScope): Promise<ObjectGraph | null> {
  const scopeKey = appliedScopeKey(scope);
  try {
    const stored = await readAppState<ObjectGraph>("object-memory:applied-graph", scopeKey);
    if (stored) return stored;
  } catch (error) {
    if (isDatabaseRequired()) throw error;
  }

  // Postgres has no row for this scope yet - fall back to the committed
  // seed file rather than reporting an empty graph. This matters even when
  // the database is authoritative: a graph applied via the CLI's --apply
  // path before this environment ever had DATABASE_URL configured leaves
  // real data sitting on disk (checked into git under hub/user-memory/)
  // with nothing in Postgres to show for it.
  let fileGraph: ObjectGraph | null;
  try {
    const raw = await fs.readFile(graphPathFor(scope), "utf-8");
    fileGraph = JSON.parse(raw) as ObjectGraph;
  } catch {
    fileGraph = null;
  }

  if (fileGraph && isDatabaseRequired()) {
    // Backfill once so future reads/writes go through Postgres like normal -
    // best-effort, never blocks the read that's already in hand.
    void writeAppState("object-memory:applied-graph", scopeKey, fileGraph).catch(() => {});
  }

  return fileGraph;
}

export async function resolveObjectMemoryUserId(
  userId: string | undefined,
  _options?: { isAdmin?: boolean },
): Promise<string> {
  return requireObjectMemoryUserId(userId, "object memory owner resolution");
}

function renderMarkdown(graph: ObjectGraph): string {
  const lines: string[] = [
    `# Object-memory reparse (dry run)`,
    ``,
    `Generated: ${graph.generatedAt}`,
    `Sources: ${graph.sources.length}`,
    ``,
    `## Stats`,
    ``,
    `- Total objects: ${graph.stats.totalObjects}`,
    `- Relationships: ${graph.stats.totalRelationships}`,
    `- Conflicts: ${graph.stats.conflicts}`,
    `- Open questions: ${graph.stats.openQuestions}`,
    ``,
    `### By type`,
    ...Object.entries(graph.stats.byType).map(([t, n]) => `- ${t}: ${n}`),
    ``,
    `## Sample objects`,
    ``,
  ];
  for (const obj of graph.objects.slice(0, 40)) {
    lines.push(`### ${obj.canonicalName} (${obj.type})`);
    lines.push(``);
    lines.push(`- **Confidence**: ${obj.confidence}`);
    lines.push(`- **Promotion tier**: ${obj.promotionTier}`);
    lines.push(`- **Summary**: ${obj.summary}`);
    if (obj.sourceRefs[0]) {
      lines.push(`- **Evidence**: _${obj.sourceRefs[0].evidenceQuote}_`);
    }
    lines.push(``);
  }
  return lines.join("\n");
}
