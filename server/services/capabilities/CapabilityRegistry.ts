/**
 * CapabilityRegistry — single source of truth for ZAR's executable
 * capabilities (documentation, files, web research, browser). Serves both
 * backend execution metadata and NEXUS discovery via /api/capabilities,
 * so tool descriptions are never duplicated between frontend and backend.
 *
 * The client-side NexusCapabilityRegistry remains the authority for
 * NAVIGATION capabilities; this registry is the runtime/tool authority
 * the Nexus docs assign to the backend Kernel boundary.
 */

import { DocumentationContextService } from "../documentation/DocumentationContextService";
import { getWebSearchStatus } from "../WebSearchService";
import fs from "fs";

export type CapabilityCategory =
  | "documentation"
  | "files"
  | "web_research"
  | "browser_observation"
  | "browser_action"
  | "browser_agent";

export type CapabilityRisk = "observation" | "reversible" | "consequential";
export type ApprovalPolicy = "none" | "owner" | "explicit_approval";

export interface CapabilityDefinition {
  id: string;
  name: string;
  description: string;
  category: CapabilityCategory;
  inputSchema: Record<string, string>;
  outputSchema: Record<string, string>;
  requiredPermission: "authenticated" | "admin";
  risk: CapabilityRisk;
  approvalPolicy: ApprovalPolicy;
  executionMode: "sync" | "async_job" | "session";
  timeoutMs: number;
  retryPolicy: { maxRetries: number };
  provider: string;
  route: string;
  audit: "runtime_log" | "session_trace" | "job_record";
  artifactBehavior: "none" | "files" | "screenshots_and_downloads";
}

export const CAPABILITIES: CapabilityDefinition[] = [
  {
    id: "documentation.resolve_library",
    name: "Resolve library",
    description: "Resolve a package/library name to a documentation identity, detecting ambiguity instead of guessing.",
    category: "documentation",
    inputSchema: { query: "string" },
    outputSchema: { state: "resolved|ambiguous|not_found|provider_unavailable", candidates: "ResolvedLibrary[]" },
    requiredPermission: "authenticated",
    risk: "observation",
    approvalPolicy: "none",
    executionMode: "sync",
    timeoutMs: 10_000,
    retryPolicy: { maxRetries: 1 },
    provider: "context7-adapter",
    route: "POST /api/documentation/resolve",
    audit: "runtime_log",
    artifactBehavior: "none",
  },
  {
    id: "documentation.retrieve_library_docs",
    name: "Retrieve library docs",
    description: "Retrieve current, version-aware documentation passages with source citations; never substitutes versions silently.",
    category: "documentation",
    inputSchema: { libraryId: "string?", packageName: "string?", topic: "string?", version: "string?" },
    outputSchema: { docs: "DocsRetrieval", prompt: "string" },
    requiredPermission: "authenticated",
    risk: "observation",
    approvalPolicy: "none",
    executionMode: "sync",
    timeoutMs: 15_000,
    retryPolicy: { maxRetries: 1 },
    provider: "context7-adapter",
    route: "POST /api/documentation/retrieve",
    audit: "runtime_log",
    artifactBehavior: "none",
  },
  {
    id: "files.ingest_upload",
    name: "Ingest uploaded file",
    description: "Convert an uploaded file (PDF/DOCX/XLSX/PPTX/CSV/text/zip/images) into normalized content with structure, checksum dedup, and Knowledge-graph ingestion.",
    category: "files",
    inputSchema: { files: "multipart", conversationId: "string" },
    outputSchema: { files: "File[] (status, conversionStatus, parserUsed, structuralMeta)" },
    requiredPermission: "authenticated",
    risk: "reversible",
    approvalPolicy: "owner",
    executionMode: "sync",
    timeoutMs: 120_000,
    retryPolicy: { maxRetries: 0 },
    provider: "native (pdf-parse, mammoth, xlsx, yauzl)",
    route: "POST /api/conversations/:id/upload",
    audit: "runtime_log",
    artifactBehavior: "files",
  },
  {
    id: "web_research.fetch_url",
    name: "Fetch URL",
    description: "SSRF-guarded, robots-respecting single-page fetch with normalized text and citation record.",
    category: "web_research",
    inputSchema: { url: "string", addToKnowledge: "boolean?" },
    outputSchema: { job: "ResearchJobRecord (citations, status)" },
    requiredPermission: "authenticated",
    risk: "observation",
    approvalPolicy: "none",
    executionMode: "sync",
    timeoutMs: 30_000,
    retryPolicy: { maxRetries: 1 },
    provider: "native WebContentService",
    route: "POST /api/web-research/fetch",
    audit: "job_record",
    artifactBehavior: "none",
  },
  {
    id: "web_research.crawl_site",
    name: "Crawl site (bounded)",
    description: "Breadth-first same-origin crawl with depth/page/time limits, dedup, canonical URLs, cancellation, and optional Knowledge ingestion.",
    category: "web_research",
    inputSchema: { url: "string", maxPages: "number<=25", maxDepth: "number<=4", addToKnowledge: "boolean?" },
    outputSchema: { job: "ResearchJobRecord" },
    requiredPermission: "authenticated",
    risk: "observation",
    approvalPolicy: "none",
    executionMode: "async_job",
    timeoutMs: 60_000,
    retryPolicy: { maxRetries: 0 },
    provider: "native WebContentService",
    route: "POST /api/web-research/crawl",
    audit: "job_record",
    artifactBehavior: "none",
  },
  {
    id: "browser.session",
    name: "Browser session",
    description: "Isolated, owned, expiring Chromium context with domain restrictions and a persisted action trace.",
    category: "browser_observation",
    inputSchema: { allowedDomains: "string[]?" },
    outputSchema: { session: "BrowserSessionRecord" },
    requiredPermission: "authenticated",
    risk: "observation",
    approvalPolicy: "owner",
    executionMode: "session",
    timeoutMs: 600_000,
    retryPolicy: { maxRetries: 0 },
    provider: "playwright-core + system chromium",
    route: "POST /api/browser/sessions",
    audit: "session_trace",
    artifactBehavior: "screenshots_and_downloads",
  },
  {
    id: "browser.action",
    name: "Typed browser action",
    description: "Validated typed actions (navigate/inspect/click/type/select/scroll/wait/screenshot/extract/download/upload/submit). Consequential actions (submit, upload) hard-require an approved execution task.",
    category: "browser_action",
    inputSchema: { sessionId: "string", action: "BrowserActionName", selector: "string?", approvalTaskId: "string (consequential)" },
    outputSchema: { result: "BrowserActionResult" },
    requiredPermission: "authenticated",
    risk: "consequential",
    approvalPolicy: "explicit_approval",
    executionMode: "session",
    timeoutMs: 30_000,
    retryPolicy: { maxRetries: 0 },
    provider: "playwright-core + system chromium",
    route: "POST /api/browser/sessions/:id/actions",
    audit: "session_trace",
    artifactBehavior: "screenshots_and_downloads",
  },
  {
    id: "browser.operator",
    name: "Goal-directed browser operator",
    description: "Bounded plan/act/observe loop over typed browser actions; verifies completion from page state, pauses for approval on consequential steps, hard step/time budgets.",
    category: "browser_agent",
    inputSchema: { goal: "string", startUrl: "string", maxSteps: "number<=30" },
    outputSchema: { task: "OperatorTaskRecord (steps, verification, blockers)" },
    requiredPermission: "authenticated",
    risk: "consequential",
    approvalPolicy: "explicit_approval",
    executionMode: "async_job",
    timeoutMs: 180_000,
    retryPolicy: { maxRetries: 0 },
    provider: "native operator over playwright-core",
    route: "POST /api/browser/operator/tasks",
    audit: "job_record",
    artifactBehavior: "screenshots_and_downloads",
  },
];

