import fs from "fs/promises";
import path from "path";
import { execFile as execFileCb } from "child_process";
import { promisify } from "util";

import { HUB_SHARED_MEMORY_DIR, REPO_ROOT } from "../utils/repoPaths";

const execFile = promisify(execFileCb);

const REGISTRY_PATH = path.resolve(
  HUB_SHARED_MEMORY_DIR,
  "consensus/foundation/zync-coding-operator/capabilities.json",
);

const LIVE_HANDLERS = new Set([
  "repoScan",
  "codeSearch",
  "impactReview",
  "verificationRun",
  "githubBranchHygiene",
]);

const IGNORED_DIRS = new Set([
  ".git",
  ".cache",
  ".netlify",
  "coverage",
  "dist",
  "node_modules",
  "storage",
]);

const SOURCE_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
  ".toml",
  ".yaml",
  ".yml",
]);

const MAX_SEARCH_FILE_BYTES = 650_000;

type CommandResult = {
  ok: boolean;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
};

type RegistryCapability = {
  id: string;
  name: string;
  handler: string;
  riskTier: "low" | "medium" | "high" | "critical";
  route: string;
  description: string;
  inputs: string[];
  outputs: string[];
  wired?: boolean;
};

type Registry = {
  version: string;
  brand: string;
  directoryType: string;
  futureExtractionTarget: string;
  loadedBy: string;
  capabilities: RegistryCapability[];
};

type SearchMatch = {
  path: string;
  line?: number;
  matchType: "filename" | "content";
  excerpt: string;
};

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const VERIFICATION_JOBS: Record<
  string,
  { label: string; cwd: string; command: string; args: string[]; timeoutMs: number }
> = {
  "client-build": {
    label: "Client build",
    cwd: path.resolve(REPO_ROOT, "client"),
    command: npmCommand,
    args: ["run", "build"],
    timeoutMs: 120_000,
  },
  "server-smoke": {
    label: "Server smoke check",
    cwd: path.resolve(REPO_ROOT, "server"),
    command: npmCommand,
    args: ["run", "smoke"],
    timeoutMs: 120_000,
  },
  "execution-verify": {
    label: "Execution verification",
    cwd: path.resolve(REPO_ROOT, "server"),
    command: npmCommand,
    args: ["run", "verify:execution"],
    timeoutMs: 120_000,
  },
};

