/**
 * WebResearchJobService
 *
 * Job lifecycle + citation record for structured web research (single
 * fetch or bounded crawl). Mirrors the existing execution layer's
 * JSON-backed job persistence (TaskLifecycleManager) rather than
 * introducing a second queue technology — this IS that pattern, applied
 * to the web-research domain.
 *
 * States: requested -> running -> completed | partial | failed | cancelled
 *
 * When `addToKnowledge` is requested, every retrieved page is pushed
 * through the existing KnowledgeIngestionService so it becomes queryable,
 * cited graph knowledge instead of a one-shot fetch — no parallel
 * knowledge store.
 */

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

import { HUB_SHARED_MEMORY_DIR } from "../../utils/repoPaths";
import { logRuntimeEvent } from "../RuntimeLogger";
import {
  crawlSite,
  fetchWebTargetsFromText,
  type CrawlResult,
  type WebFetchResponse,
} from "../WebContentService";
import { KnowledgeIngestionService } from "../knowledge-ingestion/KnowledgeIngestionService";

const JOB_STORE_PATH = path.resolve(HUB_SHARED_MEMORY_DIR, "research/web-research-jobs.json");

export type ResearchJobKind = "fetch" | "crawl";
export type ResearchJobStatus =
  | "requested"
  | "authorized"
  | "queued"
  | "running"
  | "partial"
  | "completed"
  | "failed"
  | "cancelled";

export interface ResearchCitation {
  url: string;
  canonicalUrl?: string;
  title?: string;
  retrievedAt: string;
  contentHash?: string;
}

export interface ResearchJobRecord {
  id: string;
  kind: ResearchJobKind;
  status: ResearchJobStatus;
  userId: string;
  conversationId?: string | null;
  projectId?: string | null;
  workspaceId?: string | null;
  input: { url?: string; text?: string; maxPages?: number; maxDepth?: number };
  addToKnowledge: boolean;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  citations: ResearchCitation[];
  pageCount: number;
  errorCount: number;
  errors: Array<{ url: string; error: string }>;
  knowledgeImportIds: string[];
  failureReason?: string;
}

interface JobStoreFile {
  version: string;
  jobs: ResearchJobRecord[];
}

const abortControllers = new Map<string, AbortController>();

async function readStore(): Promise<JobStoreFile> {
  try {
    const raw = await fs.readFile(JOB_STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.jobs)) return parsed as JobStoreFile;
  } catch {}
  return { version: "1.0", jobs: [] };
}

