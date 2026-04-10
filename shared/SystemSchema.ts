import { sql, relations } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  jsonb,
  boolean,
  index,
  bigint,
  real,
} from "drizzle-orm/pg-core";
import { users } from "./UsersSchema";
import { Conversation } from '../../shared/types';
import { messages } from "./MessagesSchema";
import { files } from "./FilesSchema";
import { chatSessions } from "./SessionsSchema";

// FILE STORAGE
export const fileStorage = pgTable(
  "file_storage",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    fileId: varchar("file_id").notNull().references(() => files.id),
    chunkIndex: integer("chunk_index").notNull(),
    chunkData: text("chunk_data").notNull(),
    chunkSize: bigint("chunk_size", { mode: "number" }).notNull(),
    checksum: varchar("checksum").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_file_storage_file_id").on(table.fileId),
    index("idx_file_storage_chunk_index").on(table.chunkIndex),
  ],
);

// MEMORY INDEX
export const memoryIndex = pgTable(
  "memory_index",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    conversationId: varchar("conversation_id").notNull().references(() => conversations.id),
    contentType: text("content_type").notNull(),
    contentId: varchar("content_id").notNull(),
    embedding: real("embedding").array(),
    keywords: text("keywords").array(),
    summary: text("summary"),
    importance: real("importance").default(0.5),
    accessCount: integer("access_count").default(0),
    lastAccessed: timestamp("last_accessed").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_memory_conv_id").on(table.conversationId),
    index("idx_memory_content_type").on(table.contentType),
    index("idx_memory_importance").on(table.importance),
    index("idx_memory_last_accessed").on(table.lastAccessed),
  ],
);

// KNOWLEDGE BASE
export const knowledgeBase = pgTable(
  "knowledge_base",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id),
    title: text("title").notNull(),
    content: text("content").notNull(),
    tags: text("tags").array(),
    category: text("category").notNull(),
    isPublic: boolean("is_public").default(false),
    version: integer("version").default(1),
    parentId: varchar("parent_id"),
    usage_count: integer("usage_count").default(0),
    rating: real("rating").default(0),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_kb_user_id").on(table.userId),
    index("idx_kb_category").on(table.category),
    index("idx_kb_tags").on(table.tags),
    index("idx_kb_public").on(table.isPublic),
  ],
);

// CACHE
export const cacheStorage = pgTable(
  "cache_storage",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    cacheKey: varchar("cache_key").notNull().unique(),
    cacheValue: jsonb("cache_value").notNull(),
    expiration: timestamp("expiration"),
    tags: text("tags").array(),
    size: bigint("size", { mode: "number" }).notNull(),
    hitCount: integer("hit_count").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_cache_key").on(table.cacheKey),
    index("idx_cache_expiration").on(table.expiration),
    index("idx_cache_tags").on(table.tags),
  ],
);

// ANALYTICS
export const analytics = pgTable(
  "analytics",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id),
    eventType: text("event_type").notNull(),
    eventData: jsonb("event_data"),
    sessionId: varchar("session_id"),
    conversationId: varchar("conversation_id").references(() => conversations.id),
    duration: integer("duration"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_analytics_user_id").on(table.userId),
    index("idx_analytics_event_type").on(table.eventType),
    index("idx_analytics_session_id").on(table.sessionId),
    index("idx_analytics_created_at").on(table.createdAt),
  ],
);

// RELATIONS
export const userRelations = relations(users, ({ many }) => ({
  conversations: many(conversations),
  knowledgeBase: many(knowledgeBase),
  analytics: many(analytics),
}));

export const conversationRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  messages: many(messages),
  files: many(files),
  sessions: many(chatSessions),
  memoryIndex: many(memoryIndex),
  analytics: many(analytics),
}));

export const messageRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const fileRelations = relations(files, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [files.conversationId],
    references: [conversations.id],
  }),
  storage: many(fileStorage),
}));

// TYPES
export type FileStorage = typeof fileStorage.$inferSelect;
export type InsertFileStorage = typeof fileStorage.$inferInsert;

export type MemoryIndex = typeof memoryIndex.$inferSelect;
export type InsertMemoryIndex = typeof memoryIndex.$inferInsert;

export type KnowledgeBase = typeof knowledgeBase.$inferSelect;
export type InsertKnowledgeBase = typeof knowledgeBase.$inferInsert;

export type CacheStorage = typeof cacheStorage.$inferSelect;
export type InsertCacheStorage = typeof cacheStorage.$inferInsert;

export type Analytics = typeof analytics.$inferSelect;
export type InsertAnalytics = typeof analytics.$inferInsert;
