/**
 * DocumentationContextService — ZAR's Documentation Context capability
 * (Context7-referenced).
 *
 * Architecture decision (recorded per implementation policy):
 *   Context7 is MIT-licensed but its value is the hosted index at
 *   context7.com, not the MCP server code. Running the index ourselves is
 *   not practical, so this is a thin *replaceable adapter* over the
 *   Context7 public HTTP API, hidden behind stable ZAR contracts
 *   (resolveLibrary / retrieveLibraryDocs / retrieveVersionSpecificDocs).
 *   Nothing outside this module sees Context7 response shapes. Swapping
 *   the provider means editing only the two `context7*` functions.
 *
 * Provider-unavailable is a first-class state — no fabricated docs, ever.
 */

import fs from "fs/promises";
import path from "path";

import { memoryCache } from "../../storage/cache";
import { safeFetch } from "../security/UrlSafetyGuard";
import { logRuntimeEvent } from "../RuntimeLogger";

const CONTEXT7_BASE = process.env.CONTEXT7_BASE_URL || "https://context7.com/api";
const DOCS_CACHE_TTL_MS = Number(process.env.DOCS_CACHE_TTL_MS || 30 * 60 * 1000);

export interface LibraryResolution {
  state: "resolved" | "ambiguous" | "not_found" | "provider_unavailable";
  query: string;
  /** Best match when state is resolved; candidates when ambiguous. */
  library?: ResolvedLibrary;
  candidates: ResolvedLibrary[];
  providerError?: string;
}

export interface ResolvedLibrary {
  /** Stable provider-neutral id, currently the Context7-compatible path e.g. "/vercel/next.js". */
  id: string;
  name: string;
  description?: string;
  trustScore?: number;
  snippetCount?: number;
  versions?: string[];
}

export interface DocsRetrieval {
  state: "ok" | "not_found" | "provider_unavailable";
  libraryId: string;
  requestedVersion?: string;
  resolvedVersion?: string;
  versionMatch: "exact" | "unversioned" | "mismatch" | "unknown";
  topic?: string;
  content?: string;
  source: string;
  retrievedAt: string;
  providerError?: string;
  cached: boolean;
}

interface Context7SearchResult {
  id: string;
  title: string;
  description?: string;
  trustScore?: number;
  totalSnippets?: number;
  versions?: string[];
}

function providerHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "X-Context7-Source": "zar" };
  const key = (process.env.CONTEXT7_API_KEY || "").trim();
  if (key) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function context7Search(query: string): Promise<Context7SearchResult[]> {
  const url = `${CONTEXT7_BASE}/v1/search?query=${encodeURIComponent(query)}`;
  const res = await safeFetch(url, { timeoutMs: 10_000, headers: providerHeaders() });
  if (!res.ok) throw new Error(`context7_search_http_${res.status}`);
  const data: any = await res.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  return results.map((r: any) => ({
    id: String(r.id || ""),
    title: String(r.title || r.id || ""),
    description: r.description ? String(r.description) : undefined,
    trustScore: typeof r.trustScore === "number" ? r.trustScore : undefined,
    totalSnippets: typeof r.totalSnippets === "number" ? r.totalSnippets : undefined,
    versions: Array.isArray(r.versions) ? r.versions.map(String) : undefined,
  }));
}

