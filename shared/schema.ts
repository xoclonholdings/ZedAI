import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb, boolean, index, bigint, real, serial, uuid, decimal } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  preview: text("preview"),
  model: text("model").notNull().default("gpt-4o"),
  mode: text("mode").notNull().default("chat"), // "chat" | "agent"
  isActive: boolean("is_active").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id),
  role: text("role").notNull(), // "user" | "assistant" | "system"
  content: text("content").notNull(),
  metadata: jsonb("metadata"), // For storing additional data like file references
  createdAt: timestamp("created_at").defaultNow(),
});

export const files = pgTable("files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  status: text("status").notNull().default("processing"), // "processing" | "completed" | "error"
  extractedContent: text("extracted_content"),
  analysis: jsonb("analysis"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatSessions = pgTable("chat_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  duration: integer("duration").default(0), // in minutes
  messagesUsed: integer("messages_used").default(0),
  memoryUsage: integer("memory_usage").default(0), // in MB
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User types for authentication
export type UpsertUser = typeof users.$inferInsert;

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Mode validation
export const modeSchema = z.enum(["chat", "agent"]);
export type ConversationMode = z.infer<typeof modeSchema>;

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  createdAt: true,
});

export const insertSessionSchema = createInsertSchema(chatSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type File = typeof files.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;

export type Session = typeof chatSessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;

// Core Memory table - Persistent system configuration
export const coreMemory = pgTable("core_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  adminOnly: boolean("admin_only").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Project Memory table - Saved context and datasets
export const projectMemory = pgTable("project_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name").notNull(),
  description: text("description"),
  content: text("content").notNull(),
  type: text("type").notNull().default("context"), // "context" | "dataset" | "rules"
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Scratchpad Memory table - Temporary working memory (auto-reset daily)
export const scratchpadMemory = pgTable("scratchpad_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  conversationId: varchar("conversation_id").references(() => conversations.id),
  content: text("content").notNull(),
  tags: text("tags").array(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Memory system types
export const insertCoreMemorySchema = createInsertSchema(coreMemory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProjectMemorySchema = createInsertSchema(projectMemory).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScratchpadMemorySchema = createInsertSchema(scratchpadMemory).omit({
  id: true,
  createdAt: true,
});

export type CoreMemory = typeof coreMemory.$inferSelect;
export type InsertCoreMemory = z.infer<typeof insertCoreMemorySchema>;

export type ProjectMemory = typeof projectMemory.$inferSelect;
export type InsertProjectMemory = z.infer<typeof insertProjectMemorySchema>;

export type ScratchpadMemory = typeof scratchpadMemory.$inferSelect;
export type InsertScratchpadMemory = z.infer<typeof insertScratchpadMemorySchema>;

// Enhanced storage tables for scalability
export const fileStorage = pgTable("file_storage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fileId: varchar("file_id").notNull().references(() => files.id),
  chunkIndex: integer("chunk_index").notNull(),
  chunkData: text("chunk_data").notNull(), // Base64 encoded data
  chunkSize: bigint("chunk_size", { mode: "number" }).notNull(),
  checksum: varchar("checksum").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_file_storage_file_id").on(table.fileId),
  index("idx_file_storage_chunk_index").on(table.chunkIndex),
]);

export const memoryIndex = pgTable("memory_index", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id),
  contentType: text("content_type").notNull(), // "message", "file", "analysis"
  contentId: varchar("content_id").notNull(),
  embedding: real("embedding").array(),
  keywords: text("keywords").array(),
  summary: text("summary"),
  importance: real("importance").default(0.5),
  accessCount: integer("access_count").default(0),
  lastAccessed: timestamp("last_accessed").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_memory_conv_id").on(table.conversationId),
  index("idx_memory_content_type").on(table.contentType),
  index("idx_memory_importance").on(table.importance),
  index("idx_memory_last_accessed").on(table.lastAccessed),
]);

export const knowledgeBase = pgTable("knowledge_base", {
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
}, (table) => [
  index("idx_kb_user_id").on(table.userId),
  index("idx_kb_category").on(table.category),
  index("idx_kb_tags").on(table.tags),
  index("idx_kb_public").on(table.isPublic),
]);

export const cacheStorage = pgTable("cache_storage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cacheKey: varchar("cache_key").notNull().unique(),
  cacheValue: jsonb("cache_value").notNull(),
  expiration: timestamp("expiration"),
  tags: text("tags").array(),
  size: bigint("size", { mode: "number" }).notNull(),
  hitCount: integer("hit_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_cache_key").on(table.cacheKey),
  index("idx_cache_expiration").on(table.expiration),
  index("idx_cache_tags").on(table.tags),
]);

export const analytics = pgTable("analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  eventType: text("event_type").notNull(),
  eventData: jsonb("event_data"),
  sessionId: varchar("session_id"),
  conversationId: varchar("conversation_id").references(() => conversations.id),
  duration: integer("duration"), // in milliseconds
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_analytics_user_id").on(table.userId),
  index("idx_analytics_event_type").on(table.eventType),
  index("idx_analytics_session_id").on(table.sessionId),
  index("idx_analytics_created_at").on(table.createdAt),
]);

// Relations for better query performance
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

// Enhanced types
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
