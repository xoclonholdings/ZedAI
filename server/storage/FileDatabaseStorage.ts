import { eq, desc, asc } from "drizzle-orm";
import { createHash, randomUUID } from "crypto";

import {
  type File,
  type InsertFile,
  files,
  fileStorage,
} from "../../shared/schema";

import { db } from "../db.ts";
import { fallbackStorage } from "./fallback";
import { memoryCache } from "./cache";

export class FileDatabaseStorage {
  private generateCacheKey(...parts: Array<string | number | undefined>) {
    return parts.filter(Boolean).join(":");
  }

  async getFile(id: string): Promise<File | undefined> {
    const cacheKey = this.generateCacheKey("file", id);
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;
    if (!db) {
      const fallback = await fallbackStorage.retrieve(`file_${id}`);
      if (fallback) memoryCache.set(cacheKey, fallback, 300000);
      return fallback;
    }

    try {
      const [file] = await db.select().from(files).where(eq(files.id, id));

      if (file) {
        memoryCache.set(cacheKey, file, 300000);
      }

      return file;
    } catch (error) {
      console.warn("[FILE STORAGE] getFile failed:", error);
      return undefined;
    }
  }

  async getFilesByConversation(conversationId: string): Promise<File[]> {
    const cacheKey = this.generateCacheKey("conversation_files", conversationId);
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;
    const fallbackKey = `conversation_files_${conversationId}`;
    if (!db) {
      const fallback = ((await fallbackStorage.retrieve(fallbackKey)) || []) as File[];
      memoryCache.set(cacheKey, fallback, 180000);
      return fallback;
    }

    try {
      const result = await db
        .select()
        .from(files)
        .where(eq(files.conversationId, conversationId))
        .orderBy(desc(files.createdAt))
        .limit(50);

      memoryCache.set(cacheKey, result, 180000);

      return result;
    } catch (error) {
      console.warn("[FILE STORAGE] getFilesByConversation failed:", error);
      return [];
    }
  }

  async createFile(data: InsertFile): Promise<File> {
    const id = randomUUID();
    const fallbackKey = `file_${id}`;

    if (!db) {
      const file = {
        id,
        ...data,
        extractedContent: data.extractedContent ?? null,
        analysis: data.analysis ?? null,
        createdAt: new Date(),
      } as File;
      await this.storeFallbackFile(file);
      return file;
    }

    const [file] = await db.insert(files).values({ id, ...data } as any).returning();

    memoryCache.delete(
      this.generateCacheKey("conversation_files", data.conversationId)
    );

    await fallbackStorage.store(fallbackKey, file);
    await this.storeFallbackFile(file);

    return file;
  }

  async updateFile(
    id: string,
    updates: Partial<File>
  ): Promise<File | undefined> {
    const fallbackKey = `file_${id}`;
    if (!db) {
      const existing = await fallbackStorage.retrieve(fallbackKey);
      if (!existing) return undefined;
      const updated = { ...existing, ...updates } as File;
      await this.storeFallbackFile(updated);
      return updated;
    }

    const [updated] = await db
      .update(files)
      .set(updates)
      .where(eq(files.id, id))
      .returning();

    if (updated) {
      memoryCache.delete(this.generateCacheKey("file", id));
      memoryCache.delete(
        this.generateCacheKey("conversation_files", updated.conversationId)
      );

      await fallbackStorage.store(fallbackKey, updated);
    }

    return updated;
  }

  async deleteFile(id: string): Promise<boolean> {
    const file = await this.getFile(id);
    await fallbackStorage.delete(`file_${id}`);
    if (file) {
      const listKey = `conversation_files_${file.conversationId}`;
      const list = ((await fallbackStorage.retrieve(listKey)) || []) as File[];
      await fallbackStorage.store(listKey, list.filter((item) => item.id !== id));
      memoryCache.delete(this.generateCacheKey("conversation_files", file.conversationId));
      memoryCache.delete(this.generateCacheKey("file", id));
    }

    if (!db) return Boolean(file);

    try {
      if (file) {
        await db.delete(fileStorage).where(eq(fileStorage.fileId, id));
      }

      const result = await db.delete(files).where(eq(files.id, id));
      const success = (result.rowCount ?? 0) > 0;

      if (success && file) {
        memoryCache.delete(this.generateCacheKey("file", id));
        memoryCache.delete(
          this.generateCacheKey("conversation_files", file.conversationId)
        );
      }

      return success;
    } catch (error) {
      console.error("[FILE STORAGE] deleteFile failed:", error);
      return false;
    }
  }

  async storeFileChunk(
    fileId: string,
    chunkIndex: number,
    chunkData: string,
    chunkSize: number
  ): Promise<boolean> {
    if (!db) return false;
    try {
      const checksum = createHash("md5").update(chunkData).digest("hex");

      await db.insert(fileStorage).values({
        fileId,
        chunkIndex,
        chunkData,
        chunkSize,
        checksum,
      });

      return true;
    } catch (error) {
      console.error("[FILE STORAGE] storeFileChunk failed:", error);
      return false;
    }
  }

  async getFileChunks(
    fileId: string
  ): Promise<{ chunkIndex: number; chunkData: string; chunkSize: number }[]> {
    if (!db) return [];
    return await db
      .select({
        chunkIndex: fileStorage.chunkIndex,
        chunkData: fileStorage.chunkData,
        chunkSize: fileStorage.chunkSize,
      })
      .from(fileStorage)
      .where(eq(fileStorage.fileId, fileId))
      .orderBy(asc(fileStorage.chunkIndex));
  }

  private async storeFallbackFile(file: File): Promise<void> {
    await fallbackStorage.store(`file_${file.id}`, file);
    const listKey = `conversation_files_${file.conversationId}`;
    const existing = ((await fallbackStorage.retrieve(listKey)) || []) as File[];
    const next = [file, ...existing.filter((item) => item.id !== file.id)].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
    await fallbackStorage.store(listKey, next);
    memoryCache.delete(this.generateCacheKey("file", file.id));
    memoryCache.delete(this.generateCacheKey("conversation_files", file.conversationId));
  }
}