function toText(value: unknown): string {
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function trimOutput(value: string, limit = 12_000): string {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}\n...[truncated ${value.length - limit} chars]`;
}

async function runCommand(
  command: string,
  args: string[],
  opts?: { cwd?: string; timeoutMs?: number },
): Promise<CommandResult> {
  const startedAt = Date.now();
  try {
    const result = await execFile(command, args, {
      cwd: opts?.cwd || REPO_ROOT,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      timeout: opts?.timeoutMs || 30_000,
      windowsHide: true,
    });

    return {
      ok: true,
      command: [command, ...args].join(" "),
      exitCode: 0,
      stdout: trimOutput(toText(result.stdout)),
      stderr: trimOutput(toText(result.stderr)),
      durationMs: Date.now() - startedAt,
    };
  } catch (err: any) {
    return {
      ok: false,
      command: [command, ...args].join(" "),
      exitCode: typeof err?.code === "number" ? err.code : 1,
      stdout: trimOutput(toText(err?.stdout)),
      stderr: trimOutput(toText(err?.stderr || err?.message)),
      durationMs: Date.now() - startedAt,
    };
  }
}

async function runGit(args: string[]): Promise<CommandResult> {
  return runCommand("git", args, { cwd: REPO_ROOT, timeoutMs: 20_000 });
}

function relativeFromRepo(absolutePath: string): string {
  return path.relative(REPO_ROOT, absolutePath).replace(/\\/g, "/");
}

function resolveRepoPath(input: string): string {
  const cleaned = String(input || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const resolved = path.resolve(REPO_ROOT, cleaned);
  if (!resolved.toLowerCase().startsWith(REPO_ROOT.toLowerCase())) {
    throw new Error(`Path escapes repository: ${input}`);
  }
  return resolved;
}

function shouldSkipDirectory(name: string, absolutePath: string): boolean {
  if (IGNORED_DIRS.has(name)) return true;
  const rel = relativeFromRepo(absolutePath);
  return (
    rel.startsWith("zed-memory/storage/") ||
    rel.startsWith("hub/user-memory/") ||
    rel.startsWith("hub/shared-memory/semantic/foundation/")
  );
}

function isSearchableFile(file: string): boolean {
  return SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase());
}

async function walkSearchableFiles(
  root: string,
  opts?: { maxFiles?: number },
): Promise<string[]> {
  const output: string[] = [];
  const maxFiles = opts?.maxFiles || 3_500;

  async function visit(dir: string): Promise<void> {
    if (output.length >= maxFiles) return;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
      if (output.length >= maxFiles) return;
      const absolutePath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!shouldSkipDirectory(entry.name, absolutePath)) {
          await visit(absolutePath);
        }
        continue;
      }

      if (!entry.isFile() || !isSearchableFile(entry.name)) continue;
      const stat = await fs.stat(absolutePath).catch(() => null);
      if (!stat || stat.size > MAX_SEARCH_FILE_BYTES) continue;
      output.push(absolutePath);
    }
  }

  await visit(root);
  return output;
}

async function readPackageScripts() {
  const files = ["package.json", "client/package.json", "server/package.json", "shared/package.json"];
  const scripts: Record<string, Record<string, string>> = {};

  for (const file of files) {
    try {
      const raw = await fs.readFile(path.resolve(REPO_ROOT, file), "utf8");
      const parsed = JSON.parse(raw);
      scripts[file] = parsed?.scripts || {};
    } catch {
      scripts[file] = {};
    }
  }

  return scripts;
}

function termsFor(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .slice(0, 8);
}

function lineExcerpt(line: string): string {
  const normalized = line.replace(/\s+/g, " ").trim();
  return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized;
}

function riskFor(paths: string[], referenceCount: number): "low" | "medium" | "high" {
  const highImpact = paths.some((file) =>
    /^(server\/(index|routes)\.ts|server\/routes-modules\/|server\/services\/|shared\/|client\/src\/App\.tsx|server\/core\.memory\.json)/.test(file),
  );
  if (highImpact) return "high";
  if (referenceCount > 10 || paths.some((file) => file.startsWith("client/src/pages/"))) return "medium";
  return "low";
}

function verificationFor(paths: string[]): string[] {
  const jobs = new Set<string>();
  if (paths.some((file) => file.startsWith("client/"))) jobs.add("client-build");
  if (paths.some((file) => file.startsWith("server/") || file.startsWith("shared/"))) jobs.add("server-smoke");
  if (paths.some((file) => file.includes("execution") || file.includes("routes-modules"))) {
    jobs.add("execution-verify");
  }
  if (jobs.size === 0) jobs.add("client-build");
  return Array.from(jobs);
}

type GhJsonResult<T> = {
  ok: boolean;
  value?: T;
  error?: CommandResult;
};

async function parseGhJson<T>(args: string[]): Promise<GhJsonResult<T>> {
  const result = await runCommand("gh", args, { cwd: REPO_ROOT, timeoutMs: 40_000 });
  if (!result.ok) return { ok: false, error: result };
  try {
    return { ok: true, value: JSON.parse(result.stdout) as T };
  } catch {
    return {
      ok: false,
      error: { ...result, ok: false, exitCode: 1, stderr: "GitHub CLI returned non-JSON output." },
    };
  }
}

export class ZyncCodingOperatorService {
  static async loadRegistry(): Promise<Registry> {
    const raw = await fs.readFile(REGISTRY_PATH, "utf8");
    const registry = JSON.parse(raw) as Registry;
    return {
      ...registry,
      capabilities: (registry.capabilities || []).map((capability) => ({
        ...capability,
        wired: LIVE_HANDLERS.has(capability.handler),
      })),
    };
  }

  static verificationJobs() {
    return Object.entries(VERIFICATION_JOBS).map(([id, job]) => ({
      id,
      label: job.label,
      command: [job.command, ...job.args].join(" "),
      cwd: relativeFromRepo(job.cwd),
    }));
  }

  static async repoScan() {
    const [registry, status, branch, head, remotes, scripts] = await Promise.all([
      this.loadRegistry(),
      runGit(["status", "--short", "--branch"]),
      runGit(["branch", "--show-current"]),
      runGit(["rev-parse", "HEAD"]),
      runGit(["remote", "-v"]),
      readPackageScripts(),
    ]);

    const importantDirectories = await Promise.all(
      ["client", "server", "shared", "hub/shared-memory", "hub/shared-memory/consensus/foundation/zync-coding-operator"].map(
        async (dir) => ({
          path: dir,
          exists: !!(await fs.stat(path.resolve(REPO_ROOT, dir)).catch(() => null)),
        }),
      ),
    );

    return {
      executed: true,
      providerStatus: "local_repo",
      git: {
        status: status.stdout.trim(),
        currentBranch: branch.stdout.trim(),
        head: head.stdout.trim(),
        remotes: remotes.stdout.trim().split(/\r?\n/).filter(Boolean),
      },
      packageScripts: scripts,
      importantDirectories,
      memoryRegistry: registry,
      verificationJobs: this.verificationJobs(),
    };
  }

  static async codeSearch(input: { query: string; limit?: number }) {
    const query = String(input.query || "").trim();
    if (!query) throw new Error("query is required");

    const limit = Math.max(1, Math.min(Number(input.limit) || 25, 100));
    const lowered = query.toLowerCase();
    const terms = termsFor(query);
    const files = await walkSearchableFiles(REPO_ROOT);
    const matches: SearchMatch[] = [];

    for (const file of files) {
      if (matches.length >= limit) break;
      const rel = relativeFromRepo(file);
      const relLower = rel.toLowerCase();

      if (relLower.includes(lowered) || terms.every((term) => relLower.includes(term))) {
        matches.push({ path: rel, matchType: "filename", excerpt: rel });
        if (matches.length >= limit) break;
      }

      const raw = await fs.readFile(file, "utf8").catch(() => "");
      const lines = raw.split(/\r?\n/);

      for (let i = 0; i < lines.length; i += 1) {
        if (matches.length >= limit) break;
        const line = lines[i];
        const lowerLine = line.toLowerCase();
        if (lowerLine.includes(lowered) || terms.every((term) => lowerLine.includes(term))) {
          matches.push({
            path: rel,
            line: i + 1,
            matchType: "content",
            excerpt: lineExcerpt(line),
          });
        }
      }
    }

    return {
      executed: true,
      providerStatus: "local_repo",
      query,
      searchedFiles: files.length,
      limit,
      matches,
      truncated: matches.length >= limit,
    };
  }

  static async impactReview(input: { paths?: string[]; query?: string }) {
    const explicitPaths = Array.isArray(input.paths)
      ? input.paths.map((item) => String(item).trim()).filter(Boolean)
      : [];
    let targetPaths = explicitPaths;

    if (!targetPaths.length && input.query?.trim()) {
      const search = await this.codeSearch({ query: input.query, limit: 12 });
      targetPaths = Array.from(new Set(search.matches.map((match) => match.path))).slice(0, 8);
    }

    if (!targetPaths.length) throw new Error("Provide paths or a query to review");

    const targets = [];
    const referenceTerms = new Set<string>();

    for (const target of targetPaths) {
      const absolute = resolveRepoPath(target);
      const stat = await fs.stat(absolute).catch(() => null);
      const rel = relativeFromRepo(absolute);
      const stem = path.basename(rel, path.extname(rel));
      if (stem.length >= 3) referenceTerms.add(stem);
      referenceTerms.add(rel);
      targets.push({
        path: rel,
        exists: !!stat,
        type: stat?.isDirectory() ? "directory" : stat?.isFile() ? "file" : "missing",
        bytes: stat?.isFile() ? stat.size : undefined,
      });
    }

    const references: SearchMatch[] = [];
    for (const term of Array.from(referenceTerms).slice(0, 10)) {
      const result = await this.codeSearch({ query: term, limit: 18 });
      for (const match of result.matches) {
        if (!targetPaths.includes(match.path)) references.push(match);
      }
    }

    const dedupedReferences = Array.from(
      new Map(references.map((ref) => [`${ref.path}:${ref.line || 0}:${ref.excerpt}`, ref])).values(),
    ).slice(0, 50);
    const allPaths = Array.from(new Set([...targets.map((t) => t.path), ...dedupedReferences.map((r) => r.path)]));

    return {
      executed: true,
      providerStatus: "local_repo",
      targets,
      references: dedupedReferences,
      risk: {
        level: riskFor(targets.map((target) => target.path), dedupedReferences.length),
        referenceCount: dedupedReferences.length,
        missingTargets: targets.filter((target) => !target.exists).map((target) => target.path),
      },
      verification: verificationFor(allPaths),
    };
  }

  static async runVerification(input: { job: string }) {
    const jobId = String(input.job || "").trim();
    const job = VERIFICATION_JOBS[jobId];
    if (!job) {
      throw new Error(`Unsupported verification job: ${jobId || "(empty)"}`);
    }

    const result = await runCommand(job.command, job.args, {
      cwd: job.cwd,
      timeoutMs: job.timeoutMs,
    });

    return {
      executed: true,
      providerStatus: "local_process",
      job: { id: jobId, label: job.label },
      ...result,
    };
  }

  static async githubBranches() {
    type GhRef = { ref: string; object?: { sha?: string; type?: string } };
    const repo = process.env.GITHUB_REPOSITORY || "xoclonholdings/ZedAI";
    const refs = await parseGhJson<GhRef[]>(["api", `repos/${repo}/git/matching-refs/heads`]);
    if (!refs.ok || !refs.value) {
      return {
        executed: false,
        providerStatus: "disabled",
        error: refs.error?.stderr || refs.error?.stdout || "GitHub CLI is unavailable",
        remoteHeads: [],
        policy: { allowed: ["main", "backup"], compliant: false, extras: [] },
      };
    }

    const remoteHeads = refs.value
      .map((ref) => ({
        name: ref.ref.replace(/^refs\/heads\//, ""),
        sha: ref.object?.sha || "",
        type: ref.object?.type || "unknown",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const names = remoteHeads.map((head) => head.name);
    const extras = names.filter((name) => !["main", "backup"].includes(name));

    return {
      executed: true,
      providerStatus: "github_cli",
      remoteHeads,
      policy: {
        allowed: ["main", "backup"],
        compliant: extras.length === 0 && names.includes("main") && names.includes("backup"),
        extras,
      },
    };
  }

  static async refreshGithubBackup(input: { confirm: string }) {
    const confirm = String(input.confirm || "").trim();
    if (confirm !== "refresh backup to current main") {
      throw new Error('Confirmation must equal "refresh backup to current main"');
    }

    type GhRef = { object?: { sha?: string } };
    const repo = process.env.GITHUB_REPOSITORY || "xoclonholdings/ZedAI";
    const main = await parseGhJson<GhRef>(["api", `repos/${repo}/git/ref/heads/main`]);
    if (!main.ok || !main.value?.object?.sha) {
      throw new Error(main.error?.stderr || "Unable to read main SHA");
    }
    const mainSha = main.value.object.sha;

    const patch = await parseGhJson<GhRef>([
      "api",
      "-X",
      "PATCH",
      `repos/${repo}/git/refs/heads/backup`,
      "-f",
      `sha=${mainSha}`,
      "-F",
      "force=true",
    ]);
    if (!patch.ok || !patch.value?.object?.sha) {
      throw new Error(patch.error?.stderr || "Unable to update backup");
    }
    const backupSha = patch.value.object.sha;

    return {
      executed: true,
      providerStatus: "github_cli",
      repo,
      main: mainSha,
      backup: backupSha,
      matched: mainSha === backupSha,
    };
  }
}