export interface CapabilityHealth {
  id: string;
  available: boolean;
  detail?: string;
}

export class CapabilityRegistry {
  static list(): CapabilityDefinition[] {
    return CAPABILITIES;
  }

  static get(id: string): CapabilityDefinition | undefined {
    return CAPABILITIES.find((c) => c.id === id);
  }

  static async health(): Promise<CapabilityHealth[]> {
    const results: CapabilityHealth[] = [];

    const docs = await DocumentationContextService.health();
    for (const id of ["documentation.resolve_library", "documentation.retrieve_library_docs"]) {
      results.push({ id, available: docs.available, detail: docs.detail });
    }

    results.push({ id: "files.ingest_upload", available: true });

    const search = getWebSearchStatus();
    const webNote = search.braveConfigured || search.serperConfigured ? undefined : "search keys missing; direct fetch/crawl still available";
    results.push({ id: "web_research.fetch_url", available: true, detail: webNote });
    results.push({ id: "web_research.crawl_site", available: true, detail: webNote });

    const chromiumPath = (process.env.BROWSER_EXECUTABLE_PATH || "").trim();
    const browsersDir = (process.env.PLAYWRIGHT_BROWSERS_PATH || "").trim();
    const browserAvailable = Boolean(
      (chromiumPath && fs.existsSync(chromiumPath)) || (browsersDir && fs.existsSync(browsersDir)),
    );
    const browserDetail = browserAvailable ? undefined : "no chromium executable configured (BROWSER_EXECUTABLE_PATH / PLAYWRIGHT_BROWSERS_PATH)";
    for (const id of ["browser.session", "browser.action", "browser.operator"]) {
      results.push({ id, available: browserAvailable, detail: browserDetail });
    }

    return results;
  }
}

export default CapabilityRegistry;
