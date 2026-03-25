import {
  type User,
  type UpsertUser,
  type Conversation,
  type InsertConversation,
  type Message,
  type InsertMessage,
  type File,
  type InsertFile,
  type Session,
  type InsertSession,
  type CoreMemory,
  type InsertCoreMemory,
  type ProjectMemory,
  type InsertProjectMemory,
  type ScratchpadMemory,
  type InsertScratchpadMemory,
} from "@shared/schema";
import { db } from "../db.ts";
import {
  users,
  conversations,
  messages,
  files,
  chatSessions,
  coreMemory,
  projectMemory,
  scratchpadMemory,
  fileStorage,
  memoryIndex,
  knowledgeBase,
  cacheStorage,
  analytics
} from "@shared/schema";
import { eq, and, or, desc, asc, inArray, sql } from "drizzle-orm";
import { BaseStorage } from "./base";
import { fallbackStorage } from "./fallback";
import { memoryCache } from "./cache";
import type { IStorage } from "./types";
import * as fs from "fs/promises";
import { createHash } from "crypto";

export class DatabaseStorage extends BaseStorage implements IStorage {

  private async trackAnalytics(userId: string, eventType: string, eventData?: any, duration?: number): Promise<void> {
    try {
      await db.insert(analytics).values({
        userId,
        eventType,
        eventData,
        duration,
        sessionId: `session_${Date.now()}`,
        metadata: { timestamp: new Date().toISOString() }
      });
    } catch (error) {
      console.warn('[ANALYTICS] Failed to track event:', error);
    }
  }

  // User operations for authentication system
  async getUser(id: string): Promise<User | undefined> {
  const cacheKey = this.generateCacheKey('user', id);
  const cached = memoryCache.get(cacheKey);
  if (cached) return cached;

  try {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (user) {
      memoryCache.set(cacheKey, user, 600000); // Cache for 10 minutes
    }
    return user;
  } catch (error) {
    console.warn('[STORAGE] Database error, switching to offline mode:', error);
    this.setOfflineMode(true);
    return undefined;
  }
}

  async upsertUser(userData: UpsertUser): Promise<User> {
    const fallbackKey = `user_${userData.id}`;
    return await this.executeWithFallback(
      'upsertUser',
      async () => {
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

        // Clear user cache
        const cacheKey = this.generateCacheKey('user', userData.id);
        memoryCache.delete(cacheKey);

        // Store in fallback
        await fallbackStorage.store(fallbackKey, user);
        return user;
      },
      fallbackKey
    );
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const cacheKey = this.generateCacheKey('user_by_username', username);
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;

    const fallbackKey = `user_by_username_${username}`;
    return await this.executeWithFallback(
      'getUserByUsername',
      async () => {
        const [user] = await db.select().from(users).where(eq(users.username, username));
        if (user) {
          memoryCache.set(cacheKey, user, 600000); // Cache for 10 minutes
        }
        return user;
      },
      fallbackKey
    );
  }

  async createUser(userData: any): Promise<User> {
    const fallbackKey = `user_${userData.id}`;
    return await this.executeWithFallback(
      'createUser',
      async () => {
        const [user] = await db.insert(users).values(userData).returning();

        // Clear relevant caches
        const usernameCacheKey = this.generateCacheKey('user_by_username', userData.username);
        const allUsersCacheKey = this.generateCacheKey('all_users');
        memoryCache.delete(usernameCacheKey);
        memoryCache.delete(allUsersCacheKey);

        // Store in fallback
        await fallbackStorage.store(fallbackKey, user);

        return user;
      },
      fallbackKey
    );
  }

  async getAllUsers(): Promise<User[]> {
    const cacheKey = this.generateCacheKey('all_users');
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;

    const fallbackKey = 'all_users';
    return await this.executeWithFallback(
      'getAllUsers',
      async () => {
        const allUsers = await db.select().from(users).orderBy(asc(users.username));
        memoryCache.set(cacheKey, allUsers, 300000); // Cache for 5 minutes
        return allUsers;
      },
      fallbackKey,
      [] // Default to empty array if fallback fails
    );
  }

