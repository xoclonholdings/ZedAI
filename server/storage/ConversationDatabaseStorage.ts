import { eq, desc, and, or, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

import {
  type Conversation,
  type InsertConversation,
  conversations,
} from "../../shared/schema";

import { db } from "../db.ts";
import { fallbackStorage } from "./fallback";
import { memoryCache } from "./cache";

export class ConversationDatabaseStorage {
  private generateCacheKey(...parts: Array<string | number | undefined>) {
    return parts.filter(Boolean).join(":");
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const cacheKey = this.generateCacheKey("conversation", id);
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;
    if (!db) {
      const fallback = await fallbackStorage.retrieve(`conversation_${id}`);
      if (fallback) memoryCache.set(cacheKey, fallback, 300000);
      return fallback;
    }

    try {
      const [conversation] = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, id));

      if (conversation) {
        memoryCache.set(cacheKey, conversation, 300000);
      }

      return conversation;
    } catch (error) {
      console.warn("[CONVO STORAGE] getConversation failed:", error);
      return undefined;
    }
  }

  async getConversationsByUser(userId: string): Promise<Conversation[]> {
    const cacheKey = this.generateCacheKey("user_conversations", userId);
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;
    if (!db) {
      const fallback = (await fallbackStorage.retrieve(`user_conversations_${userId}`)) || [];
      memoryCache.set(cacheKey, fallback, 120000);
      return fallback;
    }

    try {
      const result = await db
        .select()
        .from(conversations)
        .where(eq(conversations.userId, userId))
        .orderBy(desc(conversations.updatedAt))
        .limit(100);

      memoryCache.set(cacheKey, result, 120000);

      return result;
    } catch (error) {
      console.warn("[CONVO STORAGE] getConversationsByUser failed:", error);
      return [];
    }
  }

  async createConversation(data: InsertConversation): Promise<Conversation> {
    if (!db) {
      const conversation = {
        id: randomUUID(),
        ...data,
        preview: (data as any).preview ?? null,
        isActive: data.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Conversation;
      const listKey = `user_conversations_${data.userId}`;
      const existing = ((await fallbackStorage.retrieve(listKey)) || []) as Conversation[];
      await fallbackStorage.store(`conversation_${conversation.id}`, conversation);
      await fallbackStorage.store(listKey, [conversation, ...existing.filter((item) => item.id !== conversation.id)]);
      memoryCache.delete(this.generateCacheKey("user_conversations", data.userId));
      memoryCache.set(this.generateCacheKey("conversation", conversation.id), conversation, 300000);
      return conversation;
    }

    const [conversation] = await db
      .insert(conversations)
      .values(data)
      .returning();

    memoryCache.delete(
      this.generateCacheKey("user_conversations", data.userId)
    );

    try {
      await fallbackStorage.store(`conversation_${conversation.id}`, conversation);
      const listKey = `user_conversations_${conversation.userId}`;
      const existing = ((await fallbackStorage.retrieve(listKey)) || []) as Conversation[];
      await fallbackStorage.store(listKey, [conversation, ...existing.filter((item) => item.id !== conversation.id)]);
    } catch (error) {
      console.warn("[CONVO STORAGE] fallback store failed:", error);
    }

    return conversation;
  }

  async updateConversation(
    id: string,
    updates: Partial<Conversation>
  ): Promise<Conversation | undefined> {
    const fallbackKey = `conversation_${id}`;
    if (!db) {
      const existing = await fallbackStorage.retrieve(fallbackKey);
      if (!existing) return undefined;
      const updated = { ...existing, ...updates, updatedAt: new Date() } as Conversation;
      await fallbackStorage.store(fallbackKey, updated);
      const listKey = `user_conversations_${updated.userId}`;
      const list = ((await fallbackStorage.retrieve(listKey)) || []) as Conversation[];
      await fallbackStorage.store(listKey, [updated, ...list.filter((item) => item.id !== id)]);
      memoryCache.delete(this.generateCacheKey("conversation", id));
      memoryCache.delete(this.generateCacheKey("user_conversations", updated.userId));
      return updated;
    }

    const [updated] = await db
      .update(conversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();

    if (updated) {
      memoryCache.delete(this.generateCacheKey("conversation", id));
      memoryCache.delete(
        this.generateCacheKey("user_conversations", updated.userId)
      );

      try {
        await fallbackStorage.store(fallbackKey, updated);
      } catch (error) {
        console.warn("[CONVO STORAGE] fallback update store failed:", error);
      }
    }

    return updated;
  }

  async deleteConversation(id: string): Promise<boolean> {
    const conversation = await this.getConversation(id);

    try {
      await fallbackStorage.delete(`conversation_${id}`);
      if (conversation) {
        const listKey = `user_conversations_${conversation.userId}`;
        const list = ((await fallbackStorage.retrieve(listKey)) || []) as Conversation[];
        await fallbackStorage.store(listKey, list.filter((item) => item.id !== id));
      }
    } catch (error) {
      console.warn("[CONVO STORAGE] fallback delete failed:", error);
    }

    if (!db) {
      if (conversation) {
        memoryCache.delete(this.generateCacheKey("conversation", id));
        memoryCache.delete(this.generateCacheKey("user_conversations", conversation.userId));
      }
      return Boolean(conversation);
    }

    try {
      const result = await db
        .delete(conversations)
        .where(eq(conversations.id, id));

      const success = (result.rowCount ?? 0) > 0;

      if (success && conversation) {
        memoryCache.delete(this.generateCacheKey("conversation", id));
        memoryCache.delete(
          this.generateCacheKey("user_conversations", conversation.userId)
        );
      }

      return success;
    } catch (error) {
      console.error("[CONVO STORAGE] deleteConversation failed:", error);
      return false;
    }
  }

  async searchConversations(
    userId: string,
    query: string
  ): Promise<Conversation[]> {
    const searchQuery = `%${query.toLowerCase()}%`;

    return await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.userId, userId),
          or(
            sql`LOWER(${conversations.title}) LIKE ${searchQuery}`,
            sql`LOWER(${conversations.preview}) LIKE ${searchQuery}`
          )
        )
      )
      .orderBy(desc(conversations.updatedAt))
      .limit(20);
  }
}
