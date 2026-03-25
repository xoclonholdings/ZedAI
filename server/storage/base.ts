import { createHash } from "crypto";
import { fallbackStorage } from "./fallback";
import type { IStorage } from "./types";

export abstract class BaseStorage implements IStorage {
  protected isOfflineMode = false;

  protected setOfflineMode(isOffline: boolean): void {
    if (isOffline && !this.isOfflineMode) {
      console.warn("[STORAGE] Switching to OFFLINE MODE.");
      this.isOfflineMode = true;
    } else if (!isOffline && this.isOfflineMode) {
      console.log("[STORAGE] Switching back to ONLINE MODE.");
      this.isOfflineMode = false;
    }
  }

  protected generateCacheKey(operation: string, ...params: any[]): string {
    return createHash("md5")
      .update(`${operation}:${JSON.stringify(params)}`)
      .digest("hex");
  }

  async executeWithFallback<T>(
    operationName: string,
    dbOperation: () => Promise<T>,
    fallbackKey: string,
    defaultValue?: T
  ): Promise<T> {
    try {
      if (!this.isOfflineMode) {
        const result = await dbOperation();

        if (result !== undefined && result !== null) {
          await fallbackStorage.store(fallbackKey, result);
          return result;
        }

        if (defaultValue !== undefined) {
          await fallbackStorage.store(fallbackKey, defaultValue);
          return defaultValue;
        }

        return result;
      }

      const fallbackResult = await fallbackStorage.retrieve<T>(fallbackKey);
      if (fallbackResult !== null) {
        return fallbackResult;
      }

      if (defaultValue !== undefined) {
        return defaultValue;
      }

      throw new Error(
        `[STORAGE] No fallback data available for ${operationName} (${fallbackKey})`
      );
    } catch (error) {
      console.warn(`[STORAGE] Database error during ${operationName}:`, error);
      this.setOfflineMode(true);

      const fallbackResult = await fallbackStorage.retrieve<T>(fallbackKey);
      if (fallbackResult !== null) {
        console.log(`[STORAGE] Using fallback data for ${operationName}`);
        return fallbackResult;
      }

      if (defaultValue !== undefined) {
        console.log(`[STORAGE] Using default value for ${operationName}`);
        return defaultValue;
      }

      throw new Error(
        `[STORAGE] Failed to execute ${operationName} and no fallback data exists for ${fallbackKey}`
      );
    }
  }

  abstract getUser(id: string): Promise<any>;
  abstract getUserByUsername(username: string): Promise<any>;
  abstract upsertUser(user: any): Promise<any>;
  abstract createUser(userData: any): Promise<any>;
  abstract getAllUsers(): Promise<any[]>;
  abstract updateUser(id: string, userData: Partial<any>): Promise<any>;
  abstract deleteUser(id: string): Promise<boolean>;

  abstract getConversation(id: string): Promise<any>;
  abstract getConversationsByUser(userId: string): Promise<any[]>;
  abstract createConversation(conversation: any): Promise<any>;
  abstract updateConversation(id: string, updates: Partial<any>): Promise<any>;
  abstract deleteConversation(id: string): Promise<boolean>;

  abstract getMessagesByConversation(conversationId: string): Promise<any[]>;
  abstract createMessage(message: any): Promise<any>;
  abstract deleteMessage(id: string): Promise<boolean>;
  abstract batchCreateMessages(messages: any[]): Promise<any[]>;

  abstract getFile(id: string): Promise<any>;
  abstract getFilesByConversation(conversationId: string): Promise<any[]>;
  abstract createFile(file: any): Promise<any>;
  abstract updateFile(id: string, updates: Partial<any>): Promise<any>;
  abstract deleteFile(id: string): Promise<boolean>;
  abstract storeFileChunk(
    fileId: string,
    chunkIndex: number,
    chunkData: string,
    chunkSize: number
  ): Promise<boolean>;
  abstract getFileChunks(
    fileId: string
  ): Promise<{ chunkIndex: number; chunkData: string; chunkSize: number }[]>;

  abstract getSession(conversationId: string): Promise<any>;
  abstract createSession(session: any): Promise<any>;
  abstract updateSession(id: string, updates: Partial<any>): Promise<any>;

  abstract getCoreMemoryByKey(key: string): Promise<any>;
  abstract upsertCoreMemory(data: any): Promise<any>;
  abstract getAllCoreMemory(): Promise<any[]>;

  abstract getProjectMemoryByUser(userId: string): Promise<any[]>;
  abstract createProjectMemory(data: any): Promise<any>;
  abstract updateProjectMemory(id: string, updates: Partial<any>): Promise<any>;
  abstract deleteProjectMemory(id: string): Promise<boolean>;

  abstract getScratchpadMemoryByUser(userId: string): Promise<any[]>;
  abstract createScratchpadMemory(data: any): Promise<any>;
  abstract cleanupExpiredScratchpadMemory(): Promise<void>;

  abstract searchConversations(userId: string, query: string): Promise<any[]>;
  abstract getRecentActivity(userId: string, limit?: number): Promise<any[]>;
  abstract cleanupExpiredData(): Promise<void>;
  abstract getCacheStats(): any;
  abstract optimizeStorage(): Promise<void>;
}