import fs from "fs/promises";
import path from "path";

import { HUB_SHARED_MEMORY_DIR } from "../utils/repoPaths";

/**
 * Per-user "don't suggest this again" list for FlowSuggestionEngine.
 * Suggestions themselves are computed fresh each time (see
 * FlowSuggestionEngine.ts) rather than stored - this file only remembers
 * which computed suggestion ids the user has explicitly dismissed, keyed by
 * the same stable id the engine derives from the pattern's token set.
 */

const DIR = path.resolve(HUB_SHARED_MEMORY_DIR, "flow-suggestions");

function fileFor(userId: string): string {
  return path.resolve(DIR, `${encodeURIComponent(userId)}.json`);
}

async function readDismissed(userId: string): Promise<string[]> {
  try {
    const raw = await fs.readFile(fileFor(userId), "utf8");
    const parsed = JSON.parse(raw) as { dismissed?: string[] };
    return Array.isArray(parsed.dismissed) ? parsed.dismissed : [];
  } catch {
    return [];
  }
}

export const FlowSuggestionStore = {
  async getDismissed(userId: string): Promise<Set<string>> {
    return new Set(await readDismissed(userId));
  },

  async dismiss(userId: string, suggestionId: string): Promise<void> {
    const existing = await readDismissed(userId);
    if (existing.includes(suggestionId)) return;
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(
      fileFor(userId),
      JSON.stringify({ dismissed: [...existing, suggestionId].slice(-200) }, null, 2),
      "utf8",
    );
  },
};
