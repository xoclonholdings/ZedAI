import { eq, and, desc, asc } from "drizzle-orm";
import { randomUUID } from "crypto";

import {
  type CoreMemory,
  type InsertCoreMemory,
  type ProjectMemory,
  type InsertProjectMemory,
  type ScratchpadMemory,
  type InsertScratchpadMemory,
  coreMemory,
  projectMemory,
  scratchpadMemory,
} from "../../shared/schema";

import { db, isDatabaseRequired } from "../db.ts";
import { fallbackStorage } from "./fallback";
import { memoryCache } from "./cache";

function assertDbAvailable(operation: string): void {
  if (isDatabaseRequired()) {
    throw new Error(`${operation} requires PostgreSQL in this environment.`);
  }
}

async function storeFallback(key: string, value: unknown): Promise<void> {
  if (!isDatabaseRequired()) {
    await storeFallback(key, value);
  }
}

export class MemoryDatabaseStorage {
  private generateCacheKey(...parts: Array<string | number | undefined>) {
    return parts.filter(Boolean).join(":");
  }

  async getCoreMemoryByKey(key: string): Promise<CoreMemory | null> {
    const cacheKey = this.generateCacheKey("core_memory", key);
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;
    if (!db) { assertDbAvailable("getCoreMemoryByKey"); return null; }

    try {
      const [memory] = await db
        .select()
        .from(coreMemory)
        .where(eq(coreMemory.key, key));

      if (memory) {
        memoryCache.set(cacheKey, memory, 1800000);
      }

      return memory || null;
    } catch (error) {
      console.warn("[MEMORY STORAGE] getCoreMemoryByKey failed:", error);
      return null;
    }
  }

  async upsertCoreMemory(data: InsertCoreMemory): Promise<CoreMemory> {
    const fallbackKey = `core_memory_${data.key}`;

    if (!db) {
      assertDbAvailable("upsertCoreMemory");
      const timestamp = new Date();
      const memory = {
        id: randomUUID(),
        ...data,
        description: data.description ?? null,
        adminOnly: data.adminOnly ?? true,
        createdAt: timestamp,
        updatedAt: timestamp,
      } as CoreMemory;
      memoryCache.delete(this.generateCacheKey("core_memory", data.key));
      await storeFallback(fallbackKey, memory);
      return memory;
    }

    const [memory] = await db
      .insert(coreMemory)
      .values(data)
      .onConflictDoUpdate({
        target: coreMemory.key,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      })
      .returning();

    memoryCache.delete(this.generateCacheKey("core_memory", data.key));

    await storeFallback(fallbackKey, memory);

    return memory;
  }

  async getAllCoreMemory(): Promise<CoreMemory[]> {
    const cacheKey = this.generateCacheKey("all_core_memory");
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;
    if (!db) { assertDbAvailable("readMemory"); return []; }

    try {
      const result = await db
        .select()
        .from(coreMemory)
        .orderBy(asc(coreMemory.key));

      memoryCache.set(cacheKey, result, 600000);

      return result;
    } catch (error) {
      console.warn("[MEMORY STORAGE] getAllCoreMemory failed:", error);
      return [];
    }
  }

  async getProjectMemoryByUser(userId: string): Promise<ProjectMemory[]> {
    const cacheKey = this.generateCacheKey("project_memory", userId);
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;
    if (!db) { assertDbAvailable("readMemory"); return []; }

    try {
      const result = await db
        .select()
        .from(projectMemory)
        .where(
          and(
            eq(projectMemory.userId, userId),
            eq(projectMemory.isActive, true)
          )
        )
        .orderBy(desc(projectMemory.updatedAt));

      memoryCache.set(cacheKey, result, 300000);

      return result;
    } catch (error) {
      console.warn("[MEMORY STORAGE] getProjectMemoryByUser failed:", error);
      return [];
    }
  }

