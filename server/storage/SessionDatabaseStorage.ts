import { eq } from "drizzle-orm";

import {
  type Session,
  type InsertSession,
  chatSessions,
} from "../../shared/schema";

import { db } from "../db.ts";
import { fallbackStorage } from "./fallback";
import { memoryCache } from "./cache";

export class SessionDatabaseStorage {
  private generateCacheKey(...parts: Array<string | number | undefined>) {
    return parts.filter(Boolean).join(":");
  }

  async getSession(conversationId: string): Promise<Session | undefined> {
    const cacheKey = this.generateCacheKey("session", conversationId);
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;

    try {
      const [session] = await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.conversationId, conversationId));

      if (session) {
        memoryCache.set(cacheKey, session, 120000);
      }

      return session;
    } catch (error) {
      console.warn("[SESSION STORAGE] getSession failed:", error);
      return undefined;
    }
  }

  async createSession(data: InsertSession): Promise<Session> {
    const fallbackKey = `session_${data.conversationId}`;

    const [session] = await db
      .insert(chatSessions)
      .values(data)
      .returning();

    memoryCache.delete(this.generateCacheKey("session", data.conversationId));
    await fallbackStorage.store(fallbackKey, session);

    return session;
  }

  async updateSession(
    id: string,
    updates: Partial<Session>
  ): Promise<Session | undefined> {
    const fallbackKey = `session_${id}`;

    const [updated] = await db
      .update(chatSessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(chatSessions.id, id))
      .returning();

    if (updated) {
      memoryCache.delete(
        this.generateCacheKey("session", updated.conversationId)
      );
      await fallbackStorage.store(fallbackKey, updated);
    }

    return updated;
  }
}