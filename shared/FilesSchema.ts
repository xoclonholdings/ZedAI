import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { conversations } from "./ConversationsSchema";

export const files = pgTable("files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  status: text("status").notNull().default("processing"),
  extractedContent: text("extracted_content"),
  analysis: jsonb("analysis"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFileSchema = (createInsertSchema(files) as any).omit({
  id: true,
  createdAt: true,
});

export type File = typeof files.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;
