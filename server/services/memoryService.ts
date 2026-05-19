import { storage } from "../storage";
import {
  type InsertCoreMemory,
  type InsertProjectMemory,
  type InsertScratchpadMemory,
  type CoreMemory,
  type ProjectMemory,
  type ScratchpadMemory,
} from "@shared/schema";

import { initializeDefaultCoreMemory } from "./memory/initializeDefault";
import { loadCoreMemoryFromFile } from "./memory/loadFromFile";

export class MemoryService {
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
    return await storage.getProjectMemoryByUser(userId);
  }

  static async createProjectMemory(
    data: InsertProjectMemory,
  ): Promise<ProjectMemory> {
    return await storage.createProjectMemory(data);
  }

  static async updateProjectMemory(
    id: string,
    updates: Partial<InsertProjectMemory>,
  ): Promise<ProjectMemory> {
    return await storage.updateProjectMemory(id, updates);
  }

  static async deleteProjectMemory(id: string): Promise<boolean> {
    return await storage.deleteProjectMemory(id);
  }

  // Scratchpad Memory - Temporary working memory
  static async getScratchpadMemory(userId: string): Promise<ScratchpadMemory[]> {
    return await storage.getScratchpadMemoryByUser(userId);
  }

  static async createScratchpadMemory(
    data: InsertScratchpadMemory,
  ): Promise<ScratchpadMemory> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    return await storage.createScratchpadMemory({
      ...data,
      expiresAt,
    });
  }

  static async deleteScratchpadMemory(id: string): Promise<boolean> {
    return await storage.deleteScratchpadMemory(id);
  }

  // Daily reset for scratchpad memory
  static async resetScratchpadMemory(): Promise<void> {
    await storage.cleanupExpiredScratchpadMemory();
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