async function context7Docs(libraryId: string, opts: { topic?: string; tokens?: number } = {}): Promise<string> {
  const cleanId = libraryId.replace(/^\//, "");
  const params = new URLSearchParams({ type: "txt" });
  if (opts.topic) params.set("topic", opts.topic);
  if (opts.tokens) params.set("tokens", String(opts.tokens));
  const url = `${CONTEXT7_BASE}/v1/${cleanId}?${params.toString()}`;
  const res = await safeFetch(url, { timeoutMs: 15_000, headers: providerHeaders() });
  if (res.status === 404) throw new Error("context7_library_not_found");
  if (!res.ok) throw new Error(`context7_docs_http_${res.status}`);
  return await res.text();
}

/**
 * Resolve the installed version of a package from repository manifests —
 * package.json dependency ranges, then package-lock for exact pins.
 */
export async function resolveVersionFromManifests(
  packageName: string,
  projectDir: string,
): Promise<{ version?: string; source?: string }> {
  try {
    const lockPath = path.join(projectDir, "package-lock.json");
    const lock = JSON.parse(await fs.readFile(lockPath, "utf-8"));
    const entry =
      lock?.packages?.[`node_modules/${packageName}`] ||
      lock?.dependencies?.[packageName];
    if (entry?.version) return { version: String(entry.version), source: "package-lock.json" };
  } catch {}
  try {
    const pkgPath = path.join(projectDir, "package.json");
    const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
    const range =
      pkg?.dependencies?.[packageName] ||
      pkg?.devDependencies?.[packageName] ||
      pkg?.peerDependencies?.[packageName];
    if (range) return { version: String(range).replace(/^[\^~>=<]+/, ""), source: "package.json" };
  } catch {}
  return {};
}

export class DocumentationContextService {
  static async resolveLibrary(query: string): Promise<LibraryResolution> {
    const trimmed = query.trim();
    if (!trimmed) return { state: "not_found", query, candidates: [] };

    const cacheKey = `docs:resolve:${trimmed.toLowerCase()}`;
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;

    let results: Context7SearchResult[];
    try {
      results = await context7Search(trimmed);
    } catch (err: any) {
      return {
        state: "provider_unavailable",
        query: trimmed,
        candidates: [],
        providerError: err?.message || String(err),
      };
    }

    const candidates: ResolvedLibrary[] = results.slice(0, 5).map((r) => ({
      id: r.id,
      name: r.title,
      description: r.description,
      trustScore: r.trustScore,
      snippetCount: r.totalSnippets,
      versions: r.versions,
    }));

    let resolution: LibraryResolution;
    if (candidates.length === 0) {
      resolution = { state: "not_found", query: trimmed, candidates: [] };
    } else {
      const [best, second] = candidates;
      const exactName = candidates.find(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase() || c.id.toLowerCase().endsWith(`/${trimmed.toLowerCase()}`),
      );
      // Ambiguous when there's no exact-name match and the top two score
      // similarly — surface candidates instead of silently guessing.
      const ambiguous =
        !exactName &&
        second !== undefined &&
        (best.trustScore ?? 0) - (second.trustScore ?? 0) < 1;
      resolution = ambiguous
        ? { state: "ambiguous", query: trimmed, candidates }
        : { state: "resolved", query: trimmed, library: exactName || best, candidates };
    }

    memoryCache.set(cacheKey, resolution, DOCS_CACHE_TTL_MS);
    return resolution;
  }

  static async retrieveLibraryDocs(input: {
    libraryId: string;
    topic?: string;
    tokens?: number;
    requestedVersion?: string;
    refresh?: boolean;
  }): Promise<DocsRetrieval> {
    const { libraryId, topic, requestedVersion } = input;
    const tokens = Math.min(Math.max(input.tokens || 4000, 500), 20_000);
    const cacheKey = `docs:content:${libraryId}:${requestedVersion || ""}:${topic || ""}:${tokens}`;

    if (!input.refresh) {
      const cached = memoryCache.get(cacheKey);
      if (cached) return { ...cached, cached: true };
    }

    // Version-specific retrieval: Context7 encodes versions as
    // /org/project/version path segments when the library publishes them.
    let effectiveId = libraryId;
    let versionMatch: DocsRetrieval["versionMatch"] = "unversioned";
    let resolvedVersion: string | undefined;
    if (requestedVersion) {
      const resolution = await this.resolveLibrary(libraryId.split("/").pop() || libraryId);
      const versions =
        resolution.library?.versions ||
        resolution.candidates.find((c) => c.id === libraryId)?.versions ||
        [];
      const match = versions.find((v) => v === requestedVersion || v.startsWith(requestedVersion));
      if (match) {
        effectiveId = `${libraryId}/${match}`;
        versionMatch = "exact";
        resolvedVersion = match;
      } else if (versions.length > 0) {
        // The provider has versioned docs but not this version — say so
        // rather than silently substituting a different version.
        versionMatch = "mismatch";
      } else {
        versionMatch = "unknown";
      }
    }

    if (versionMatch === "mismatch") {
      return {
        state: "not_found",
        libraryId,
        requestedVersion,
        versionMatch,
        topic,
        source: `context7:${libraryId}`,
        retrievedAt: new Date().toISOString(),
        providerError: "requested_version_not_indexed",
        cached: false,
      };
    }

    try {
      const content = await context7Docs(effectiveId, { topic, tokens });
      const result: DocsRetrieval = {
        state: "ok",
        libraryId,
        requestedVersion,
        resolvedVersion,
        versionMatch,
        topic,
        content,
        source: `context7:${effectiveId}`,
        retrievedAt: new Date().toISOString(),
        cached: false,
      };
      memoryCache.set(cacheKey, result, DOCS_CACHE_TTL_MS);
      return result;
    } catch (err: any) {
      const message = err?.message || String(err);
      await logRuntimeEvent({
        level: "warn",
        source: "server",
        event: "documentation.retrieve.failed",
        detail: message,
        context: { libraryId: effectiveId },
      });
      return {
        state: message === "context7_library_not_found" ? "not_found" : "provider_unavailable",
        libraryId,
        requestedVersion,
        versionMatch,
        topic,
        source: `context7:${effectiveId}`,
        retrievedAt: new Date().toISOString(),
        providerError: message,
        cached: false,
      };
    }
  }

  /** One-call convenience: resolve name -> version-aware docs. */
  static async retrieveDocsForPackage(input: {
    packageName: string;
    topic?: string;
    version?: string;
    projectDir?: string;
  }): Promise<{ resolution: LibraryResolution; docs?: DocsRetrieval; versionSource?: string }> {
    const resolution = await this.resolveLibrary(input.packageName);
    if (resolution.state !== "resolved" || !resolution.library) {
      return { resolution };
    }
    let version = input.version;
    let versionSource: string | undefined;
    if (!version && input.projectDir) {
      const fromManifest = await resolveVersionFromManifests(input.packageName, input.projectDir);
      version = fromManifest.version;
      versionSource = fromManifest.source;
    }
    const docs = await this.retrieveLibraryDocs({
      libraryId: resolution.library.id,
      topic: input.topic,
      requestedVersion: version,
    });
    return { resolution, docs, versionSource };
  }

  /** Health check used by the capability registry. */
  static async health(): Promise<{ available: boolean; detail?: string }> {
    try {
      const res = await safeFetch(`${CONTEXT7_BASE}/v1/search?query=react`, {
        timeoutMs: 6_000,
        headers: providerHeaders(),
      });
      return { available: res.ok, detail: res.ok ? undefined : `http_${res.status}` };
    } catch (err: any) {
      return { available: false, detail: err?.message || String(err) };
    }
  }
}

export function formatDocsForPrompt(docs: DocsRetrieval): string {
  if (docs.state !== "ok" || !docs.content) {
    return `Documentation for ${docs.libraryId} is unavailable (${docs.state}${docs.providerError ? `: ${docs.providerError}` : ""}). Do not invent documentation; say the docs provider is unavailable if asked.`;
  }
  return [
    `## Current documentation: ${docs.libraryId}${docs.resolvedVersion ? ` v${docs.resolvedVersion}` : ""}`,
    `Source: ${docs.source} | Retrieved: ${docs.retrievedAt} | Version match: ${docs.versionMatch}`,
    docs.topic ? `Topic: ${docs.topic}` : "",
    "Treat this as current, version-aware reference material and cite the source when using it.",
    docs.content.slice(0, 24_000),
  ]
    .filter(Boolean)
    .join("\n");
}

export default DocumentationContextService;
