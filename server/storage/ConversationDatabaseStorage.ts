import { eq, desc, and, or, sql } from "drizzle-orm";

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
    const [conversation] = await db
      .insert(conversations)
      .values(data)
      .returning();

    memoryCache.delete(
      this.generateCacheKey("user_conversations", data.userId)
    );

    try {
      await fallbackStorage.store(`conversation_${conversation.id}`, conversation);
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
    try {
      await fallbackStorage.delete(`conversation_${id}`);
    } catch (error) {
      console.warn("[CONVO STORAGE] fallback delete failed:", error);
    }

    const conversation = await this.getConversation(id);

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