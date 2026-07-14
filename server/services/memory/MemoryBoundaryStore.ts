import { and, eq } from "drizzle-orm";

import { db } from "../../db";
import { logRuntimeEvent } from "../RuntimeLogger";
import {
  memoryObjects,
  memoryProposals,
  memorySources,
  userMemoryPolicies,
  userMemoryProfiles,
  type InsertMemoryObject,
  type InsertMemoryProposal,
  type InsertMemorySource,
  type InsertUserMemoryPolicy,
  type InsertUserMemoryProfile,
} from "../../../shared/schema";
import type { MemoryLayer } from "../../../shared/memoryOwnership";
import {
  MemoryOwnershipError,
  assertDurableMemoryWriteSucceeded,
  assertSameUserMemoryAccess,
  assertSharedMemoryAccess,
  resolveMemoryOwnership,
} from "./MemoryOwnershipService";

function requireDb(operation: string) {
  if (!db) {
    throw new MemoryOwnershipError(
      `${operation} requires PostgreSQL; durable memory storage is unavailable.`,
      "durable_persistence_failed",
    );
  }
  return db;
}

async function persist<T>(operation: string, context: Record<string, unknown>, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    await logRuntimeEvent({
      level: "error",
      source: "server",
      event: "memory.boundary.persistence_failed",
      detail: error instanceof Error ? error.message : String(error),
      context: { operation, ...context },
    }).catch(() => undefined);
    throw error;
  }
}

export class MemoryBoundaryStore {
  static async upsertUserProfile(input: InsertUserMemoryProfile & { requesterUserId: string }) {
    const owner = assertSameUserMemoryAccess(input.requesterUserId, input.userId, "user profile write");
    const database = requireDb("user profile write");
    return persist("user profile write", { userId: owner }, async () => {
      const [row] = await database
        .insert(userMemoryProfiles)
        .values({
          userId: owner,
          preferredName: input.preferredName ?? null,
          profileStatus: input.profileStatus || "empty",
        })
        .onConflictDoUpdate({
          target: userMemoryProfiles.userId,
          set: {
            preferredName: input.preferredName ?? null,
            profileStatus: input.profileStatus || "empty",
            updatedAt: new Date(),
          },
        })
        .returning();
      assertDurableMemoryWriteSucceeded(Boolean(row), "user profile write");
      return row;
    });
  }

  static async getUserProfile(requesterUserId: string, userId: string) {
    const owner = assertSameUserMemoryAccess(requesterUserId, userId, "user profile read");
    const database = requireDb("user profile read");
    const [row] = await database
      .select()
      .from(userMemoryProfiles)
      .where(eq(userMemoryProfiles.userId, owner));
    return row || null;
  }

  static async upsertUserMemoryPolicy(input: InsertUserMemoryPolicy & { requesterUserId: string }) {
    const owner = assertSameUserMemoryAccess(input.requesterUserId, input.userId, "user memory policy write");
    const database = requireDb("user memory policy write");
    return persist("user memory policy write", { userId: owner }, async () => {
      const [row] = await database
        .insert(userMemoryPolicies)
        .values({
          userId: owner,
          allowedMemoryCategories: input.allowedMemoryCategories || [],
          categoriesRequiringConfirmation: input.categoriesRequiringConfirmation || [],
          prohibitedCategories: input.prohibitedCategories || [],
          retentionPreferences: input.retentionPreferences || {},
        })
        .onConflictDoUpdate({
          target: userMemoryPolicies.userId,
          set: {
            allowedMemoryCategories: input.allowedMemoryCategories || [],
            categoriesRequiringConfirmation: input.categoriesRequiringConfirmation || [],
            prohibitedCategories: input.prohibitedCategories || [],
            retentionPreferences: input.retentionPreferences || {},
            updatedAt: new Date(),
          },
        })
        .returning();
      assertDurableMemoryWriteSucceeded(Boolean(row), "user memory policy write");
      return row;
    });
  }

