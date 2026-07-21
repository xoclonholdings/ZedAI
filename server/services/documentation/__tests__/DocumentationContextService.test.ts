import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  resolveVersionFromManifests,
  formatDocsForPrompt,
} from "../DocumentationContextService";

test("version resolution prefers exact lockfile pin over manifest range", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zar-docs-"));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ dependencies: { react: "^18.2.0" } }),
  );
  fs.writeFileSync(
    path.join(dir, "package-lock.json"),
    JSON.stringify({ packages: { "node_modules/react": { version: "18.3.1" } } }),
  );
  const result = await resolveVersionFromManifests("react", dir);
  assert.equal(result.version, "18.3.1");
  assert.equal(result.source, "package-lock.json");
});

test("version resolution falls back to package.json range", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zar-docs-"));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ devDependencies: { typescript: "~5.6.3" } }),
  );
  const result = await resolveVersionFromManifests("typescript", dir);
  assert.equal(result.version, "5.6.3");
  assert.equal(result.source, "package.json");
});

test("unknown package resolves to no version, not a guess", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zar-docs-"));
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({}));
  const result = await resolveVersionFromManifests("not-a-dep", dir);
  assert.equal(result.version, undefined);
});

test("prompt formatting preserves source + version citation", () => {
  const prompt = formatDocsForPrompt({
    state: "ok",
    libraryId: "/vercel/next.js",
    resolvedVersion: "15.1.0",
    versionMatch: "exact",
    topic: "routing",
    content: "App Router docs body",
    source: "context7:/vercel/next.js/15.1.0",
    retrievedAt: "2026-07-21T00:00:00.000Z",
    cached: false,
  });
  assert.match(prompt, /v15\.1\.0/);
  assert.match(prompt, /context7:\/vercel\/next\.js\/15\.1\.0/);
  assert.match(prompt, /App Router docs body/);
});

test("provider-unavailable prompt forbids inventing docs", () => {
  const prompt = formatDocsForPrompt({
    state: "provider_unavailable",
    libraryId: "/foo/bar",
    versionMatch: "unknown",
    source: "context7:/foo/bar",
    retrievedAt: "2026-07-21T00:00:00.000Z",
    providerError: "context7_search_http_503",
    cached: false,
  });
  assert.match(prompt, /unavailable/);
  assert.match(prompt, /Do not invent documentation/);
});
