#!/usr/bin/env tsx
/**
 * CLI: object-memory reparse of the foundation memory exports.
 *
 * Usage:
 *   tsx server/scripts/reparseBaseMemoryToObjects.ts [flags]
 *
 * Flags:
 *   --dry-run             Default. Writes scoped reparse artifacts.
 *   --apply               Also writes the applied graph. By default this
 *                         targets Admin memory, not System memory.
 *   --user <id>           Apply into a specific user's object memory.
 *   --system              Apply into true shared System memory.
 *   --source <path>       Add an explicit source file (repeatable).
 *   --limit <n>           Cap total objects extracted.
 *   --offset <n>          Skip the first n sentences per source.
 *   --project <name>      Only emit objects tagged with this project.
 *   --type <type>         Only emit objects of this type.
 *   --min-confidence <n>  Drop objects below this confidence [0..1].
 *   --include-conflicts   Include memory_conflict objects (default: yes).
 *   --write-markdown      Also render a human-readable markdown summary.
 *
 * Package scripts:
 *   npm run memory:reparse-objects           # dry run
 *   npm run memory:reparse-objects:apply     # dry run + apply
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { extractObjectsFromSource } from "../services/object-memory/extractor";
import { writeDryRunOutputs, writeAppliedGraph } from "../services/object-memory/store";
import { loadAdminSettings } from "../services/AdminSettingsStore";`nimport { requireAuthenticatedMemoryUserId } from "../services/memory/MemoryOwnershipService";
import type { AnyMemoryObject, ObjectRelationship } from "../../shared/object-memory-types";

const FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(FILE_DIR, "..", "..");

interface CliFlags {
  dryRun: boolean;
  apply: boolean;
  sources: string[];
  limit?: number;
  offset?: number;
  project?: string;
  type?: string;
  userId?: string;
  system: boolean;
  minConfidence?: number;
  includeConflicts: boolean;
  writeMarkdown: boolean;
}

function parseFlags(argv: string[]): CliFlags {
  const flags: CliFlags = {
    dryRun: true,
    apply: false,
    sources: [],
    system: false,
    includeConflicts: true,
    writeMarkdown: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--dry-run":
        flags.dryRun = true;
        break;
      case "--apply":
        flags.apply = true;
        break;
      case "--user":
        flags.userId = argv[++i];
        break;
      case "--system":
        flags.system = true;
        break;
      case "--source":
        flags.sources.push(argv[++i]);
        break;
      case "--limit":
        flags.limit = Number(argv[++i]);
        break;
      case "--offset":
        flags.offset = Number(argv[++i]);
        break;
      case "--project":
        flags.project = argv[++i];
        break;
      case "--type":
        flags.type = argv[++i];
        break;
      case "--min-confidence":
        flags.minConfidence = Number(argv[++i]);
        break;
      case "--include-conflicts":
        flags.includeConflicts = true;
        break;
      case "--no-conflicts":
        flags.includeConflicts = false;
        break;
      case "--write-markdown":
        flags.writeMarkdown = true;
        break;
    }
  }
  return flags;
}

async function applyUserId(flags: CliFlags): Promise<string | undefined> {
  if (flags.system) return undefined;
  if (flags.userId) return requireAuthenticatedMemoryUserId(flags.userId, "object-memory reparse --user");
  const settings = await loadAdminSettings();
  return requireAuthenticatedMemoryUserId(
    settings.users.find((user) => user.isAdmin)?.id,
    "object-memory reparse admin owner",
  );
}

function safeUserPathSegment(userId: string): string {
  const owner = requireAuthenticatedMemoryUserId(userId, "object-memory reparse source scope");
  const safe = owner.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!safe) throw new Error("Authenticated userId could not be converted to a scoped memory path.");
  return safe;
}

async function defaultSources(userId?: string): Promise<string[]> {
  const roots = userId
    ? [
        path.join(REPO_ROOT, "hub/user-memory", safeUserPathSegment(userId), "foundation/semantic"),
        path.join(REPO_ROOT, "hub/user-memory", safeUserPathSegment(userId), "foundation/consensus"),
      ]
    : [
        path.join(REPO_ROOT, "hub/shared-memory/semantic/foundation"),
        path.join(REPO_ROOT, "hub/shared-memory/consensus/foundation"),
      ];
  const results: string[] = [];
  for (const root of roots) {
    try {
      const entries = await fs.readdir(root, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && /\.(md|json|txt)$/.test(entry.name)) {
          results.push(path.join(root, entry.name));
        }
      }
    } catch {
      /* directory absent - skip */
    }
  }
  return results;
}

