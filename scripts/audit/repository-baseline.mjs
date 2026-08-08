#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const outputJson = join(repoRoot, "docs/audits/repository-baseline.json");
const outputMarkdown = join(repoRoot, "docs/audits/repository-baseline.md");

const runGit = (args) =>
  execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

const normalizePath = (value) => value.split("\\").join("/");
const lineNumberAt = (content, index) => content.slice(0, index).split("\n").length;
const uniqueSorted = (items, key = (item) => JSON.stringify(item)) => {
  const byKey = new Map();
  for (const item of items) byKey.set(key(item), item);
  return [...byKey.values()].sort((a, b) => key(a).localeCompare(key(b)));
};

const textExtensions = new Set([
  ".cjs", ".css", ".html", ".js", ".json", ".jsx", ".md", ".mjs", ".ps1",
  ".sql", ".toml", ".ts", ".tsx", ".txt", ".yaml", ".yml",
]);

const trackedFiles = runGit(["ls-files", "-z"])
  .split("\0")
  .filter(Boolean)
  .map(normalizePath)
  .sort();

const textFiles = trackedFiles.filter((path) => {
  if (!textExtensions.has(extname(path).toLowerCase())) return false;
  try {
    return statSync(join(repoRoot, path)).size <= 5_000_000;
  } catch {
    return false;
  }
});

const contents = new Map();
for (const path of textFiles) {
  try {
    contents.set(path, readFileSync(join(repoRoot, path), "utf8"));
  } catch {
    // A tracked file can disappear during an intentionally interrupted checkout.
  }
}

const serverRoutes = [];
const clientRoutes = [];
const databaseTables = [];
const filesystemWriters = [];
const schedulers = [];
const promptSites = [];

