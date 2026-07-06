import fs from "fs/promises";
import path from "path";

import { HUB_SHARED_MEMORY_DIR } from "../../utils/repoPaths";
import type {
  AnyMemoryObject,
  ObjectGraph,
  ObjectMemoryType,
  ObjectRelationship,
} from "../../../shared/object-memory-types";

/**
 * Persistence for the object-memory reparse.
 *
 * Dry-run writes land under hub/shared-memory/object-reparse/.
 * Apply mode is implemented by writeAppliedGraph — it backs up any
 * existing graph, writes the new one alongside a reparse-history
 * entry, and never destroys prior data.
 */

const REPARSE_DIR = path.resolve(HUB_SHARED_MEMORY_DIR, "object-reparse");
const APPLIED_DIR = path.resolve(HUB_SHARED_MEMORY_DIR, "object-memory");

const DRY_RUN_JSON = path.join(REPARSE_DIR, "object-memory-dry-run.json");
const DRY_RUN_MD = path.join(REPARSE_DIR, "object-memory-dry-run.md");
const GRAPH_JSON = path.join(REPARSE_DIR, "object-graph.json");
const RELATIONSHIPS_JSON = path.join(REPARSE_DIR, "object-relationships.json");
const PROMOTION_JSON = path.join(REPARSE_DIR, "promotion-candidates.json");
const CONFLICTS_JSON = path.join(REPARSE_DIR, "memory-conflicts.json");
const UNRESOLVED_JSON = path.join(REPARSE_DIR, "unresolved-questions.json");
const MANIFEST_JSON = path.join(REPARSE_DIR, "extraction-manifest.json");
const COVERAGE_JSON = path.join(REPARSE_DIR, "source-coverage-report.json");

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

export async function writeDryRunOutputs(input: WriteDryRunInput): Promise<{
  outputs: string[];
  graph: ObjectGraph;
}> {
  await ensureDir(REPARSE_DIR);
  const graph: ObjectGraph = {
    version: "1",
    generatedAt: new Date().toISOString(),
    sources: input.sources,
    objects: input.objects,
    relationships: input.relationships,
    stats: graphStats(input.objects, input.relationships),
  };

  await writeJson(DRY_RUN_JSON, graph);
  await writeJson(GRAPH_JSON, {
    version: graph.version,
    generatedAt: graph.generatedAt,
    objects: graph.objects,
  });
  await writeJson(RELATIONSHIPS_JSON, {
    version: graph.version,
    generatedAt: graph.generatedAt,
    relationships: graph.relationships,
  });
  await writeJson(PROMOTION_JSON, {
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
  await writeJson(CONFLICTS_JSON, {
    version: graph.version,
    generatedAt: graph.generatedAt,
    conflicts: input.objects.filter((o) => o.type === "memory_conflict"),
  });
  await writeJson(UNRESOLVED_JSON, {
    version: graph.version,
    generatedAt: graph.generatedAt,
    questions: input.objects.filter((o) => o.type === "open_question"),
  });
  await writeJson(MANIFEST_JSON, {
    version: graph.version,
    generatedAt: graph.generatedAt,
    sources: input.sources,
    stats: graph.stats,
  });
  await writeJson(COVERAGE_JSON, {
    version: graph.version,
    generatedAt: graph.generatedAt,
    perSource: input.perSourceCoverage,
  });

  if (input.writeMarkdown) {
    await fs.writeFile(DRY_RUN_MD, renderMarkdown(graph), "utf-8");
  }

  return {
    outputs: [
      DRY_RUN_JSON,
      GRAPH_JSON,
      RELATIONSHIPS_JSON,
      PROMOTION_JSON,
      CONFLICTS_JSON,
      UNRESOLVED_JSON,
      MANIFEST_JSON,
      COVERAGE_JSON,
      ...(input.writeMarkdown ? [DRY_RUN_MD] : []),
    ],
    graph,
  };
}

/**
 * Apply mode: back up existing applied graph (if any), then write
 * the new one to hub/shared-memory/object-memory/graph.json.
 * Callers must be explicit — this only runs from the CLI --apply
 * path, never by default.
 */
export async function writeAppliedGraph(graph: ObjectGraph): Promise<{
  graphPath: string;
  backupPath?: string;
  historyPath: string;
}> {
  await ensureDir(APPLIED_DIR);
  const graphPath = path.join(APPLIED_DIR, "graph.json");
  const historyPath = path.join(APPLIED_DIR, "reparse-history.jsonl");
  let backupPath: string | undefined;

  try {
    await fs.access(graphPath);
    backupPath = path.join(APPLIED_DIR, `graph.backup.${Date.now()}.json`);
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
    }) + "\n",
    "utf-8",
  );

  return { graphPath, backupPath, historyPath };
}

export async function readAppliedGraph(): Promise<ObjectGraph | null> {
  try {
    const raw = await fs.readFile(path.join(APPLIED_DIR, "graph.json"), "utf-8");
    return JSON.parse(raw) as ObjectGraph;
  } catch {
    return null;
  }
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
