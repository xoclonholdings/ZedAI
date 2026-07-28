import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

import { HUB_SHARED_MEMORY_DIR } from "../utils/repoPaths";

/**
 * File-backed live-browser session store, one file per user under
 * hub/shared-memory/browser-sessions/. Both the user (via the console's
 * Browse action) and ZAR (via IntelligenceAgent's own web lookups) record
 * visits into the same per-user history, so the console's live browser
 * shows either side's browsing as it happens - the client polls
 * GET /api/browser/session the same way it already polls conversations.
 */

const SESSIONS_DIR = path.resolve(HUB_SHARED_MEMORY_DIR, "browser-sessions");
const MAX_HISTORY = 20;

export interface BrowserVisit {
  id: string;
  url: string;
  title?: string;
  text?: string;
  /** Sanitized, script-free reader-view HTML - see WebContentService.sanitizeReaderHtml. */
  sanitizedHtml?: string;
  status?: number;
  error?: string;
  source: "user" | "zar";
  visitedAt: string;
}

export interface BrowserSession {
  current: BrowserVisit | null;
  history: BrowserVisit[];
}

async function ensureDir() {
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
}

function fileFor(userId: string): string {
  return path.resolve(SESSIONS_DIR, `${encodeURIComponent(userId)}.json`);
}

async function readSession(userId: string): Promise<BrowserSession> {
  try {
    const raw = await fs.readFile(fileFor(userId), "utf8");
    const parsed = JSON.parse(raw) as BrowserSession;
    return { current: parsed.current ?? null, history: parsed.history ?? [] };
  } catch {
    return { current: null, history: [] };
  }
}

async function writeSession(userId: string, session: BrowserSession): Promise<void> {
  await ensureDir();
  await fs.writeFile(fileFor(userId), JSON.stringify(session, null, 2), "utf8");
}

export const BrowserSessionStore = {
  async getSession(userId: string): Promise<BrowserSession> {
    return readSession(userId);
  },

  async recordVisit(
    userId: string,
    visit: Omit<BrowserVisit, "id" | "visitedAt">,
  ): Promise<BrowserVisit> {
    const entry: BrowserVisit = {
      ...visit,
      id: randomUUID(),
      visitedAt: new Date().toISOString(),
    };
    const session = await readSession(userId);
    const history = [entry, ...session.history].slice(0, MAX_HISTORY);
    const next: BrowserSession = { current: entry, history };
    await writeSession(userId, next);
    return entry;
  },
};