const routePattern = /\b(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*(?:\[\s*)?([\`'"])(\/[^\`'"]+)\2/g;
const clientRoutePattern = /<Route\s+[^>]*path\s*=\s*["']([^"']+)["']/g;
const tablePattern = /\b(?:pgTable|mysqlTable|sqliteTable)\s*\(\s*["']([^"']+)["']/g;
const writerPattern = /\b(?:fs\.|fsp\.)?(writeFileSync|writeFile|appendFileSync|appendFile|unlinkSync|unlink|rmSync|rm|renameSync|rename)\s*\(/g;
const schedulerPattern = /\b(setInterval|setTimeout|cron\.schedule|scheduleJob|startKnowledgeCurationScheduler|startTradeResolverScheduler)\s*\(/g;
const promptPattern = /\b(?:systemPrompt|prompt|instructions|SYSTEM_PROMPT|BASE_PROMPT)\b/g;

for (const [path, content] of contents) {
  let match;
  if (path.startsWith("server/")) {
    while ((match = routePattern.exec(content))) {
      serverRoutes.push({
        method: match[1].toUpperCase(),
        route: match[3],
        file: path,
        line: lineNumberAt(content, match.index),
      });
    }
  }

  if (path.startsWith("client/") && !/\.(?:test|spec)\./.test(path)) {
    while ((match = clientRoutePattern.exec(content))) {
      clientRoutes.push({
        route: match[1],
        file: path,
        line: lineNumberAt(content, match.index),
      });
    }
  }

  while ((match = tablePattern.exec(content))) {
    databaseTables.push({
      table: match[1],
      file: path,
      line: lineNumberAt(content, match.index),
    });
  }

  while ((match = writerPattern.exec(content))) {
    filesystemWriters.push({
      operation: match[1],
      file: path,
      line: lineNumberAt(content, match.index),
    });
  }

  if (path.startsWith("server/")) {
    while ((match = schedulerPattern.exec(content))) {
      schedulers.push({
        operation: match[1],
        file: path,
        line: lineNumberAt(content, match.index),
      });
    }
    while ((match = promptPattern.exec(content))) {
      promptSites.push({
        symbol: match[0],
        file: path,
        line: lineNumberAt(content, match.index),
      });
    }
  }
}

const stores = trackedFiles
  .filter((path) =>
    /(?:Store|Repository|Persistence|MemoryService|MemorySchema|Schema)\.(?:ts|tsx|js|mjs)$/.test(path),
  )
  .sort();

const providerAdapters = trackedFiles
  .filter((path) =>
    /(?:provider|adapter|integration|gateway|bridge)/i.test(path) &&
    /\.(?:ts|tsx|js|mjs|py)$/.test(path) &&
    !/\.(?:test|spec)\./.test(path),
  )
  .sort();

const runtimeFiles = trackedFiles
  .filter((path) =>
    /^(?:package(?:-lock)?\.json|render\.yaml|netlify\.toml|tsconfig\.json|vitest\.config\.ts)$/.test(path) ||
    /^(?:client|server)\/(?:package(?:-lock)?\.json|tsconfig[^/]*\.json|vite\.config\.ts)$/.test(path) ||
    /^(?:server\/index\.ts|server\/db\.ts|server\/migrations\.ts|server\/routes\.ts)$/.test(path),
  )
  .sort();

const uiEntryPoints = trackedFiles
  .filter((path) =>
    /^(?:client\/src\/(?:main|App)\.tsx|client\/src\/(?:pages|nexys|console|zebulon)\/.*\.(?:ts|tsx))$/.test(path) &&
    !/\.(?:test|spec)\./.test(path),
  )
  .sort();

const trackedRuntimeArtifacts = trackedFiles
  .filter((path) =>
    /(?:^|\/)(?:logs?|sessions?|uploads?|runtime|fallback_storage)(?:\/|$)/i.test(path) ||
    /(?:\.log|\.jsonl|preview\.(?:out|err)\.log)$/i.test(path) ||
    /^hub\/(?:user-memory|user-personalization|shared-memory)\//.test(path) ||
    /^zed-memory\//.test(path),
  )
  .sort();

const runtimeArtifactScopes = [...trackedRuntimeArtifacts.reduce((scopes, path) => {
  const parts = path.split("/");
  const scope = path.startsWith("zed-memory/")
    ? "zed-memory/**"
    : path.startsWith("hub/user-memory/")
      ? "hub/user-memory/**"
      : path.startsWith("hub/user-personalization/")
        ? "hub/user-personalization/**"
        : path.startsWith("hub/shared-memory/")
          ? "hub/shared-memory/**"
          : parts.length > 2
            ? `${parts[0]}/${parts[1]}/**`
            : path;
  scopes.set(scope, (scopes.get(scope) || 0) + 1);
  return scopes;
}, new Map())]
  .map(([scope, count]) => ({ scope, count }))
  .sort((a, b) => a.scope.localeCompare(b.scope));

const remoteBranches = runGit([
  "for-each-ref",
  "--format=%(refname:short)|%(objectname)",
  "refs/remotes/origin",
])
  .split("\n")
  .filter(Boolean)
  .filter((line) => line !== "origin/HEAD" && !line.startsWith("origin|"))
  .map((line) => {
    const [name, sha] = line.split("|");
    return { name, sha };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const commit = runGit(["rev-parse", "HEAD"]);
const commitTime = runGit(["show", "-s", "--format=%cI", "HEAD"]);
const generatedAt = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString()
  : new Date().toISOString();

const report = {
  schemaVersion: 1,
  generatedAt,
  repository: runGit(["config", "--get", "remote.origin.url"]),
  branch: runGit(["branch", "--show-current"]),
  commit,
  commitTime,
  counts: {
    trackedFiles: trackedFiles.length,
    textFilesScanned: contents.size,
    remoteBranches: remoteBranches.length,
    serverRoutes: serverRoutes.length,
    clientRoutes: clientRoutes.length,
    databaseTables: databaseTables.length,
    filesystemWriters: filesystemWriters.length,
    stores: stores.length,
    providerAdapters: providerAdapters.length,
    schedulers: schedulers.length,
    promptSites: promptSites.length,
    uiEntryPoints: uiEntryPoints.length,
    trackedRuntimeArtifacts: trackedRuntimeArtifacts.length,
  },
  remoteBranches,
  serverRoutes: uniqueSorted(serverRoutes, (item) => `${item.method}|${item.route}|${item.file}|${item.line}`),
  clientRoutes: uniqueSorted(clientRoutes, (item) => `${item.route}|${item.file}|${item.line}`),
  databaseTables: uniqueSorted(databaseTables, (item) => `${item.table}|${item.file}|${item.line}`),
  filesystemWriters: uniqueSorted(filesystemWriters, (item) => `${item.file}|${item.line}|${item.operation}`),
  stores,
  providerAdapters,
  schedulers: uniqueSorted(schedulers, (item) => `${item.file}|${item.line}|${item.operation}`),
  promptSites: uniqueSorted(promptSites, (item) => `${item.file}|${item.line}|${item.symbol}`),
  runtimeFiles,
  uiEntryPoints,
  runtimeArtifactScopes,
};

const table = (headers, rows) => {
  const head = `| ${headers.join(" | ")} |`;
  const rule = `| ${headers.map(() => "---").join(" | ")} |`;
  return [head, rule, ...rows.map((row) => `| ${row.join(" | ")} |`)].join("\n");
};

const markdown = `# Repository Baseline Inventory

Generated by \`node scripts/audit/repository-baseline.mjs\`.

| Field | Value |
| --- | --- |
| Repository | \`${report.repository}\` |
| Branch | \`${report.branch}\` |
| Commit | \`${report.commit}\` |
| Commit time | ${report.commitTime} |
| Generated at | ${report.generatedAt} |

## Counts

${table(
  ["Category", "Count"],
  Object.entries(report.counts).map(([name, count]) => [name, String(count)]),
)}

## Remote Branches

${table(
  ["Branch", "SHA"],
  report.remoteBranches.map((item) => ["`" + item.name + "`", "`" + item.sha + "`"]),
)}

## Database Tables

${table(
  ["Table", "Source"],
  report.databaseTables.map((item) => ["`" + item.table + "`", "`" + item.file + ":" + item.line + "`"]),
)}

## Top-Level Client Routes

${table(
  ["Route", "Source"],
  report.clientRoutes.map((item) => ["`" + item.route + "`", "`" + item.file + ":" + item.line + "`"]),
)}

## Inventory Notes

- The JSON companion contains complete route, writer, store, provider/adapter, scheduler, prompt-site, runtime-file, UI-entry-point, and tracked-runtime-artifact lists.
- Results describe tracked repository evidence at the recorded commit. They do not certify runtime behavior or architectural compliance.
- Branch cleanup, artifact deletion, data migration, and application mutation are outside this inventory command.
`;

mkdirSync(dirname(outputJson), { recursive: true });
writeFileSync(outputJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(outputMarkdown, markdown, "utf8");

process.stdout.write(
  `Repository baseline written to ${normalizePath(relative(repoRoot, outputJson))} and ${normalizePath(relative(repoRoot, outputMarkdown))}\n`,
);