  async createProjectMemory(
    data: InsertProjectMemory
  ): Promise<ProjectMemory> {
    const fallbackKey = `project_memory_${data.userId}`;

    if (!db) {
      assertDbAvailable("upsertCoreMemory");
      const timestamp = new Date();
      const memory = {
        id: randomUUID(),
        ...data,
        description: data.description ?? null,
        type: data.type ?? "context",
        isActive: data.isActive ?? true,
        createdAt: timestamp,
        updatedAt: timestamp,
      } as ProjectMemory;
      memoryCache.delete(this.generateCacheKey("project_memory", data.userId));
      await storeFallback(fallbackKey, memory);
      return memory;
    }

    const [memory] = await db
      .insert(projectMemory)
      .values(data)
      .returning();

    memoryCache.delete(
      this.generateCacheKey("project_memory", data.userId)
    );

    await storeFallback(fallbackKey, memory);

    return memory;
  }

  async updateProjectMemory(
    id: string,
    updates: Partial<InsertProjectMemory>
  ): Promise<ProjectMemory> {
    if (!db) {
      assertDbAvailable("updateProjectMemory");
      const updated = {
        id,
        userId: updates.userId || "offline",
        name: updates.name || "Offline project memory",
        description: updates.description ?? null,
        content: updates.content || "",
        type: updates.type || "context",
        isActive: updates.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ProjectMemory;
      await storeFallback(`project_memory_${id}`, updated);
      return updated;
    }

    const [updated] = await db
      .update(projectMemory)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projectMemory.id, id))
      .returning();

    if (updated) {
      memoryCache.delete(
        this.generateCacheKey("project_memory", updated.userId)
      );
    }

    return updated;
  }

  async deleteProjectMemory(id: string): Promise<boolean> {
    try {
      const [memory] = await db
        .select()
        .from(projectMemory)
        .where(eq(projectMemory.id, id));

      const result = await db
        .delete(projectMemory)
        .where(eq(projectMemory.id, id));

      const success = (result.rowCount ?? 0) > 0;

      if (success && memory) {
        memoryCache.delete(
          this.generateCacheKey("project_memory", memory.userId)
        );
      }

      return success;
    } catch (error) {
      console.error("[MEMORY STORAGE] deleteProjectMemory failed:", error);
      return false;
    }
  }

  async getScratchpadMemoryByUser(
    userId: string
  ): Promise<ScratchpadMemory[]> {
    const cacheKey = this.generateCacheKey("scratchpad_memory", userId);
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;
    if (!db) { assertDbAvailable("readMemory"); return []; }

    try {
      const result = await db
        .select()
        .from(scratchpadMemory)
        .where(eq(scratchpadMemory.userId, userId))
        .orderBy(desc(scratchpadMemory.createdAt));

      memoryCache.set(cacheKey, result, 60000);

      return result;
    } catch (error) {
      console.warn("[MEMORY STORAGE] getScratchpadMemoryByUser failed:", error);
      return [];
    }
  }

  async createScratchpadMemory(
    data: InsertScratchpadMemory
  ): Promise<ScratchpadMemory> {
    const fallbackKey = `scratchpad_memory_${data.userId}`;

    if (!db) {
      assertDbAvailable("createScratchpadMemory");
      const memory = {
        id: randomUUID(),
        ...data,
        conversationId: data.conversationId ?? null,
        tags: data.tags ?? null,
        createdAt: new Date(),
      } as ScratchpadMemory;
      memoryCache.delete(this.generateCacheKey("scratchpad_memory", data.userId));
      await storeFallback(fallbackKey, memory);
      return memory;
    }

    const [memory] = await db
      .insert(scratchpadMemory)
      .values(data)
      .returning();

    memoryCache.delete(
      this.generateCacheKey("scratchpad_memory", data.userId)
    );

    await storeFallback(fallbackKey, memory);

    return memory;
  }

  async deleteScratchpadMemory(id: string): Promise<boolean> {
    try {
      const [memory] = await db
        .select()
        .from(scratchpadMemory)
        .where(eq(scratchpadMemory.id, id));

      const result = await db
        .delete(scratchpadMemory)
        .where(eq(scratchpadMemory.id, id));

      const success = (result.rowCount ?? 0) > 0;

      if (success && memory) {
        memoryCache.delete(
          this.generateCacheKey("scratchpad_memory", memory.userId)
        );
      }

      return success;
    } catch (error) {
      console.error("[MEMORY STORAGE] deleteScratchpadMemory failed:", error);
      return false;
    }
  }

  async cleanupExpiredScratchpadMemory(): Promise<void> {
    // Scratchpad entries are persistent operating memory now. Keep the
    // method for legacy callers, but never delete user data here.
    return;
  }
}
