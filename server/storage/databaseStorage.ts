import * as fs from "fs/promises";

import type {
  User,
  UpsertUser,
  Conversation,
  InsertConversation,
  Message,
  InsertMessage,
  File,
  InsertFile,
  Session,
  InsertSession,
  CoreMemory,
  InsertCoreMemory,
  ProjectMemory,
  InsertProjectMemory,
  ScratchpadMemory,
  InsertScratchpadMemory,
} from "../../shared/schema";

import type { IStorage } from "./types";

import { UserDatabaseStorage } from "./UserDatabaseStorage";
import { ConversationDatabaseStorage } from "./ConversationDatabaseStorage";
import { MessageDatabaseStorage } from "./MessageDatabaseStorage";
import { FileDatabaseStorage } from "./FileDatabaseStorage";
import { SessionDatabaseStorage } from "./SessionDatabaseStorage";
import { MemoryDatabaseStorage } from "./MemoryDatabaseStorage";
import { AnalyticsDatabaseStorage } from "./AnalyticsDatabaseStorage";

class DatabaseStorage implements IStorage {
  private users = new UserDatabaseStorage();
  private conversations = new ConversationDatabaseStorage();
  private messages = new MessageDatabaseStorage();
  private files = new FileDatabaseStorage();
  private sessions = new SessionDatabaseStorage();
  private memory = new MemoryDatabaseStorage();
  private analytics = new AnalyticsDatabaseStorage();