async function readSourceText(file: string): Promise<string> {
  const raw = await fs.readFile(file, "utf-8").catch(() => "");
  if (file.endsWith(".json")) {
    try {
      const parsed = JSON.parse(raw);
      return JSON.stringify(parsed).slice(0, 500_000);
    } catch {
      return raw;
    }
  }
  return raw;
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const targetUserId = await applyUserId(flags);
  const sources = flags.sources.length ? flags.sources : await defaultSources(targetUserId);

  if (sources.length === 0) {
    console.error("[reparse] No sources found. Point --source at a foundation file.");
    process.exit(1);
  }

  const targetLabel = flags.system
    ? "system memory"
    : `${flags.userId ? "user" : "admin"} memory (${targetUserId})`;

  console.log(`[reparse] Sources: ${sources.length}`);
  console.log(`[reparse] Mode: ${flags.apply ? "apply" : "dry-run"}`);
  console.log(`[reparse] Target: ${targetLabel}`);

  const objects: AnyMemoryObject[] = [];
  const relationships: ObjectRelationship[] = [];
  const perSource: Array<{ source: string; objectsFound: number; bytes: number }> = [];

  for (const source of sources) {
    const text = await readSourceText(source);
    const { objects: srcObjs, relationships: srcRels } = extractObjectsFromSource({
      sourceFile: path.relative(REPO_ROOT, source),
      text,
    });

    let filtered = srcObjs;
    if (flags.type) filtered = filtered.filter((o) => o.type === flags.type);
    if (flags.minConfidence !== undefined) {
      filtered = filtered.filter((o) => o.confidence >= flags.minConfidence!);
    }
    if (flags.project) {
      const p = flags.project.toLowerCase();
      filtered = filtered.filter((o) => o.canonicalName.toLowerCase().includes(p));
    }
    if (!flags.includeConflicts) {
      filtered = filtered.filter((o) => o.type !== "memory_conflict");
    }

    objects.push(...filtered);
    relationships.push(...srcRels);
    perSource.push({
      source: path.relative(REPO_ROOT, source),
      objectsFound: filtered.length,
      bytes: Buffer.byteLength(text, "utf-8"),
    });

    if (flags.limit && objects.length >= flags.limit) {
      console.log(`[reparse] Reached --limit=${flags.limit}, stopping.`);
      break;
    }
  }

  console.log(`[reparse] Extracted ${objects.length} objects, ${relationships.length} relationships.`);

  const { outputs, graph } = await writeDryRunOutputs({
    sources: sources.map((s) => path.relative(REPO_ROOT, s)),
    objects,
    relationships,
    perSourceCoverage: perSource,
    writeMarkdown: flags.writeMarkdown,
  }, targetUserId ? { userId: targetUserId } : undefined);

  console.log(`[reparse] Dry-run outputs:`);
  for (const out of outputs) console.log(`  - ${path.relative(REPO_ROOT, out)}`);

  if (flags.apply) {
    const applied = await writeAppliedGraph(graph, targetUserId ? { userId: targetUserId } : undefined);
    console.log(`[reparse] Applied graph: ${path.relative(REPO_ROOT, applied.graphPath)}`);
    if (applied.backupPath) {
      console.log(`[reparse] Prior graph backed up: ${path.relative(REPO_ROOT, applied.backupPath)}`);
    }
    console.log(`[reparse] History appended: ${path.relative(REPO_ROOT, applied.historyPath)}`);
  }
}

main().catch((err) => {
  console.error("[reparse] Failed:", err);
  process.exit(1);
});
