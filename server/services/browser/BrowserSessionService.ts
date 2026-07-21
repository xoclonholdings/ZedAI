/**
 * BrowserSessionService — deterministic browser automation
 * (Playwright-MCP-referenced capability).
 *
 * Architecture decision: playwright-core drives a system Chromium
 * (PLAYWRIGHT_BROWSERS_PATH or BROWSER_EXECUTABLE_PATH). The model NEVER
 * gets arbitrary Playwright code execution — only the typed actions in
 * BrowserToolService, each validated and audited. This module owns the
 * session lifecycle: isolated contexts, per-user ownership, expiration,
 * cleanup, domain policy, step budget, and the persistent action trace.
 *
 * Consequential actions (form submission, purchases, sending content)
 * are not decided here — BrowserToolService classifies risk and routes
 * approval through the existing ExecutionPipeline before a consequential
 * step may run.
 */

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

import { HUB_SHARED_MEMORY_DIR, UPLOADS_DIR } from "../../utils/repoPaths";
import { logRuntimeEvent } from "../RuntimeLogger";
import { checkUrlSafety } from "../security/UrlSafetyGuard";

import type { Browser, BrowserContext, Page } from "playwright-core";

const SESSION_STORE_PATH = path.resolve(HUB_SHARED_MEMORY_DIR, "browser/browser-sessions.json");
const SCREENSHOT_DIR = path.resolve(UPLOADS_DIR, "browser-screenshots");
const DOWNLOAD_DIR = path.resolve(UPLOADS_DIR, "browser-downloads");

const SESSION_TTL_MS = Number(process.env.BROWSER_SESSION_TTL_MS || 10 * 60 * 1000);
const MAX_SESSIONS_PER_USER = Number(process.env.BROWSER_MAX_SESSIONS_PER_USER || 2);
const MAX_STEPS_PER_SESSION = Number(process.env.BROWSER_MAX_STEPS || 60);

export interface BrowserActionRecord {
  step: number;
  action: string;
  input: Record<string, unknown>;
  ok: boolean;
  detail?: string;
  url?: string;
  at: string;
  approvalTaskId?: string;
}

export interface BrowserSessionRecord {
  id: string;
  userId: string;
  conversationId?: string | null;
  status: "active" | "closed" | "expired" | "crashed";
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  allowedDomains: string[] | null;
  stepCount: number;
  actions: BrowserActionRecord[];
  artifacts: Array<{ kind: "screenshot" | "download"; path: string; at: string }>;
}

interface LiveSession {
  record: BrowserSessionRecord;
  context: BrowserContext;
  page: Page;
  expiresAt: number;
}

interface SessionStoreFile {
  version: string;
  sessions: BrowserSessionRecord[];
}

let sharedBrowser: Browser | null = null;
const liveSessions = new Map<string, LiveSession>();
let sweepTimer: NodeJS.Timeout | null = null;

function chromiumExecutable(): string | undefined {
  const explicit = (process.env.BROWSER_EXECUTABLE_PATH || "").trim();
  if (explicit) return explicit;
  return undefined; // playwright-core resolves via PLAYWRIGHT_BROWSERS_PATH
}

async function persist(record: BrowserSessionRecord): Promise<void> {
  try {
    let store: SessionStoreFile = { version: "1.0", sessions: [] };
    try {
      const raw = await fs.readFile(SESSION_STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.sessions)) store = parsed;
    } catch {}
    const idx = store.sessions.findIndex((s) => s.id === record.id);
    record.updatedAt = new Date().toISOString();
    if (idx >= 0) store.sessions[idx] = record;
    else store.sessions.push(record);
    store.sessions = store.sessions.slice(-200);
    await fs.mkdir(path.dirname(SESSION_STORE_PATH), { recursive: true });
    await fs.writeFile(SESSION_STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    console.warn("[BrowserSessionService] persist failed:", err);
  }
}

async function getBrowser(): Promise<Browser> {
  if (sharedBrowser?.isConnected()) return sharedBrowser;
  const { chromium } = await import("playwright-core");
  sharedBrowser = await chromium.launch({
    headless: true,
    executablePath: chromiumExecutable(),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  return sharedBrowser;
}

function startSweeper(): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, live] of liveSessions) {
      if (now > live.expiresAt) {
        void BrowserSessionService.close(id, live.record.userId, "expired");
      }
    }
  }, 30_000);
  sweepTimer.unref();
}