  async updateUser(id: string, userData: Partial<any>): Promise<User> {
    const fallbackKey = `user_${id}`;
    return await this.executeWithFallback(
      'updateUser',
      async () => {
        const [user] = await db.update(users)
          .set({ ...userData, updatedAt: new Date() })
          .where(eq(users.id, id))
          .returning();

        // Clear relevant caches
        const userCacheKey = this.generateCacheKey('user', id);
        const allUsersCacheKey = this.generateCacheKey('all_users');
        memoryCache.delete(userCacheKey);
        memoryCache.delete(allUsersCacheKey);

        if (userData.username) {
          const usernameCacheKey = this.generateCacheKey('user_by_username', userData.username);
          memoryCache.delete(usernameCacheKey);
        }

        // Store in fallback
        if (user) {
          await fallbackStorage.store(fallbackKey, user);
        }

        return user;
      },
      fallbackKey
    );
  }

  async deleteUser(id: string): Promise<boolean> {
    // Attempt to delete from fallback first
    const fallbackDeleted = await fallbackStorage.delete(`user_${id}`);

    try {
      const user = await this.getUser(id); // Get user data before deletion
      const result = await db.delete(users).where(eq(users.id, id));
      const success = (result.rowCount ?? 0) > 0;

      if (success && user) {
        // Clear all related caches
        const userCacheKey = this.generateCacheKey('user', id);
        const usernameCacheKey = this.generateCacheKey('user_by_username', user.username);
        const allUsersCacheKey = this.generateCacheKey('all_users');
        memoryCache.delete(userCacheKey);
        memoryCache.delete(usernameCacheKey);
        memoryCache.delete(allUsersCacheKey);
      }
      return success;
    } catch (error) {
      console.error(`[STORAGE] Error deleting user ${id}:`, error);
      // If DB delete fails, but fallback delete succeeded, consider it a partial success or handle accordingly
      return fallbackDeleted; // Return status of fallback delete if DB op fails
    }
  }

  // Conversation operations with caching
  async getConversation(id: string): Promise<Conversation | undefined> {
    const cacheKey = this.generateCacheKey('conversation', id);
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;

    const fallbackKey = `conversation_${id}`;
    return await this.executeWithFallback(
      'getConversation',
      async () => {
        const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
        if (conversation) {
          memoryCache.set(cacheKey, conversation, 300000); // Cache for 5 minutes
        }
        return conversation;
      },
      fallbackKey
    );
  }

  async getConversationsByUser(userId: string): Promise<Conversation[]> {
    const cacheKey = this.generateCacheKey('user_conversations', userId);
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;

    const fallbackKey = `user_conversations_${userId}`;
    return await this.executeWithFallback(
      'getConversationsByUser',
      async () => {
        const userConversations = await db.select().from(conversations)
          .where(eq(conversations.userId, userId))
          .orderBy(desc(conversations.updatedAt))
          .limit(100); // Limit for performance

        memoryCache.set(cacheKey, userConversations, 120000); // Cache for 2 minutes
        return userConversations;
      },
      fallbackKey,
      []
    );
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const fallbackKey = `conversation_${conversation.id}`;
    return await this.executeWithFallback(
      'createConversation',
      async () => {
        const [newConversation] = await db.insert(conversations).values(conversation).returning();

        // Clear user conversations cache
        const userCacheKey = this.generateCacheKey('user_conversations', conversation.userId);
        memoryCache.delete(userCacheKey);

        // Track analytics
        await this.trackAnalytics(conversation.userId, 'conversation_created', { conversationId: newConversation.id });

        // Store in fallback
        await fallbackStorage.store(fallbackKey, newConversation);

        return newConversation;
      },
      fallbackKey
    );
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined> {
    const fallbackKey = `conversation_${id}`;
    return await this.executeWithFallback(
      'updateConversation',
      async () => {
        const [updated] = await db.update(conversations)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(conversations.id, id))
          .returning();

        if (updated) {
          // Clear related caches
          const cacheKey = this.generateCacheKey('conversation', id);
          const userCacheKey = this.generateCacheKey('user_conversations', updated.userId);
          memoryCache.delete(cacheKey);
          memoryCache.delete(userCacheKey);

          // Store in fallback
          await fallbackStorage.store(fallbackKey, updated);
        }

        return updated;
      },
      fallbackKey
    );
  }

