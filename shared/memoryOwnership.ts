export const CANONICAL_ADMIN_USER_ID = "user_admin";

export const LEGACY_ARCHIVE_ROOT = "zed-memory";
export const LEGACY_ARCHIVE_STORAGE_ROOT = "zed-memory/storage";

export const MEMORY_LAYERS = [
  "zed_core",
  "shared_system",
  "user_identity",
  "user_history",
] as const;

export type MemoryLayer = (typeof MEMORY_LAYERS)[number];

export const USER_OWNED_MEMORY_LAYERS = ["user_identity", "user_history"] as const;
export type UserOwnedMemoryLayer = (typeof USER_OWNED_MEMORY_LAYERS)[number];

export const SHARED_MEMORY_LAYERS = ["zed_core", "shared_system"] as const;
export type SharedMemoryLayer = (typeof SHARED_MEMORY_LAYERS)[number];

export const MEMORY_AUTHORITY_STATES = [
  "historical_evidence",
  "observed",
  "proposed",
  "confirmed",
  "rejected",
  "superseded",
] as const;

export type MemoryAuthorityState = (typeof MEMORY_AUTHORITY_STATES)[number];

export const MEMORY_TEMPORAL_STATUSES = [
  "current",
  "historical",
  "future",
  "deprecated",
  "superseded",
  "unknown",
] as const;

export type MemoryTemporalStatus = (typeof MEMORY_TEMPORAL_STATUSES)[number];

export const MEMORY_PRIVACY_LEVELS = [
  "public",
  "shared_internal",
  "private",
  "sensitive",
  "secret",
] as const;

export type MemoryPrivacyLevel = (typeof MEMORY_PRIVACY_LEVELS)[number];

export const MEMORY_PROPOSAL_STATES = [
  "observed",
  "proposed",
  "confirmed",
  "rejected",
  "superseded",
] as const;

export type MemoryProposalState = (typeof MEMORY_PROPOSAL_STATES)[number];

export const MEMORY_SOURCE_STATUSES = [
  "staged",
  "active",
  "archived",
  "blocked",
  "deleted",
] as const;

export type MemorySourceStatus = (typeof MEMORY_SOURCE_STATUSES)[number];

export function isUserOwnedMemoryLayer(layer: MemoryLayer): layer is UserOwnedMemoryLayer {
  return (USER_OWNED_MEMORY_LAYERS as readonly string[]).includes(layer);
}

export function isSharedMemoryLayer(layer: MemoryLayer): layer is SharedMemoryLayer {
  return (SHARED_MEMORY_LAYERS as readonly string[]).includes(layer);
}
