import { eq, desc } from "drizzle-orm";

import {
  analytics,
} from "../../shared/schema";

import { db } from "../db.ts";
import { memoryCache } from "./cache";

export class AnalyticsDatabaseStorage {
  private generateCacheKey(...parts: Array<string | number | undefined>) {
    return parts.filter(Boolean).join(":");
  }

  async trackAnalytics(
    userId: string,
    eventType: string,
    eventData?: any,
    duration?: number
  ): Promise<void> {
    try {
      await db.insert(analytics).values({
        userId,
        eventType,
        eventData,
        duration,
        sessionId: `session_${Date.now()}`,
        metadata: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      console.warn("[ANALYTICS STORAGE] trackAnalytics failed:", error);
    }
  }

  async getRecentActivity(userId: string, limit = 10): Promise<any[]> {
    const cacheKey = this.generateCacheKey("recent_activity", userId, limit);
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;

    try {
      const result = await db
        .select({
          id: analytics.id,
          eventType: analytics.eventType,
          eventData: analytics.eventData,
          createdAt: analytics.createdAt,
          conversationId: analytics.conversationId,
        })
        .from(analytics)
        .where(eq(analytics.userId, userId))
        .orderBy(desc(analytics.createdAt))
        .limit(limit);

      memoryCache.set(cacheKey, result, 60000);

      return result;
    } catch (error) {
      console.warn("[ANALYTICS STORAGE] getRecentActivity failed:", error);
      return [];
    }
  }
}