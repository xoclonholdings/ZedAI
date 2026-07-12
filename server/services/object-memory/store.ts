import fs from "fs/promises";
import path from "path";

import { HUB_SHARED_MEMORY_DIR, HUB_USER_MEMORY_DIR } from "../../utils/repoPaths";
import type {
  AnyMemoryObject,
  ObjectGraph,
  ObjectMemoryType,
  ObjectRelationship,
} from "../../../shared/object-memory-types";

/**
 * Persistence for the object-memory reparse.
 *
 * Unscoped dry-run/apply writes remain in hub/shared-memory for system
 * memory. User-scoped writes land under hub/user-memory/<userId>/ so
 * admin/project data does not become system memory by accident.
 * Apply mode is implemented by writeAppliedGraph — it backs up any
 * existing graph, writes the new one alongside a reparse-history
 * entry, and never destroys prior data.
 */

const REPARSE_DIR = path.resolve(HUB_SHARED_MEMORY_DIR, "object-reparse");
const APPLIED_DIR = path.resolve(HUB_SHARED_MEMORY_DIR, "object-memory");

export interface ObjectMemoryScope {
  userId?: string;
}

function safeUserId(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9_-]/g, "_") || "user";
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
 * Callers must be explicit — this only runs from the CLI --apply
 * path, never by default.
 */
export async function writeAppliedGraph(graph: ObjectGraph, scope?: ObjectMemoryScope): Promise<{
  graphPath: string;
  backupPath?: string;
  historyPath: string;
}> {
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
    /* no existing graph — first apply */
  }

  await writeJson(graphPath, graph);
  await fs.appendFile(
    historyPath,
    JSON.stringify({
      appliedAt: graph.generatedAt,
      sources: graph.sources,
      stats: graph.stats,
      backup: backupPath ? path.basename(backupPath) : null,
      scope: scope?.userId ? "user" : "system",
      userId: scope?.userId || null,
    }) + "\n",
    "utf-8",
  );

  return { graphPath, backupPath, historyPath };
}

export async function readAppliedGraph(scope?: ObjectMemoryScope): Promise<ObjectGraph | null> {
  try {
    const raw = await fs.readFile(graphPathFor(scope), "utf-8");
    return JSON.parse(raw) as ObjectGraph;
  } catch {
    return null;
  }
}

export async function resolveObjectMemoryUserId(
  userId: string | undefined,
  options?: { isAdmin?: boolean },
): Promise<string | undefined> {
  const current = userId?.trim() || undefined;
  if (!options?.isAdmin) return current;

  const candidates = Array.from(new Set([current, "user_admin"].filter(Boolean) as string[]));
  for (const candidate of candidates) {
    const graph = await readAppliedGraph({ userId: candidate }).catch(() => null);
    if ((graph?.objects?.length || 0) > 0 || (graph?.sources?.length || 0) > 0) {
      return candidate;
    }
  }

  return current || "user_admin";
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
