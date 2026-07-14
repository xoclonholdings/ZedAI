import path from "path";

import {
  CANONICAL_ADMIN_USER_ID,
  LEGACY_ARCHIVE_ROOT,
  LEGACY_ARCHIVE_STORAGE_ROOT,
  type MemoryLayer,
  isSharedMemoryLayer,
  isUserOwnedMemoryLayer,
} from "../../../shared/memoryOwnership";

export class MemoryOwnershipError extends Error {
  constructor(
    message: string,
    readonly code:
      | "missing_user_id"
      | "invalid_user_id"
      | "cross_user_access"
      | "invalid_layer_owner"
      | "legacy_archive_forbidden"
      | "read_only_legacy_archive"
      | "durable_persistence_failed",
  ) {
    super(message);
    this.name = "MemoryOwnershipError";
  }
}

const INVALID_FALLBACK_USER_IDS = new Set([
  "",
  "user",
  "user_001",
  "default-user",
  "default_user",
  "anonymous",
  "unknown",
  "offline",
  "admin-user",
  "admin_user",
]);

export interface LegacyArchiveClassification {
  ownerUserId: string;
  role: "legacy_personal_historical_corpus";
  authority: "historical_evidence";
  sharedWithOtherUsers: false;
  zedCore: false;
  sharedSystemKnowledge: false;
  writableByRuntime: false;
  runtimeSourceForNewUsers: false;
  root: typeof LEGACY_ARCHIVE_ROOT;
  storageRoot: typeof LEGACY_ARCHIVE_STORAGE_ROOT;
}

export interface MemoryOwnershipInput {
  layer: MemoryLayer;
  userId?: string | null;
}

export interface MemoryOwnershipResolution {
  layer: MemoryLayer;
  userId: string | null;
  shared: boolean;
}

function cleanUserId(value: string): string {
  return value.trim();
}

export function isValidAuthenticatedUserId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const userId = cleanUserId(value);
  if (!userId) return false;
  if (INVALID_FALLBACK_USER_IDS.has(userId)) return false;
  if (userId.includes("..") || userId.includes("/") || userId.includes("\\")) return false;
  return true;
}

export function requireAuthenticatedMemoryUserId(
  value: unknown,
  operation = "memory operation",
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new MemoryOwnershipError(
      `${operation} requires an authenticated userId; memory ownership cannot default silently.`,
      "missing_user_id",
    );
  }
  const userId = cleanUserId(value);
  if (!isValidAuthenticatedUserId(userId)) {
    throw new MemoryOwnershipError(
      `${operation} received invalid or fallback userId '${userId}'.`,
      "invalid_user_id",
    );
  }
  return userId;
}

export function resolveMemoryOwnership(input: MemoryOwnershipInput): MemoryOwnershipResolution {
  if (isUserOwnedMemoryLayer(input.layer)) {
    return {
      layer: input.layer,
      userId: requireAuthenticatedMemoryUserId(input.userId, `${input.layer} ownership`),
      shared: false,
    };
  }

  if (isSharedMemoryLayer(input.layer)) {
    if (input.userId != null && String(input.userId).trim()) {
      throw new MemoryOwnershipError(
        `${input.layer} memory must not carry a userId; user-owned memory belongs in user_identity or user_history.`,
        "invalid_layer_owner",
      );
    }
    return { layer: input.layer, userId: null, shared: true };
  }

  throw new MemoryOwnershipError(`Unknown memory layer '${input.layer}'.`, "invalid_layer_owner");
}

export function assertSameUserMemoryAccess(
  requesterUserId: unknown,
  ownerUserId: unknown,
  operation = "user memory access",
): string {
  const requester = requireAuthenticatedMemoryUserId(requesterUserId, operation);
  const owner = requireAuthenticatedMemoryUserId(ownerUserId, operation);
  if (requester !== owner) {
    throw new MemoryOwnershipError(
      `${operation} denied: requester '${requester}' cannot access memory owned by '${owner}'.`,
      "cross_user_access",
    );
  }
  return owner;
}

export function assertSharedMemoryAccess(
  requesterUserId: unknown,
  layer: MemoryLayer,
  operation = "shared memory access",
): MemoryOwnershipResolution {
  requireAuthenticatedMemoryUserId(requesterUserId, operation);
  return resolveMemoryOwnership({ layer, userId: null });
}

export function isLegacyArchivePath(value: string): boolean {
  const root = LEGACY_ARCHIVE_ROOT.toLowerCase();
  const normalized = value.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
  return normalized === root || normalized.startsWith(`${root}/`) || normalized.endsWith(`/${root}`) || normalized.includes(`/${root}/`);
}

export function assertWritableMemoryPath(targetPath: string, operation = "memory write"): void {
  if (isLegacyArchivePath(targetPath)) {
    throw new MemoryOwnershipError(
      `${operation} denied: ${LEGACY_ARCHIVE_ROOT}/ is the admin user's read-only legacy archive.`,
      "read_only_legacy_archive",
    );
  }
}

export function classifyLegacyArchiveForUser(userId: unknown): LegacyArchiveClassification {
  const owner = requireAuthenticatedMemoryUserId(userId, "legacy archive classification");
  if (owner !== CANONICAL_ADMIN_USER_ID) {
    throw new MemoryOwnershipError(
      `Legacy archive access denied: ${LEGACY_ARCHIVE_ROOT}/ belongs only to '${CANONICAL_ADMIN_USER_ID}'.`,
      "legacy_archive_forbidden",
    );
  }

  return {
    ownerUserId: CANONICAL_ADMIN_USER_ID,
    role: "legacy_personal_historical_corpus",
    authority: "historical_evidence",
    sharedWithOtherUsers: false,
    zedCore: false,
    sharedSystemKnowledge: false,
    writableByRuntime: false,
    runtimeSourceForNewUsers: false,
    root: LEGACY_ARCHIVE_ROOT,
    storageRoot: LEGACY_ARCHIVE_STORAGE_ROOT,
  };
}

export function resolveScopedRuntimePath(root: string, userId: unknown, ...segments: string[]): string {
  const owner = requireAuthenticatedMemoryUserId(userId, "scoped runtime path");
  const resolved = path.resolve(root, owner, ...segments);
  assertWritableMemoryPath(resolved, "scoped runtime path");
  return resolved;
}

export function assertDurableMemoryWriteSucceeded(succeeded: boolean, operation: string): void {
  if (!succeeded) {
    throw new MemoryOwnershipError(
      `${operation} failed because durable memory persistence was unavailable.`,
      "durable_persistence_failed",
    );
  }
}

export function describeMemoryLayer(layer: MemoryLayer): string {
  switch (layer) {
    case "zed_core":
      return "Zed Core: shared identity, governance, orchestration, policy, and universal contracts only.";
    case "shared_system":
      return "Shared system knowledge: reusable installed domain knowledge available to authorized users.";
    case "user_identity":
      return "User identity and personalization: structured preferences and profile data owned by one user.";
    case "user_history":
      return "User knowledge and history: uploaded documents, imported conversations, objects, evidence, and timelines owned by one user.";
  }
}