  static async createMemorySource(input: InsertMemorySource & { requesterUserId: string }) {
    const ownership = resolveMemoryOwnership({
      layer: input.ownership as MemoryLayer,
      userId: input.userId,
    });
    if (ownership.userId) {
      assertSameUserMemoryAccess(input.requesterUserId, ownership.userId, "memory source write");
    } else {
      assertSharedMemoryAccess(input.requesterUserId, ownership.layer, "memory source write");
    }
    const database = requireDb("memory source write");
    return persist("memory source write", { userId: ownership.userId, ownership: ownership.layer }, async () => {
      const [row] = await database
        .insert(memorySources)
        .values({
          userId: ownership.userId,
          sourceType: input.sourceType,
          label: input.label,
          originalLocationRef: input.originalLocationRef ?? null,
          ownership: ownership.layer,
          contentHash: input.contentHash,
          status: input.status || "staged",
          authorityState: input.authorityState || "observed",
          temporalStatus: input.temporalStatus || "unknown",
          privacyLevel: input.privacyLevel || (ownership.shared ? "shared_internal" : "private"),
        })
        .returning();
      assertDurableMemoryWriteSucceeded(Boolean(row), "memory source write");
      return row;
    });
  }

  static async listMemorySourcesForUser(requesterUserId: string, userId: string) {
    const owner = assertSameUserMemoryAccess(requesterUserId, userId, "user memory source read");
    const database = requireDb("user memory source read");
    return database
      .select()
      .from(memorySources)
      .where(eq(memorySources.userId, owner));
  }

  static async listSharedMemorySources(requesterUserId: string, layer: Extract<MemoryLayer, "zed_core" | "shared_system">) {
    const ownership = assertSharedMemoryAccess(requesterUserId, layer, "shared memory source read");
    const database = requireDb("shared memory source read");
    return database
      .select()
      .from(memorySources)
      .where(and(eq(memorySources.ownership, ownership.layer), eq(memorySources.privacyLevel, "shared_internal")));
  }

  static async createMemoryObject(input: InsertMemoryObject & { requesterUserId: string }) {
    const ownership = resolveMemoryOwnership({
      layer: input.ownership as MemoryLayer,
      userId: input.userId,
    });
    if (ownership.userId) {
      assertSameUserMemoryAccess(input.requesterUserId, ownership.userId, "memory object write");
    } else {
      assertSharedMemoryAccess(input.requesterUserId, ownership.layer, "memory object write");
    }
    const database = requireDb("memory object write");
    return persist("memory object write", { userId: ownership.userId, ownership: ownership.layer }, async () => {
      const [row] = await database
        .insert(memoryObjects)
        .values({
          userId: ownership.userId,
          sourceReferences: input.sourceReferences || [],
          objectType: input.objectType,
          canonicalName: input.canonicalName,
          summary: input.summary ?? null,
          structuredValue: input.structuredValue ?? null,
          ownership: ownership.layer,
          authorityState: input.authorityState || "observed",
          confidence: input.confidence || "0",
          temporalStatus: input.temporalStatus || "unknown",
          privacyLevel: input.privacyLevel || (ownership.shared ? "shared_internal" : "private"),
        })
        .returning();
      assertDurableMemoryWriteSucceeded(Boolean(row), "memory object write");
      return row;
    });
  }

  static async listMemoryObjectsForUser(requesterUserId: string, userId: string) {
    const owner = assertSameUserMemoryAccess(requesterUserId, userId, "user memory object read");
    const database = requireDb("user memory object read");
    return database
      .select()
      .from(memoryObjects)
      .where(eq(memoryObjects.userId, owner));
  }

  static async createMemoryProposal(input: InsertMemoryProposal & { requesterUserId: string }) {
    const owner = assertSameUserMemoryAccess(input.requesterUserId, input.userId, "memory proposal write");
    const database = requireDb("memory proposal write");
    return persist("memory proposal write", { userId: owner }, async () => {
      const [row] = await database
        .insert(memoryProposals)
        .values({
          userId: owner,
          proposedCategory: input.proposedCategory,
          proposedValue: input.proposedValue,
          evidenceReferences: input.evidenceReferences || [],
          status: input.status || "observed",
          resolvedAt: input.resolvedAt ?? null,
        })
        .returning();
      assertDurableMemoryWriteSucceeded(Boolean(row), "memory proposal write");
      return row;
    });
  }
}
