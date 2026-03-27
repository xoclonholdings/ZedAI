import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./UsersSchema";
import { conversations } from "./ConversationsSchema";

export const coreMemory = pgTable("core_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  adminOnly: boolean("admin_only").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const projectMemory = pgTable("project_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name").notNull(),
  description: text("description"),
  content: text("content").notNull(),
  type: text("type").notNull().default("context"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const scratchpadMemory = pgTable("scratchpad_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  conversationId: varchar("conversation_id").references(() => conversations.id),
  content: text("content").notNull(),
  tags: text("tags").array(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

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