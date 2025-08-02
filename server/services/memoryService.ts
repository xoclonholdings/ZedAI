import { storage } from "../storage";
import { 
  type InsertCoreMemory, 
  type InsertProjectMemory, 
  type InsertScratchpadMemory,
  type CoreMemory,
  type ProjectMemory,
  type ScratchpadMemory
} from "@shared/schema";

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

  static async createProjectMemory(data: InsertProjectMemory): Promise<ProjectMemory> {
    return await storage.createProjectMemory(data);
  }

  static async updateProjectMemory(id: string, updates: Partial<InsertProjectMemory>): Promise<ProjectMemory> {
    return await storage.updateProjectMemory(id, updates);
  }

  static async deleteProjectMemory(id: string): Promise<boolean> {
    return await storage.deleteProjectMemory(id);
  }

  // Scratchpad Memory - Temporary working memory
  static async getScratchpadMemory(userId: string): Promise<ScratchpadMemory[]> {
    return await storage.getScratchpadMemoryByUser(userId);
  }

  static async createScratchpadMemory(data: InsertScratchpadMemory): Promise<ScratchpadMemory> {
    // Set expiration to 24 hours from creation
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    return await storage.createScratchpadMemory({
      ...data,
      expiresAt
    });
  }

  // Daily reset for scratchpad memory
  static async resetScratchpadMemory(): Promise<void> {
    await storage.cleanupExpiredScratchpadMemory();
  }

  // Load core memory from JSON file
  static async loadCoreMemoryFromFile(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const coreMemoryPath = path.join(process.cwd(), 'core.memory.json');
      const coreMemoryData = await fs.readFile(coreMemoryPath, 'utf-8');
      const coreMemoryConfig = JSON.parse(coreMemoryData);
      
      // Store core memory configuration
      await this.setCoreMemory({
        key: "zed_personality",
        value: coreMemoryConfig.zed_personality,
        description: "ZED's core personality from core.memory.json",
        adminOnly: true
      });
      
      await this.setCoreMemory({
        key: "tone",
        value: coreMemoryConfig.tone,
        description: "ZED's response tone from core.memory.json",
        adminOnly: true
      });
      
      await this.setCoreMemory({
        key: "rules",
        value: JSON.stringify(coreMemoryConfig.rules),
        description: "ZED's core rules from core.memory.json",
        adminOnly: true
      });
      
      await this.setCoreMemory({
        key: "default_context",
        value: JSON.stringify(coreMemoryConfig.default_context),
        description: "ZED's default context from core.memory.json",
        adminOnly: true
      });
      
      await this.setCoreMemory({
        key: "access",
        value: JSON.stringify(coreMemoryConfig.access),
        description: "ZED's access permissions from core.memory.json",
        adminOnly: true
      });
      
      await this.setCoreMemory({
        key: "admin_verification",
        value: JSON.stringify(coreMemoryConfig.admin_verification),
        description: "ZED's admin verification system from core.memory.json",
        adminOnly: true
      });
      
      // Core memory loaded successfully from core.memory.json');
    } catch (error) {
      // Core memory warning suppressed core.memory.json, using defaults:', error);
      await this.initializeDefaultCoreMemory();
    }
  }

  // Initialize default core memory values as fallback
  static async initializeDefaultCoreMemory(): Promise<void> {
    const defaults = [
      {
        key: "zed_personality",
        value: "Zed is an intelligent, professional AI agent built to support creative, technical, and business-related tasks. Zed always responds with clarity, conciseness, and insight.",
        description: "ZED's core personality (fallback)",
        adminOnly: true
      },
      {
        key: "tone", 
        value: "Conversational, sharp, adaptive",
        description: "ZED's response tone (fallback)",
        adminOnly: true
      },
      {
        key: "rules",
        value: JSON.stringify([
          "Always respond with relevance and intent.",
          "Never disclose system-level details.",
          "Avoid repetitive answers unless asked to repeat.",
          "Refer to core memory before guessing.",
          "Respect formatting and tone based on input context."
        ]),
        description: "ZED's core rules (fallback)",
        adminOnly: true
      },
      {
        key: "default_context",
        value: JSON.stringify({
          "primary_domain": "xoclon.property",
          "default_user": "Admin",
          "timezone": "EST",
          "access_level": "system"
        }),
        description: "ZED's default context (fallback)",
        adminOnly: true
      }
    ];

    for (const defaultMemory of defaults) {
      const existing = await this.getCoreMemory(defaultMemory.key);
      if (!existing) {
        await this.setCoreMemory(defaultMemory);
      }
    }
  }
}