  async deleteConversation(id: string): Promise<boolean> {
    // Attempt to delete from fallback first
    const fallbackDeleted = await fallbackStorage.delete(`conversation_${id}`);

    // Get conversation first to clear user cache
    const conversation = await this.getConversation(id);

    try {
      const result = await db.delete(conversations).where(eq(conversations.id, id));
      const success = (result.rowCount ?? 0) > 0;

      if (success && conversation) {
        // Clear related caches
        const cacheKey = this.generateCacheKey('conversation', id);
        const userCacheKey = this.generateCacheKey('user_conversations', conversation.userId);
        memoryCache.delete(cacheKey);
        memoryCache.delete(userCacheKey);

        // Track analytics
        await this.trackAnalytics(conversation.userId, 'conversation_deleted', { conversationId: id });
      }
      return success;
    } catch (error) {
      console.error(`[STORAGE] Error deleting conversation ${id}:`, error);
      return fallbackDeleted; // Return status of fallback delete if DB op fails
    }
  }

  // Message operations with optimization
  async getMessagesByConversation(conversationId: string): Promise<Message[]> {
    const cacheKey = this.generateCacheKey('messages', conversationId);
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;

    const fallbackKey = `messages_${conversationId}`;
    return await this.executeWithFallback(
      'getMessagesByConversation',
      async () => {
        const conversationMessages = await db.select().from(messages)
          .where(eq(messages.conversationId, conversationId))
          .orderBy(asc(messages.createdAt))
          .limit(1000); // Prevent excessive memory usage

        memoryCache.set(cacheKey, conversationMessages, 60000); // Cache for 1 minute
        return conversationMessages;
      },
      fallbackKey,
      []
    );
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const fallbackKey = `messages_${message.conversationId}`; // Note: This fallback key might be too broad if storing individual messages. Consider a more specific key or strategy for message fallbacks.
    return await this.executeWithFallback(
      'createMessage',
      async () => {
        const [newMessage] = await db.insert(messages).values(message).returning();

        // Clear messages cache for this conversation
        const cacheKey = this.generateCacheKey('messages', message.conversationId);
        memoryCache.delete(cacheKey);

        // Store in fallback - This might need a more sophisticated approach for many messages
        await fallbackStorage.store(fallbackKey, { message, timestamp: Date.now() }); // Simplified fallback storage

        return newMessage;
      },
      fallbackKey
    );
  }

  async batchCreateMessages(messagesList: InsertMessage[]): Promise<Message[]> {
    if (messagesList.length === 0) return [];

    // Fallback strategy for batch creation might involve storing all messages in a batch file
    const fallbackKey = `messages_batch_${Date.now()}`;
    return await this.executeWithFallback(
      'batchCreateMessages',
      async () => {
        const newMessages = await db.insert(messages).values(messagesList).returning();

        // Clear all affected conversation caches
        const conversationIds = Array.from(new Set(messagesList.map(m => m.conversationId)));
        conversationIds.forEach(conversationId => {
          const cacheKey = this.generateCacheKey('messages', conversationId);
          memoryCache.delete(cacheKey);
        });

        // Store in fallback
        await fallbackStorage.store(fallbackKey, newMessages);

        return newMessages;
      },
      fallbackKey,
      []
    );
  }

  async deleteMessage(id: string): Promise<boolean> {
    // Get message first to clear conversation cache and identify fallback key
    const [messageToDelete] = await db.select().from(messages).where(eq(messages.id, id));
    const fallbackKey = messageToDelete ? `messages_${messageToDelete.conversationId}` : null;

    // Attempt to delete from fallback if possible
    if (fallbackKey) {
      await fallbackStorage.delete(fallbackKey); // Simplified: deleting the whole fallback for the conversation
    }

    try {
      const result = await db.delete(messages).where(eq(messages.id, id));
      const success = (result.rowCount ?? 0) > 0;

      if (success && messageToDelete) {
        const cacheKey = this.generateCacheKey('messages', messageToDelete.conversationId);
        memoryCache.delete(cacheKey);
      }
      return success;
    } catch (error) {
      console.error(`[STORAGE] Error deleting message ${id}:`, error);
      return false; // Indicate failure if DB op fails
    }
  }

  // File operations with chunked storage
  async getFile(id: string): Promise<File | undefined> {
    const cacheKey = this.generateCacheKey('file', id);
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;

    const fallbackKey = `file_${id}`;
    return await this.executeWithFallback(
      'getFile',
      async () => {
        const [file] = await db.select().from(files).where(eq(files.id, id));
        if (file) {
          memoryCache.set(cacheKey, file, 300000); // Cache for 5 minutes
        }
        return file;
      },
      fallbackKey
    );
  }

