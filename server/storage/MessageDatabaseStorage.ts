import { eq, asc } from "drizzle-orm";
import { randomUUID } from "crypto";

import {
  type Message,
  type InsertMessage,
  messages,
} from "../../shared/schema";

import { db } from "../db.ts";
import { fallbackStorage } from "./fallback";
import { memoryCache } from "./cache";

export class MessageDatabaseStorage {
  private generateCacheKey(...parts: Array<string | number | undefined>) {
    return parts.filter(Boolean).join(":");
  }

  async getMessagesByConversation(conversationId: string): Promise<Message[]> {
    const cacheKey = this.generateCacheKey("messages", conversationId);
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;
    if (!db) return [];

    try {
      const result = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(asc(messages.createdAt))
        .limit(1000);

      memoryCache.set(cacheKey, result, 60000);

      return result;
    } catch (error) {
      console.warn("[MESSAGE STORAGE] getMessagesByConversation failed:", error);
      return [];
    }
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    const fallbackKey = `messages_${data.conversationId}`;

    if (!db) {
      const message = {
        id: randomUUID(),
        ...data,
        metadata: data.metadata ?? null,
        createdAt: new Date(),
      } as Message;
      await fallbackStorage.store(fallbackKey, {
        message,
        timestamp: Date.now(),
      });
      memoryCache.delete(this.generateCacheKey("messages", data.conversationId));
      return message;
    }

    const [message] = await db
      .insert(messages)
      .values(data)
      .returning();

    memoryCache.delete(this.generateCacheKey("messages", data.conversationId));

    await fallbackStorage.store(fallbackKey, {
      message,
      timestamp: Date.now(),
    });

    return message;
  }

  async batchCreateMessages(data: InsertMessage[]): Promise<Message[]> {
    if (data.length === 0) return [];

    const fallbackKey = `messages_batch_${Date.now()}`;

    if (!db) {
      const result = data.map((item) => ({
        id: randomUUID(),
        ...item,
        metadata: item.metadata ?? null,
        createdAt: new Date(),
      })) as Message[];
      await fallbackStorage.store(fallbackKey, result);
      for (const conversationId of new Set(data.map((item) => item.conversationId))) {
        memoryCache.delete(this.generateCacheKey("messages", conversationId));
      }
      return result;
    }

    const result = await db
      .insert(messages)
      .values(data)
      .returning();

    const conversationIds = Array.from(
      new Set(data.map((item) => item.conversationId))
    );

    for (const conversationId of conversationIds) {
      memoryCache.delete(this.generateCacheKey("messages", conversationId));
    }

    await fallbackStorage.store(fallbackKey, result);

    return result;
  }

  async deleteMessage(id: string): Promise<boolean> {
    let conversationId: string | undefined;

    try {
      const [message] = await db
        .select()
        .from(messages)
        .where(eq(messages.id, id));

      conversationId = message?.conversationId;

      if (conversationId) {
        await fallbackStorage.delete(`messages_${conversationId}`);
      }

      const result = await db
        .delete(messages)
        .where(eq(messages.id, id));

      const success = (result.rowCount ?? 0) > 0;

      if (success && conversationId) {
        memoryCache.delete(this.generateCacheKey("messages", conversationId));
      }

      return success;
    } catch (error) {
      console.error("[MESSAGE STORAGE] deleteMessage failed:", error);
      return false;
    }
  }
}
