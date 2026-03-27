import { eq, asc } from "drizzle-orm";

import {
  type User,
  type UpsertUser,
  users,
} from "../../../shared/schema.ts";
import { db } from "../db.ts";
import { fallbackStorage } from "./fallback";
import { memoryCache } from "./cache";

export class UserDatabaseStorage {
  private generateCacheKey(...parts: Array<string | number | undefined>) {
    return parts.filter(Boolean).join(":");
  }

  async getUser(id: string): Promise<User | undefined> {
    const cacheKey = this.generateCacheKey("user", id);
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;

    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));

      if (user) {
        memoryCache.set(cacheKey, user, 600000);
      }

      return user;
    } catch (error) {
      console.warn("[USER STORAGE] getUser failed:", error);
      return undefined;
    }
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const fallbackKey = `user_${userData.id}`;

    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();

    memoryCache.delete(this.generateCacheKey("user", userData.id));

    if ((userData as any).username) {
      memoryCache.delete(
        this.generateCacheKey("user_by_username", (userData as any).username),
      );
    }

    memoryCache.delete(this.generateCacheKey("all_users"));

    await fallbackStorage.store(fallbackKey, user);

    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const cacheKey = this.generateCacheKey("user_by_username", username);
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;

    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq((users as any).username, username));

      if (user) {
        memoryCache.set(cacheKey, user, 600000);
      }

      return user;
    } catch (error) {
      console.warn("[USER STORAGE] getUserByUsername failed:", error);
      return undefined;
    }
  }

  async createUser(userData: any): Promise<User> {
    const fallbackKey = `user_${userData.id}`;

    const [user] = await db.insert(users).values(userData).returning();

    memoryCache.delete(this.generateCacheKey("all_users"));

    if (userData.username) {
      memoryCache.delete(
        this.generateCacheKey("user_by_username", userData.username),
      );
    }

    await fallbackStorage.store(fallbackKey, user);

    return user;
  }

  async getAllUsers(): Promise<User[]> {
    const cacheKey = this.generateCacheKey("all_users");
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;

    try {
      const allUsers = await db
        .select()
        .from(users)
        .orderBy(asc((users as any).username));

      memoryCache.set(cacheKey, allUsers, 300000);

      return allUsers;
    } catch (error) {
      console.warn("[USER STORAGE] getAllUsers failed:", error);
      return [];
    }
  }

  async updateUser(id: string, userData: Partial<any>): Promise<User> {
    const fallbackKey = `user_${id}`;

    const [user] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    memoryCache.delete(this.generateCacheKey("user", id));
    memoryCache.delete(this.generateCacheKey("all_users"));

    if (userData.username) {
      memoryCache.delete(
        this.generateCacheKey("user_by_username", userData.username),
      );
    }

    if (user) {
      await fallbackStorage.store(fallbackKey, user);
    }

    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    await fallbackStorage.delete(`user_${id}`);

    try {
      const user = await this.getUser(id);
      const result = await db.delete(users).where(eq(users.id, id));
      const success = (result.rowCount ?? 0) > 0;

      if (success) {
        memoryCache.delete(this.generateCacheKey("user", id));
        memoryCache.delete(this.generateCacheKey("all_users"));

        if ((user as any)?.username) {
          memoryCache.delete(
            this.generateCacheKey("user_by_username", (user as any).username),
          );
        }
      }

      return success;
    } catch (error) {
      console.error(`[USER STORAGE] deleteUser failed for ${id}:`, error);
      return false;
    }
  }
}