  async getFilesByConversation(conversationId: string): Promise<File[]> {
    const cacheKey = this.generateCacheKey('conversation_files', conversationId);
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;

    const fallbackKey = `conversation_files_${conversationId}`;
    return await this.executeWithFallback(
      'getFilesByConversation',
      async () => {
        const conversationFiles = await db.select().from(files)
          .where(eq(files.conversationId, conversationId))
          .orderBy(desc(files.createdAt))
          .limit(50); // Reasonable limit

        memoryCache.set(cacheKey, conversationFiles, 180000); // Cache for 3 minutes
        return conversationFiles;
      },
      fallbackKey,
      []
    );
  }

  async createFile(file: InsertFile): Promise<File> {
    const fallbackKey = `file_${file.id}`;
    return await this.executeWithFallback(
      'createFile',
      async () => {
        const [newFile] = await db.insert(files).values(file).returning();

        // Clear conversation files cache
        const cacheKey = this.generateCacheKey('conversation_files', file.conversationId);
        memoryCache.delete(cacheKey);

        // Store in fallback
        await fallbackStorage.store(fallbackKey, newFile);

        return newFile;
      },
      fallbackKey
    );
  }

  async updateFile(id: string, updates: Partial<File>): Promise<File | undefined> {
    const fallbackKey = `file_${id}`;
    return await this.executeWithFallback(
      'updateFile',
      async () => {
        const [updated] = await db.update(files)
          .set(updates)
          .where(eq(files.id, id))
          .returning();

        if (updated) {
          // Clear related caches
          const fileCacheKey = this.generateCacheKey('file', id);
          const conversationCacheKey = this.generateCacheKey('conversation_files', updated.conversationId);
          memoryCache.delete(fileCacheKey);
          memoryCache.delete(conversationCacheKey);

          // Store in fallback
          await fallbackStorage.store(fallbackKey, updated);
        }

        return updated;
      },
      fallbackKey
    );
  }

  async deleteFile(id: string): Promise<boolean> {
    // Attempt to delete from fallback first
    const fallbackDeleted = await fallbackStorage.delete(`file_${id}`);

    // Get file first to clear conversation cache
    const file = await this.getFile(id);

    // Delete file chunks first from DB
    if (file) {
      await db.delete(fileStorage).where(eq(fileStorage.fileId, id));
      // Note: Fallback storage for chunks would also need deletion, which is complex.
    }

    try {
      const result = await db.delete(files).where(eq(files.id, id));
      const success = (result.rowCount ?? 0) > 0;

      if (success && file) {
        const fileCacheKey = this.generateCacheKey('file', id);
        const conversationCacheKey = this.generateCacheKey('conversation_files', file.conversationId);
        memoryCache.delete(fileCacheKey);
        memoryCache.delete(conversationCacheKey);
      }
      return success;
    } catch (error) {
      console.error(`[STORAGE] Error deleting file ${id}:`, error);
      return fallbackDeleted; // Return status of fallback delete if DB op fails
    }
  }

  async storeFileChunk(fileId: string, chunkIndex: number, chunkData: string, chunkSize: number): Promise<boolean> {
    try {
      const checksum = createHash('md5').update(chunkData).digest('hex');

      // In a fallback scenario, we'd store this chunk data to a file.
      // For simplicity, this example focuses on DB operations.
      await db.insert(fileStorage).values({
        fileId,
        chunkIndex,
        chunkData,
        chunkSize,
        checksum
      });

      return true;
    } catch (error) {
      console.error('[STORAGE] Failed to store file chunk:', error);
      return false;
    }
  }

  async getFileChunks(fileId: string): Promise<{ chunkIndex: number; chunkData: string; chunkSize: number }[]> {
    // Fallback for getFileChunks would involve reading from a directory of chunk files.
    const chunks = await db.select({
      chunkIndex: fileStorage.chunkIndex,
      chunkData: fileStorage.chunkData,
      chunkSize: fileStorage.chunkSize
    })
    .from(fileStorage)
    .where(eq(fileStorage.fileId, fileId))
    .orderBy(asc(fileStorage.chunkIndex));

    return chunks;
  }