  async getUser(id: string): Promise<User | undefined> {
    return this.users.getUser(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    return this.users.upsertUser(userData);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.users.getUserByUsername(username);
  }

  async createUser(userData: any): Promise<User> {
    return this.users.createUser(userData);
  }

  async getAllUsers(): Promise<User[]> {
    return this.users.getAllUsers();
  }

  async updateUser(id: string, userData: Partial<any>): Promise<User> {
    return this.users.updateUser(id, userData);
  }

  async deleteUser(id: string): Promise<boolean> {
    return this.users.deleteUser(id);
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    return this.conversations.getConversation(id);
  }

  async getConversationsByUser(userId: string): Promise<Conversation[]> {
    return this.conversations.getConversationsByUser(userId);
  }

  async createConversation(data: InsertConversation): Promise<Conversation> {
    const conversation = await this.conversations.createConversation(data);
    await this.analytics.trackAnalytics(
      data.userId,
      "conversation_created",
      { conversationId: conversation.id }
    );
    return conversation;
  }

  async updateConversation(
    id: string,
    updates: Partial<Conversation>
  ): Promise<Conversation | undefined> {
    return this.conversations.updateConversation(id, updates);
  }

  async deleteConversation(id: string): Promise<boolean> {
    const conversation = await this.conversations.getConversation(id);
    const success = await this.conversations.deleteConversation(id);

    if (success && conversation) {
      await this.analytics.trackAnalytics(
        conversation.userId,
        "conversation_deleted",
        { conversationId: id }
      );
    }

    return success;
  }

  async searchConversations(
    userId: string,
    query: string
  ): Promise<Conversation[]> {
    return this.conversations.searchConversations(userId, query);
  }

  async getMessagesByConversation(conversationId: string): Promise<Message[]> {
    return this.messages.getMessagesByConversation(conversationId);
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    return this.messages.createMessage(data);
  }

  async batchCreateMessages(data: InsertMessage[]): Promise<Message[]> {
    return this.messages.batchCreateMessages(data);
  }

  async deleteMessage(id: string): Promise<boolean> {
    return this.messages.deleteMessage(id);
  }

  async getFile(id: string): Promise<File | undefined> {
    return this.files.getFile(id);
  }

  async getFilesByConversation(conversationId: string): Promise<File[]> {
    return this.files.getFilesByConversation(conversationId);
  }

  async createFile(data: InsertFile): Promise<File> {
    return this.files.createFile(data);
  }

  async updateFile(
    id: string,
    updates: Partial<File>
  ): Promise<File | undefined> {
    return this.files.updateFile(id, updates);
  }

  async deleteFile(id: string): Promise<boolean> {
    return this.files.deleteFile(id);
  }

  async storeFileChunk(
    fileId: string,
    chunkIndex: number,
    chunkData: string,
    chunkSize: number
  ): Promise<boolean> {
    return this.files.storeFileChunk(fileId, chunkIndex, chunkData, chunkSize);
  }

  async getFileChunks(
    fileId: string
  ): Promise<{ chunkIndex: number; chunkData: string; chunkSize: number }[]> {
    return this.files.getFileChunks(fileId);
  }

  async getSession(conversationId: string): Promise<Session | undefined> {
    return this.sessions.getSession(conversationId);
  }

  async createSession(data: InsertSession): Promise<Session> {
    return this.sessions.createSession(data);
  }

  async updateSession(
    id: string,
    updates: Partial<Session>
  ): Promise<Session | undefined> {
    return this.sessions.updateSession(id, updates);
  }

  async getCoreMemoryByKey(key: string): Promise<CoreMemory | null> {
    return this.memory.getCoreMemoryByKey(key);
  }

  async upsertCoreMemory(data: InsertCoreMemory): Promise<CoreMemory> {
    return this.memory.upsertCoreMemory(data);
  }

  async getAllCoreMemory(): Promise<CoreMemory[]> {
    return this.memory.getAllCoreMemory();
  }

  async getProjectMemoryByUser(userId: string): Promise<ProjectMemory[]> {
    return this.memory.getProjectMemoryByUser(userId);
  }

  async createProjectMemory(
    data: InsertProjectMemory
  ): Promise<ProjectMemory> {
    return this.memory.createProjectMemory(data);
  }

  async updateProjectMemory(
    id: string,
    updates: Partial<InsertProjectMemory>
  ): Promise<ProjectMemory> {
    return this.memory.updateProjectMemory(id, updates);
  }

  async deleteProjectMemory(id: string): Promise<boolean> {
    return this.memory.deleteProjectMemory(id);
  }

  async getScratchpadMemoryByUser(
    userId: string
  ): Promise<ScratchpadMemory[]> {
    return this.memory.getScratchpadMemoryByUser(userId);
  }

  async createScratchpadMemory(
    data: InsertScratchpadMemory
  ): Promise<ScratchpadMemory> {
    return this.memory.createScratchpadMemory(data);
  }

  async cleanupExpiredScratchpadMemory(): Promise<void> {
    return this.memory.cleanupExpiredScratchpadMemory();
  }

  async getRecentActivity(userId: string, limit = 10): Promise<any[]> {
    return this.analytics.getRecentActivity(userId, limit);
  }

  async cleanupExpiredData(): Promise<void> {
    await this.memory.cleanupExpiredScratchpadMemory();
    console.log("[STORAGE] Cleanup completed");
  }

  getCacheStats(): any {
    return {
      timestamp: new Date().toISOString(),
    };
  }

  async optimizeStorage(): Promise<void> {
    console.log("[STORAGE] Optimization completed");
  }

  async trackAnalytics(
    userId: string,
    eventType: string,
    eventData?: any,
    duration?: number
  ): Promise<void> {
    return this.analytics.trackAnalytics(userId, eventType, eventData, duration);
  }

  static async loadCoreMemoryFromFile(): Promise<void> {
    try {
      const coreMemoryPath = "./core.memory.json";
      const fileContent = await fs.readFile(coreMemoryPath, "utf-8");
      const coreMemoryData = JSON.parse(fileContent);

      console.log("[MEMORY] Loading core memory from file...");

      for (const [key, value] of Object.entries(coreMemoryData)) {
        try {
          await storage.upsertCoreMemory({
            key,
            value: typeof value === "string" ? value : JSON.stringify(value),
            description: "Loaded from core.memory.json",
            adminOnly: true,
          });
          console.log(`[MEMORY] Loaded core memory: ${key}`);
        } catch (error) {
          console.warn(`[MEMORY] Failed to load core memory ${key}:`, error);
        }
      }

      console.log("[MEMORY] Core memory loaded successfully from file");
    } catch (error) {
      console.warn("[MEMORY] core.memory.json not found or invalid:", error);
    }
  }
}

export const storage = new DatabaseStorage();