import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import {
  CANONICAL_ADMIN_USER_ID,
  MEMORY_LAYERS,
} from "../../shared/memoryOwnership";
import {
  assertDurableMemoryWriteSucceeded,
  assertSameUserMemoryAccess,
  assertSharedMemoryAccess,
  assertWritableMemoryPath,
  classifyLegacyArchiveForUser,
  describeMemoryLayer,
  MemoryOwnershipError,
  resolveMemoryOwnership,
} from "../services/memory/MemoryOwnershipService";

function assertOwnershipError(fn: () => unknown, code: MemoryOwnershipError["code"]): void {
  assert.throws(fn, (error) => error instanceof MemoryOwnershipError && error.code === code);
}

function changedFilesFromGit(): Array<{ status: string; paths: string[] }> {
  try {
    const output = execFileSync("git", ["diff", "--name-status", "origin/main...HEAD"], {
      cwd: path.resolve(process.cwd(), ".."),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/\t+/);
        return { status: parts[0], paths: parts.slice(1) };
      });
  } catch (error) {
    console.warn("[memory-boundary] Skipping git diff assertions:", error instanceof Error ? error.message : String(error));
    return [];
  }
}

const adminArchive = classifyLegacyArchiveForUser(CANONICAL_ADMIN_USER_ID);
assert.equal(adminArchive.ownerUserId, CANONICAL_ADMIN_USER_ID);
assert.equal(adminArchive.role, "legacy_personal_historical_corpus");
assert.equal(adminArchive.authority, "historical_evidence");
assert.equal(adminArchive.sharedWithOtherUsers, false);
assert.equal(adminArchive.zedCore, false);
assert.equal(adminArchive.sharedSystemKnowledge, false);
assert.equal(adminArchive.writableByRuntime, false);
assert.equal(adminArchive.runtimeSourceForNewUsers, false);

assertOwnershipError(() => classifyLegacyArchiveForUser("normal_user"), "legacy_archive_forbidden");
assertOwnershipError(() => resolveMemoryOwnership({ layer: MEMORY_LAYERS.USER_HISTORY }), "missing_user_id");
assertOwnershipError(() => resolveMemoryOwnership({ layer: MEMORY_LAYERS.USER_IDENTITY, userId: "user" }), "invalid_user_id");
assertOwnershipError(() => assertSameUserMemoryAccess("user_a", "user_b"), "cross_user_access");

const userOwned = resolveMemoryOwnership({ layer: MEMORY_LAYERS.USER_HISTORY, userId: "user_a" });
assert.deepEqual(userOwned, { layer: MEMORY_LAYERS.USER_HISTORY, userId: "user_a", shared: false });

const shared = assertSharedMemoryAccess("user_a", MEMORY_LAYERS.SHARED_SYSTEM);
assert.deepEqual(shared, { layer: MEMORY_LAYERS.SHARED_SYSTEM, userId: null, shared: true });

const core = resolveMemoryOwnership({ layer: MEMORY_LAYERS.ZED_CORE, userId: null });
assert.deepEqual(core, { layer: MEMORY_LAYERS.ZED_CORE, userId: null, shared: true });
assert.notEqual(describeMemoryLayer(MEMORY_LAYERS.ZED_CORE), describeMemoryLayer(MEMORY_LAYERS.SHARED_SYSTEM));
assert.notEqual(describeMemoryLayer(MEMORY_LAYERS.USER_IDENTITY), describeMemoryLayer(MEMORY_LAYERS.USER_HISTORY));

assertOwnershipError(() => assertWritableMemoryPath("zed-memory/storage/new-runtime-file.json"), "read_only_legacy_archive");
assertOwnershipError(
  () => assertWritableMemoryPath("C:/repo/ZedAI/zed-memory/storage/new-runtime-file.json"),
  "read_only_legacy_archive",
);
assert.doesNotThrow(() => assertWritableMemoryPath("hub/user-memory/user_a/foundation/export.json"));

assertOwnershipError(() => assertDurableMemoryWriteSucceeded(false, "test production write"), "durable_persistence_failed");
assert.doesNotThrow(() => assertDurableMemoryWriteSucceeded(true, "test production write"));

const manifestPath = path.resolve(process.cwd(), "..", "zed-memory", "LEGACY_BACKUP_MANIFEST.md");
const manifest = fs.readFileSync(manifestPath, "utf8");
assert.match(manifest, /Owner: `user_admin`/);
assert.match(manifest, /read-only/i);
assert.match(manifest, /Zed Core: no/);
assert.match(manifest, /Shared system knowledge: no/);
assert.match(manifest, /must not be loaded for other users|Do not load this archive for any user other than `user_admin`/i);

const changed = changedFilesFromGit();
for (const entry of changed) {
  const statusKind = entry.status[0];
  for (const filePath of entry.paths) {
    if (!filePath.startsWith("zed-memory/")) continue;
    assert.notEqual(statusKind, "D", `Legacy archive file must not be deleted: ${filePath}`);
    assert.notEqual(statusKind, "R", `Legacy archive file must not be moved: ${filePath}`);
    assert.equal(
      filePath,
      "zed-memory/LEGACY_BACKUP_MANIFEST.md",
      `Only the ownership manifest may change under zed-memory/: ${filePath}`,
    );
  }
}

const protectedSurfaceChanges = changed.filter((entry) =>
  entry.paths.some((filePath) =>
    filePath.startsWith("client/") ||
    filePath.toLowerCase().includes("learningstudio") ||
    filePath.toLowerCase().includes("learning-studio") ||
    filePath.toLowerCase().includes("trading") ||
    filePath.toLowerCase().includes("research"),
  ),
);
assert.equal(
  protectedSurfaceChanges.length,
  0,
  `This foundation pass must not change UI, Learning Studio, Trading, or Research files: ${JSON.stringify(protectedSurfaceChanges)}`,
);

console.log("memory-boundary tests passed");
