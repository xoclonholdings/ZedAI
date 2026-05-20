import fs from "fs/promises";
import path from "path";

import { pathExists } from "./text-utils";
import {
  DRAGONFLY_CONVERSATIONS,
  DRAGONFLY_ROOT,
  STRATEGIC_DOC_PATTERN,
  TEXT_EXTENSIONS,
  ZED_MEMORY_CONVERSATIONS,
  ZED_MEMORY_ROOT,
  type SourceManifest,
} from "./types";

/**
 * Breadth-first scan from a source root, returning text files whose
 * names match the "strategic doc" regex (plan / gameplan / build /
 * strategy / strategic). These are pulled in alongside the
 * conversations as foundation reference material.
 */
export async function collectStrategicDocs(root: string): Promise<string[]> {
  const docs: string[] = [];
  const queue = [root];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(entryPath);
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (!TEXT_EXTENSIONS.has(extension)) {
        continue;
      }

      if (STRATEGIC_DOC_PATTERN.test(entry.name)) {
        docs.push(entryPath);
      }
    }
  }

  return docs.sort();
}

/**
 * Discover which legacy memory sources actually exist on disk. We
 * skip silently when a source is missing — the merge run handles
 * that as "no manifests found, error out".
 */
export async function buildSourceManifests(): Promise<SourceManifest[]> {
  const manifests: SourceManifest[] = [];

  if (await pathExists(DRAGONFLY_CONVERSATIONS)) {
    manifests.push({
      name: "dragonfly",
      root: DRAGONFLY_ROOT,
      conversationsPath: DRAGONFLY_CONVERSATIONS,
      strategicDocPaths: await collectStrategicDocs(DRAGONFLY_ROOT),
    });
  }

  if (await pathExists(ZED_MEMORY_CONVERSATIONS)) {
    manifests.push({
      name: "zed-memory",
      root: ZED_MEMORY_ROOT,
      conversationsPath: ZED_MEMORY_CONVERSATIONS,
      strategicDocPaths: await collectStrategicDocs(ZED_MEMORY_ROOT),
    });
  }

  return manifests;
}