  // Session operations
  async getSession(conversationId: string): Promise<Session | undefined> {
    const cacheKey = this.generateCacheKey('session', conversationId);
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;

    const fallbackKey = `session_${conversationId}`;
    return await this.executeWithFallback(
      'getSession',
      async () => {
        const [session] = await db.select().from(chatSessions).where(eq(chatSessions.conversationId, conversationId));
        if (session) {
          memoryCache.set(cacheKey, session, 120000); // Cache for 2 minutes
        }
        return session;
      },
      fallbackKey
    );
  }

  async createSession(session: InsertSession): Promise<Session> {
    const fallbackKey = `session_${session.conversationId}`;
    return await this.executeWithFallback(
      'createSession',
      async () => {
        const [newSession] = await db.insert(chatSessions).values(session).returning();
        await fallbackStorage.store(fallbackKey, newSession);
        return newSession;
      },
      fallbackKey
    );
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<Session | undefined> {
    const fallbackKey = `session_${id}`; // Assuming id is session ID, not conversationId for update
    return await this.executeWithFallback(
      'updateSession',
      async () => {
        const [updated] = await db.update(chatSessions)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(chatSessions.id, id))
          .returning();

        if (updated) {
          const cacheKey = this.generateCacheKey('session', updated.conversationId);
          memoryCache.delete(cacheKey);
          await fallbackStorage.store(fallbackKey, updated);
        }

        return updated;
      },
      fallbackKey
    );
  }

  // Memory system operations
  async getCoreMemoryByKey(key: string): Promise<CoreMemory | null> {
    const cacheKey = this.generateCacheKey('core_memory', key);
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;

    const fallbackKey = `core_memory_${key}`;
    return await this.executeWithFallback(
      'getCoreMemoryByKey',
      async () => {
        const [memory] = await db.select().from(coreMemory).where(eq(coreMemory.key, key));
        if (memory) {
          memoryCache.set(cacheKey, memory, 1800000); // Cache for 30 minutes
        }
        return memory || null;
      },
      fallbackKey
    );
  }

  async upsertCoreMemory(data: InsertCoreMemory): Promise<CoreMemory> {
    const fallbackKey = `core_memory_${data.key}`;
    return await this.executeWithFallback(
      'upsertCoreMemory',
      async () => {
        const [memory] = await db
          .insert(coreMemory)
          .values(data)
          .onConflictDoUpdate({
            target: coreMemory.key,
            set: {
              ...data,
              updatedAt: new Date(),
            },
          })
          .returning();

        // Clear cache
        const cacheKey = this.generateCacheKey('core_memory', data.key);
        memoryCache.delete(cacheKey);

        // Store in fallback
        await fallbackStorage.store(fallbackKey, memory);

        return memory;
      },
      fallbackKey
    );
  }

  async getAllCoreMemory(): Promise<CoreMemory[]> {
    const cacheKey = this.generateCacheKey('all_core_memory');
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;

    const fallbackKey = 'all_core_memory';
    return await this.executeWithFallback(
      'getAllCoreMemory',
      async () => {
        const memories = await db.select().from(coreMemory).orderBy(asc(coreMemory.key));
        memoryCache.set(cacheKey, memories, 600000); // Cache for 10 minutes
        return memories;
      },
      fallbackKey,
      []
    );
  }

  async getProjectMemoryByUser(userId: string): Promise<ProjectMemory[]> {
    const cacheKey = this.generateCacheKey('project_memory', userId);
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;

    const fallbackKey = `project_memory_${userId}`;
    return await this.executeWithFallback(
      'getProjectMemoryByUser',
      async () => {
        const memories = await db.select().from(projectMemory)
          .where(and(eq(projectMemory.userId, userId), eq(projectMemory.isActive, true)))
          .orderBy(desc(projectMemory.updatedAt));

        memoryCache.set(cacheKey, memories, 300000); // Cache for 5 minutes
        return memories;
      },
      fallbackKey,
      []
    );
  }

