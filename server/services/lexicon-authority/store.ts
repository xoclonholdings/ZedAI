import fs from "fs/promises";
import path from "path";

import { HUB_SHARED_MEMORY_DIR } from "../../utils/repoPaths";
import { buildSeedLexicon } from "./seed";
import type { LexiconEntry, LexiconRelationship } from "./types";
import { nowIso } from "./util";

const LEXICON_DIR = path.join(HUB_SHARED_MEMORY_DIR, "lexicon");
const LEXICON_FILE = path.join(LEXICON_DIR, "lexicon.json");

export interface LexiconStore {
  version: number;
  updatedAt: string;
  entries: LexiconEntry[];
  relationships: LexiconRelationship[];
}

function emptyStore(): LexiconStore {
  return { version: 1, updatedAt: nowIso(), entries: [], relationships: [] };
}

/** Local fallback/export storage, same status as
 *  hub/shared-memory/knowledge-graph/ — not canonical personal user
 *  memory, not the durable store. Seeded once on first read so the
 *  subsystem is usable out of the box; the seed never overwrites an
 *  existing store. */
export async function loadLexiconStore(): Promise<LexiconStore> {
  try {
    const parsed = JSON.parse(await fs.readFile(LEXICON_FILE, "utf-8")) as LexiconStore;
    return {
      version: parsed.version || 1,
      updatedAt: parsed.updatedAt || nowIso(),
      entries: parsed.entries || [],
      relationships: parsed.relationships || [],
    };
  } catch {
    const seed = buildSeedLexicon();
    const store: LexiconStore = {
      version: 1,
      updatedAt: nowIso(),
      entries: seed.entries,
      relationships: seed.relationships,
    };
    await saveLexiconStore(store).catch(() => {
      /* best-effort persistence — an in-memory seed still works this turn */
    });
    return store;
  }
}

export async function saveLexiconStore(store: LexiconStore): Promise<void> {
  await fs.mkdir(LEXICON_DIR, { recursive: true });
  await fs.writeFile(LEXICON_FILE, JSON.stringify({ ...store, updatedAt: nowIso() }, null, 2));
}
