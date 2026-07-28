import fs from "fs/promises";
import path from "path";

import { HUB_SHARED_MEMORY_DIR } from "../utils/repoPaths";

/**
 * Per-user "don't suggest this integration again" list for
 * IntegrationGapEngine - mirrors FlowSuggestionStore's shape exactly.
 */

const DIR = path.resolve(HUB_SHARED_MEMORY_DIR, "integration-gaps");

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

export const IntegrationGapStore = {
  async getDismissed(userId: string): Promise<Set<string>> {
    return new Set(await readDismissed(userId));
  },

  async dismiss(userId: string, gapId: string): Promise<void> {
    const existing = await readDismissed(userId);
    if (existing.includes(gapId)) return;
    await fs.mkdir(DIR, { recursive: true });
    await fs.writeFile(
      fileFor(userId),
      JSON.stringify({ dismissed: [...existing, gapId].slice(-200) }, null, 2),
      "utf8",
    );
  },
};