  async createProjectMemory(data: InsertProjectMemory): Promise<ProjectMemory> {
    const fallbackKey = `project_memory_${data.userId}`; // Fallback key based on user for list retrieval
    return await this.executeWithFallback(
      'createProjectMemory',
      async () => {
        const [memory] = await db.insert(projectMemory).values(data).returning();

        // Clear user cache
        const cacheKey = this.generateCacheKey('project_memory', data.userId);
        memoryCache.delete(cacheKey);

        // Store in fallback (simplified: overwrites previous for user)
        await fallbackStorage.store(fallbackKey, { ...memory, userId: data.userId }); // Include userId for fallback retrieval context

        return memory;
      },
      fallbackKey
    );
  }

  async updateProjectMemory(id: string, updates: Partial<InsertProjectMemory>): Promise<ProjectMemory> {
    const fallbackKey = `project_memory_${updates.userId}`; // Fallback key based on user
    return await this.executeWithFallback(
      'updateProjectMemory',
      async () => {
        const [updated] = await db.update(projectMemory)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(projectMemory.id, id))
          .returning();

        if (updated) {
          const cacheKey = this.generateCacheKey('project_memory', updated.userId);
          memoryCache.delete(cacheKey);
          // Update fallback: potentially need to fetch all for user, update one, then save all back
          // For simplicity, let's assume we overwrite with the updated item if it's the latest
          await fallbackStorage.store(fallbackKey, { ...updated, userId: updated.userId });
        }

        return updated;
      },
      fallbackKey
    );
  }

  async deleteProjectMemory(id: string): Promise<boolean> {
    const memory = await db.select().from(projectMemory).where(eq(projectMemory.id, id));
    const userId = memory.length > 0 ? memory[0].userId : null;
    const fallbackKey = userId ? `project_memory_${userId}` : null;

    // Attempt to delete from fallback
    if (fallbackKey) {
      await fallbackStorage.delete(fallbackKey); // Simplified: removing all project memory for the user
    }

    try {
      const result = await db.delete(projectMemory).where(eq(projectMemory.id, id));
      const success = (result.rowCount ?? 0) > 0;

      if (success && userId) {
        const cacheKey = this.generateCacheKey('project_memory', userId);
        memoryCache.delete(cacheKey);
      }
      return success;
    } catch (error) {
      console.error(`[STORAGE] Error deleting project memory ${id}:`, error);
      return false;
    }
  }

  async getScratchpadMemoryByUser(userId: string): Promise<ScratchpadMemory[]> {
    const cacheKey = this.generateCacheKey('scratchpad_memory', userId);
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;

    const fallbackKey = `scratchpad_memory_${userId}`;
    return await this.executeWithFallback(
      'getScratchpadMemoryByUser',
      async () => {
        const now = new Date();
        const memories = await db.select().from(scratchpadMemory)
          .where(and(
            eq(scratchpadMemory.userId, userId),
            sql`${scratchpadMemory.expiresAt} > ${now}`
          ))
          .orderBy(desc(scratchpadMemory.createdAt));

        memoryCache.set(cacheKey, memories, 60000); // Cache for 1 minute (short cache for scratchpad)
        return memories;
      },
      fallbackKey,
      []
    );
  }

  async createScratchpadMemory(data: InsertScratchpadMemory): Promise<ScratchpadMemory> {
    const fallbackKey = `scratchpad_memory_${data.userId}`;
    return await this.executeWithFallback(
      'createScratchpadMemory',
      async () => {
        const [memory] = await db.insert(scratchpadMemory).values(data).returning();

        // Clear user cache
        const cacheKey = this.generateCacheKey('scratchpad_memory', data.userId);
        memoryCache.delete(cacheKey);

        // Store in fallback (simplified: overwrites previous for user)
        await fallbackStorage.store(fallbackKey, { ...memory, userId: data.userId });

        return memory;
      },
      fallbackKey
    );
  }

  async cleanupExpiredScratchpadMemory(): Promise<void> {
    try {
      const now = new Date();
      await db.delete(scratchpadMemory).where(sql`${scratchpadMemory.expiresAt} <= ${now}`);

      // Clear all scratchpad caches since we can't know which users were affected
      memoryCache.clearPattern('scratchpad_memory:*');

      // In a fallback system, we'd also need to clean up expired entries from fallback storage.
      // This is complex as we'd need to iterate through files and check expiry.
    } catch (error) {
      console.error('[STORAGE] Failed to cleanup expired scratchpad memory:', error);
    }
  }

  // Enhanced operations
  async searchConversations(userId: string, query: string): Promise<Conversation[]> {
    const searchQuery = `%${query.toLowerCase()}%`;

    // Fallback for searchConversations would be more complex, potentially involving a local index or searching through fallback files.
    return await db.select().from(conversations)
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

  async getRecentActivity(userId: string, limit: number = 10): Promise<any[]> {
    const cacheKey = this.generateCacheKey('recent_activity', userId, limit);
    const cached = memoryCache.get(cacheKey);
    if (cached) return cached;

    const fallbackKey = `recent_activity_${userId}_${limit}`;
    return await this.executeWithFallback(
      'getRecentActivity',
      async () => {
        const activities = await db.select({
          id: analytics.id,
          eventType: analytics.eventType,
          eventData: analytics.eventData,
          createdAt: analytics.createdAt,
          conversationId: analytics.conversationId
        })
        .from(analytics)
        .where(eq(analytics.userId, userId))
        .orderBy(desc(analytics.createdAt))
        .limit(limit);

        memoryCache.set(cacheKey, activities, 60000); // Cache for 1 minute
        return activities;
      },
      fallbackKey,
      []
    );
  }

  async cleanupExpiredData(): Promise<void> {
    try {
      // Clean expired scratchpad memory first
      await this.cleanupExpiredScratchpadMemory();

      // Clean expired cache entries from the persistent cache storage (if any)
      // await db.delete(cacheStorage)
      //   .where(sql`expiration IS NOT NULL AND expiration < NOW()`);

      // Clean old analytics (older than 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      await db.delete(analytics)
        .where(sql`createdAt < ${thirtyDaysAgo}`); // Assuming 'createdAt' is the correct column name

      // Clean up expired entries in fallback storage
      const files = await fs.readdir('./fallback_storage/');
      for (const file of files) {
        if (file.endsWith('.json')) {
          const key = file.replace('.json', '');
          // This is a placeholder for actual expiry logic.
          // In a real system, fallback data might have associated timestamps or expiry metadata.
          // For now, we'll just log a message.
          // console.log(`[STORAGE] Checking fallback data for: ${key}`);
        }
      }

      console.log('[STORAGE] Cleanup completed');
    } catch (error) {
      console.error('[STORAGE] Cleanup failed:', error);
    }
  }

  getCacheStats(): any {
    return {
      memoryCache: memoryCache.getStats(),
      timestamp: new Date().toISOString()
    };
  }

  async optimizeStorage(): Promise<void> {
    try {
      // Vacuum analyze for PostgreSQL optimization
      // await db.execute(sql`VACUUM ANALYZE conversations`);
      // await db.execute(sql`VACUUM ANALYZE messages`);
      // await db.execute(sql`VACUUM ANALYZE files`);

      // Clear all in-memory cache entries
      memoryCache.clear();

      // Clear fallback storage (this is destructive and might not be desired in all scenarios)
      // await fs.rm('./fallback_storage', { recursive: true, force: true });
      // await fs.mkdir('./fallback_storage'); // Recreate directory if cleared

      console.log('[STORAGE] Optimization completed');
    } catch (error) {
      console.error('[STORAGE] Optimization failed:', error);
    }
  }

  
  // Load core memory from file system on startup
  static async loadCoreMemoryFromFile(): Promise<void> {
    try {
      const coreMemoryPath = './core.memory.json';

      try {
        const fileContent = await fs.readFile(coreMemoryPath, 'utf-8');
        const coreMemoryData = JSON.parse(fileContent);

        console.log('[MEMORY] Loading core memory from file...');

        // Store each core memory entry
        for (const [key, value] of Object.entries(coreMemoryData)) {
          try {
            await storage.upsertCoreMemory({
              key,
              value: typeof value === 'string' ? value : JSON.stringify(value),
              description: `Loaded from core.memory.json`,
              adminOnly: true
            });
            console.log(`[MEMORY] Loaded core memory: ${key}`);
          } catch (error) {
            console.warn(`[MEMORY] Failed to load core memory ${key}:`, error);
          }
        }

        console.log('[MEMORY] Core memory loaded successfully from file');
      } catch (fileError) {
        console.warn('[MEMORY] core.memory.json not found or invalid, using defaults');
      }
    } catch (error) {
      console.error('[MEMORY] Failed to load core memory from file:', error);
    }
  }
}

export const storage = new DatabaseStorage();