async function writeStore(store: JobStoreFile): Promise<void> {
  await fs.mkdir(path.dirname(JOB_STORE_PATH), { recursive: true });
  // Keep the file bounded — this is an audit trail, not infinite storage.
  store.jobs = store.jobs.slice(-500);
  await fs.writeFile(JOB_STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

async function upsert(job: ResearchJobRecord): Promise<ResearchJobRecord> {
  const store = await readStore();
  const idx = store.jobs.findIndex((j) => j.id === job.id);
  job.updatedAt = new Date().toISOString();
  if (idx >= 0) store.jobs[idx] = job;
  else store.jobs.push(job);
  await writeStore(store);
  return job;
}

function citationsFromCrawl(result: CrawlResult): ResearchCitation[] {
  return result.pages.map((page) => ({
    url: page.url,
    canonicalUrl: page.canonicalUrl,
    title: page.title,
    retrievedAt: page.fetchedAt || new Date().toISOString(),
    contentHash: page.contentHash,
  }));
}

function citationsFromFetch(result: WebFetchResponse): ResearchCitation[] {
  return result.pages.map((page) => ({
    url: page.url,
    title: page.title,
    retrievedAt: page.fetchedAt || new Date().toISOString(),
  }));
}

async function ingestPages(
  pages: Array<{ url: string; canonicalUrl?: string; title?: string; text: string; fetchedAt?: string }>,
  ctx: { userId: string; conversationId?: string | null; jobId: string },
): Promise<string[]> {
  const importIds: string[] = [];
  for (const page of pages) {
    if (!page.text || page.text.trim().length < 120) continue;
    try {
      const report = await KnowledgeIngestionService.ingest({
        sourceName: page.title || page.url,
        sourceUri: page.canonicalUrl || page.url,
        contentType: "article",
        content: page.text,
        createdAt: page.fetchedAt,
        metadata: {
          webResearch: true,
          jobId: ctx.jobId,
          conversationId: ctx.conversationId,
          userId: ctx.userId,
          url: page.url,
        },
      });
      importIds.push(report.importId);
    } catch {
      // Best-effort — a knowledge-ingestion failure must not fail the job.
    }
  }
  return importIds;
}

export interface StartFetchInput {
  userId: string;
  text: string;
  conversationId?: string;
  projectId?: string;
  workspaceId?: string;
  addToKnowledge?: boolean;
}

export interface StartCrawlInput {
  userId: string;
  url: string;
  conversationId?: string;
  projectId?: string;
  workspaceId?: string;
  maxPages?: number;
  maxDepth?: number;
  sameDomainOnly?: boolean;
  addToKnowledge?: boolean;
}

export class WebResearchJobService {
  static async getJob(id: string): Promise<ResearchJobRecord | null> {
    const store = await readStore();
    return store.jobs.find((j) => j.id === id) || null;
  }

  static async listJobs(userId: string, limit = 20): Promise<ResearchJobRecord[]> {
    const store = await readStore();
    return store.jobs
      .filter((j) => j.userId === userId)
      .slice()
      .reverse()
      .slice(0, limit);
  }

  static async cancel(id: string, userId: string): Promise<ResearchJobRecord | null> {
    const job = await this.getJob(id);
    if (!job || job.userId !== userId) return null;
    if (["completed", "failed", "cancelled"].includes(job.status)) return job;
    abortControllers.get(id)?.abort();
    job.status = "cancelled";
    job.completedAt = new Date().toISOString();
    return upsert(job);
  }

  /** Direct-URL fetch extracted from free text — synchronous, bounded, small. */
  static async runFetch(input: StartFetchInput): Promise<ResearchJobRecord> {
    const now = new Date().toISOString();
    let job: ResearchJobRecord = {
      id: `webresearch-${randomUUID()}`,
      kind: "fetch",
      status: "running",
      userId: input.userId,
      conversationId: input.conversationId ?? null,
      projectId: input.projectId ?? null,
      workspaceId: input.workspaceId ?? null,
      input: { text: input.text },
      addToKnowledge: Boolean(input.addToKnowledge),
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      citations: [],
      pageCount: 0,
      errorCount: 0,
      errors: [],
      knowledgeImportIds: [],
    };
    job = await upsert(job);

    try {
      const result = await fetchWebTargetsFromText(input.text);
      job.citations = citationsFromFetch(result);
      job.pageCount = result.pages.length;
      job.errors = result.errors;
      job.errorCount = result.errors.length;
      if (input.addToKnowledge && result.pages.length > 0) {
        job.knowledgeImportIds = await ingestPages(result.pages, {
          userId: input.userId,
          conversationId: input.conversationId,
          jobId: job.id,
        });
      }
      job.status = result.pages.length === 0 && result.errors.length > 0 ? "failed" : result.errors.length > 0 ? "partial" : "completed";
      job.completedAt = new Date().toISOString();
      return upsert(job);
    } catch (err: any) {
      job.status = "failed";
      job.failureReason = err?.message || String(err);
      job.completedAt = new Date().toISOString();
      return upsert(job);
    }
  }

  /**
   * Bounded crawl — runs in the background so the caller gets a job id
   * immediately and polls status. A stored AbortController makes
   * cancellation real, not cosmetic.
   */
  static async startCrawl(input: StartCrawlInput): Promise<ResearchJobRecord> {
    const now = new Date().toISOString();
    let job: ResearchJobRecord = {
      id: `webresearch-${randomUUID()}`,
      kind: "crawl",
      status: "queued",
      userId: input.userId,
      conversationId: input.conversationId ?? null,
      projectId: input.projectId ?? null,
      workspaceId: input.workspaceId ?? null,
      input: { url: input.url, maxPages: input.maxPages, maxDepth: input.maxDepth },
      addToKnowledge: Boolean(input.addToKnowledge),
      createdAt: now,
      updatedAt: now,
      citations: [],
      pageCount: 0,
      errorCount: 0,
      errors: [],
      knowledgeImportIds: [],
    };
    job = await upsert(job);

    const controller = new AbortController();
    abortControllers.set(job.id, controller);

    void this.executeCrawl(job.id, input, controller.signal).finally(() => {
      abortControllers.delete(job.id);
    });

    return job;
  }

  private static async executeCrawl(jobId: string, input: StartCrawlInput, signal: AbortSignal): Promise<void> {
    let job = await this.getJob(jobId);
    if (!job) return;
    job.status = "running";
    job.startedAt = new Date().toISOString();
    job = await upsert(job);

    try {
      const result = await crawlSite(input.url, {
        maxPages: input.maxPages,
        maxDepth: input.maxDepth,
        sameDomainOnly: input.sameDomainOnly,
        signal,
      });

      job = (await this.getJob(jobId)) || job;
      if (job.status === "cancelled") return;

      job.citations = citationsFromCrawl(result);
      job.pageCount = result.pages.length;
      job.errors = result.errors.slice(0, 30);
      job.errorCount = result.errors.length;

      if (input.addToKnowledge && result.pages.length > 0) {
        job.knowledgeImportIds = await ingestPages(result.pages, {
          userId: input.userId,
          conversationId: input.conversationId,
          jobId: job.id,
        });
      }

      job.status =
        result.pages.length === 0
          ? "failed"
          : result.errors.length > 0 || result.truncatedReason
            ? "partial"
            : "completed";
      job.completedAt = new Date().toISOString();
      await upsert(job);
    } catch (err: any) {
      const current = (await this.getJob(jobId)) || job;
      if (current.status === "cancelled") return;
      current.status = "failed";
      current.failureReason = err?.message || String(err);
      current.completedAt = new Date().toISOString();
      await upsert(current);
    }

    await logRuntimeEvent({
      level: "info",
      source: "server",
      event: "web_research.crawl.finished",
      detail: `Job ${jobId} finished`,
      context: { jobId },
    });
  }
}

export default WebResearchJobService;