export class BrowserSessionService {
  static async create(input: {
    userId: string;
    conversationId?: string;
    allowedDomains?: string[];
  }): Promise<BrowserSessionRecord> {
    startSweeper();

    const activeForUser = [...liveSessions.values()].filter(
      (s) => s.record.userId === input.userId,
    );
    if (activeForUser.length >= MAX_SESSIONS_PER_USER) {
      throw new Error(`browser_session_limit:${MAX_SESSIONS_PER_USER}`);
    }

    const browser = await getBrowser();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, // iPhone-ish viewport by default
      userAgent: "ZED-AI-Browser/1.0 (+https://zed-ai.online)",
      acceptDownloads: true,
    });
    context.setDefaultTimeout(10_000);
    const page = await context.newPage();

    const now = new Date().toISOString();
    const record: BrowserSessionRecord = {
      id: `browser-${randomUUID()}`,
      userId: input.userId,
      conversationId: input.conversationId ?? null,
      status: "active",
      createdAt: now,
      updatedAt: now,
      allowedDomains: input.allowedDomains?.length
        ? input.allowedDomains.map((d) => d.toLowerCase())
        : null,
      stepCount: 0,
      actions: [],
      artifacts: [],
    };

    liveSessions.set(record.id, {
      record,
      context,
      page,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
    await persist(record);
    await logRuntimeEvent({
      level: "info",
      source: "server",
      event: "browser.session.created",
      detail: record.id,
      context: { userId: input.userId },
    });
    return record;
  }

  static getLive(sessionId: string, userId: string): LiveSession {
    const live = liveSessions.get(sessionId);
    if (!live) throw new Error("browser_session_not_found_or_closed");
    if (live.record.userId !== userId) throw new Error("browser_session_not_owned");
    if (live.record.status !== "active") throw new Error(`browser_session_${live.record.status}`);
    live.expiresAt = Date.now() + SESSION_TTL_MS; // touch on use
    return live;
  }

  /** Domain + SSRF policy for every navigation the session performs. */
  static async authorizeNavigation(record: BrowserSessionRecord, url: string): Promise<void> {
    const safety = await checkUrlSafety(url);
    if (!safety.safe) {
      // Loopback-only escape hatch for the local test fixture server.
      // Never enable in production.
      const loopbackOk =
        process.env.BROWSER_ALLOW_LOOPBACK_FOR_TESTS === "true" &&
        /^https?:\/\/127\.0\.0\.1[:/]/.test(url);
      if (!loopbackOk) throw new Error(`navigation_blocked:${safety.reason}`);
    }
    if (record.allowedDomains) {
      const host = new URL(url).hostname.toLowerCase();
      const allowed = record.allowedDomains.some(
        (d) => host === d || host.endsWith(`.${d}`),
      );
      if (!allowed) throw new Error(`navigation_blocked:domain_not_allowed:${host}`);
    }
  }

  static async recordAction(
    sessionId: string,
    entry: Omit<BrowserActionRecord, "step" | "at">,
  ): Promise<void> {
    const live = liveSessions.get(sessionId);
    if (!live) return;
    live.record.stepCount += 1;
    live.record.actions.push({
      ...entry,
      step: live.record.stepCount,
      at: new Date().toISOString(),
    });
    // Keep the persisted trace bounded but complete for the session cap.
    live.record.actions = live.record.actions.slice(-MAX_STEPS_PER_SESSION * 2);
    await persist(live.record);
  }

  static assertStepBudget(sessionId: string): void {
    const live = liveSessions.get(sessionId);
    if (live && live.record.stepCount >= MAX_STEPS_PER_SESSION) {
      throw new Error(`browser_step_limit:${MAX_STEPS_PER_SESSION}`);
    }
  }

  static async addArtifact(
    sessionId: string,
    artifact: { kind: "screenshot" | "download"; path: string },
  ): Promise<void> {
    const live = liveSessions.get(sessionId);
    if (!live) return;
    live.record.artifacts.push({ ...artifact, at: new Date().toISOString() });
    await persist(live.record);
  }

  static async close(
    sessionId: string,
    userId: string,
    finalStatus: "closed" | "expired" | "crashed" = "closed",
  ): Promise<BrowserSessionRecord | null> {
    const live = liveSessions.get(sessionId);
    if (!live) return null;
    if (live.record.userId !== userId) throw new Error("browser_session_not_owned");
    liveSessions.delete(sessionId);
    live.record.status = finalStatus;
    live.record.closedAt = new Date().toISOString();
    await live.context.close().catch(() => {});
    await persist(live.record);
    await logRuntimeEvent({
      level: "info",
      source: "server",
      event: `browser.session.${finalStatus}`,
      detail: sessionId,
      context: { userId },
    });
    return live.record;
  }

  static async getRecord(sessionId: string, userId: string): Promise<BrowserSessionRecord | null> {
    const live = liveSessions.get(sessionId);
    if (live) return live.record.userId === userId ? live.record : null;
    try {
      const raw = await fs.readFile(SESSION_STORE_PATH, "utf-8");
      const parsed: SessionStoreFile = JSON.parse(raw);
      const record = parsed.sessions.find((s) => s.id === sessionId);
      return record && record.userId === userId ? record : null;
    } catch {
      return null;
    }
  }

  static async listSessions(userId: string): Promise<BrowserSessionRecord[]> {
    const out = new Map<string, BrowserSessionRecord>();
    try {
      const raw = await fs.readFile(SESSION_STORE_PATH, "utf-8");
      const parsed: SessionStoreFile = JSON.parse(raw);
      for (const s of parsed.sessions) if (s.userId === userId) out.set(s.id, s);
    } catch {}
    for (const live of liveSessions.values()) {
      if (live.record.userId === userId) out.set(live.record.id, live.record);
    }
    return [...out.values()].slice(-20).reverse();
  }

  static screenshotDir(): string {
    return SCREENSHOT_DIR;
  }

  static downloadDir(): string {
    return DOWNLOAD_DIR;
  }

  /** Test/shutdown hook. */
  static async shutdown(): Promise<void> {
    for (const [id, live] of liveSessions) {
      await this.close(id, live.record.userId, "closed").catch(() => {});
    }
    if (sharedBrowser) {
      await sharedBrowser.close().catch(() => {});
      sharedBrowser = null;
    }
    if (sweepTimer) {
      clearInterval(sweepTimer);
      sweepTimer = null;
    }
  }
}

export default BrowserSessionService;
