import { storage } from "../storage";
import {
  type InsertCoreMemory,
  type InsertProjectMemory,
  type InsertScratchpadMemory,
  type CoreMemory,
  type ProjectMemory,
  type ScratchpadMemory,
} from "@shared/schema";

import { requireAuthenticatedMemoryUserId } from "./memory/MemoryOwnershipService";
import { initializeDefaultCoreMemory } from "./memory/initializeDefault";
import { loadCoreMemoryFromFile } from "./memory/loadFromFile";

export class MemoryService {
  private static readonly PERSISTENT_SCRATCHPAD_EXPIRES_AT = new Date("2100-01-01T00:00:00.000Z");

  // Core Memory - Persistent system configuration
  static async getCoreMemory(key: string): Promise<CoreMemory | null> {
    return await storage.getCoreMemoryByKey(key);
  }

  static async setCoreMemory(data: InsertCoreMemory): Promise<CoreMemory> {
    return await storage.upsertCoreMemory(data);
  }

  static async getAllCoreMemory(): Promise<CoreMemory[]> {
    return await storage.getAllCoreMemory();
  }

  // Project Memory - Saved context and datasets
  static async getProjectMemory(userId: string): Promise<ProjectMemory[]> {
    const owner = requireAuthenticatedMemoryUserId(userId, "project memory read");
    return await storage.getProjectMemoryByUser(owner);
  }

  static async createProjectMemory(
    data: InsertProjectMemory,
  ): Promise<ProjectMemory> {
    const owner = requireAuthenticatedMemoryUserId(data.userId, "project memory write");
    return await storage.createProjectMemory({ ...data, userId: owner });
  }

  static async updateProjectMemory(
    id: string,
    updates: Partial<InsertProjectMemory>,
  ): Promise<ProjectMemory> {
    const safeUpdates = updates.userId
      ? { ...updates, userId: requireAuthenticatedMemoryUserId(updates.userId, "project memory update") }
      : updates;
    return await storage.updateProjectMemory(id, safeUpdates);
  }

  static async deleteProjectMemory(id: string): Promise<boolean> {
    return await storage.deleteProjectMemory(id);
  }

  // Scratchpad Memory - Persistent working memory
  static async getScratchpadMemory(userId: string): Promise<ScratchpadMemory[]> {
    const owner = requireAuthenticatedMemoryUserId(userId, "scratchpad memory read");
    return await storage.getScratchpadMemoryByUser(owner);
  }

  static async createScratchpadMemory(
    data: InsertScratchpadMemory,
  ): Promise<ScratchpadMemory> {
    const owner = requireAuthenticatedMemoryUserId(data.userId, "scratchpad memory write");
    return await storage.createScratchpadMemory({
      ...data,
      userId: owner,
      expiresAt: this.PERSISTENT_SCRATCHPAD_EXPIRES_AT,
    });
  }

  static async deleteScratchpadMemory(id: string): Promise<boolean> {
    return await storage.deleteScratchpadMemory(id);
  }

  // Legacy no-op. Scratchpad memory is persistent unless the user deletes it.
  static async resetScratchpadMemory(): Promise<void> {
    return;
  }

  /**
   * Load core memory from core.memory.json if present, falling back
   * to the in-memory defaults when the file is missing or invalid.
   * The two paths live in /memory because each is ~150 lines of
   * section-by-section persistence and they don't share a code path.
   */
  static async loadCoreMemoryFromFile(): Promise<void> {
    await loadCoreMemoryFromFile(() => this.initializeDefaultCoreMemory());
  }

  static async initializeDefaultCoreMemory(): Promise<void> {
    await initializeDefaultCoreMemory();
  }
}