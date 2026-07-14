import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { users } from "./UsersSchema";

export const userMemoryProfiles = pgTable("user_memory_profiles", {
  userId: varchar("user_id").primaryKey().references(() => users.id),
  preferredName: text("preferred_name"),
  profileStatus: text("profile_status").notNull().default("empty"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userMemoryPolicies = pgTable("user_memory_policies", {
  userId: varchar("user_id").primaryKey().references(() => users.id),
  allowedMemoryCategories: text("allowed_memory_categories").array().notNull().default(sql`ARRAY[]::text[]`),
  categoriesRequiringConfirmation: text("categories_requiring_confirmation").array().notNull().default(sql`ARRAY[]::text[]`),
  prohibitedCategories: text("prohibited_categories").array().notNull().default(sql`ARRAY[]::text[]`),
  retentionPreferences: jsonb("retention_preferences").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const memorySources = pgTable(
  "memory_sources",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id),
    sourceType: text("source_type").notNull(),
    label: text("label").notNull(),
    originalLocationRef: text("original_location_ref"),
    ownership: text("ownership").notNull(),
    contentHash: text("content_hash").notNull(),
    status: text("status").notNull().default("staged"),
    authorityState: text("authority_state").notNull().default("observed"),
    temporalStatus: text("temporal_status").notNull().default("unknown"),
    privacyLevel: text("privacy_level").notNull().default("private"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_memory_sources_user_owner").on(table.userId, table.ownership),
    index("idx_memory_sources_hash").on(table.contentHash),
  ],
);

export const memoryObjects = pgTable(
  "memory_objects",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id),
    sourceReferences: jsonb("source_references").notNull().default(sql`'[]'::jsonb`),
    objectType: text("object_type").notNull(),
    canonicalName: text("canonical_name").notNull(),
    summary: text("summary"),
    structuredValue: jsonb("structured_value"),
    ownership: text("ownership").notNull(),
    authorityState: text("authority_state").notNull().default("observed"),
    confidence: text("confidence").notNull().default("0"),
    temporalStatus: text("temporal_status").notNull().default("unknown"),
    privacyLevel: text("privacy_level").notNull().default("private"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_memory_objects_user_owner").on(table.userId, table.ownership),
    index("idx_memory_objects_type_name").on(table.objectType, table.canonicalName),
  ],
);

export const memoryProposals = pgTable(
  "memory_proposals",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id),
    proposedCategory: text("proposed_category").notNull(),
    proposedValue: jsonb("proposed_value").notNull(),
    evidenceReferences: jsonb("evidence_references").notNull().default(sql`'[]'::jsonb`),
    status: text("status").notNull().default("observed"),
    createdAt: timestamp("created_at").defaultNow(),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => [
    index("idx_memory_proposals_user_status").on(table.userId, table.status),
  ],
);

export const insertUserMemoryProfileSchema = (createInsertSchema(userMemoryProfiles) as any).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertUserMemoryPolicySchema = (createInsertSchema(userMemoryPolicies) as any).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertMemorySourceSchema = (createInsertSchema(memorySources) as any).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMemoryObjectSchema = (createInsertSchema(memoryObjects) as any).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMemoryProposalSchema = (createInsertSchema(memoryProposals) as any).omit({
  id: true,
  createdAt: true,
});

export type UserMemoryProfile = typeof userMemoryProfiles.$inferSelect;
export type InsertUserMemoryProfile = z.infer<typeof insertUserMemoryProfileSchema>;

export type UserMemoryPolicy = typeof userMemoryPolicies.$inferSelect;
export type InsertUserMemoryPolicy = z.infer<typeof insertUserMemoryPolicySchema>;

export type MemorySource = typeof memorySources.$inferSelect;
export type InsertMemorySource = z.infer<typeof insertMemorySourceSchema>;

export type MemoryObject = typeof memoryObjects.$inferSelect;
export type InsertMemoryObject = z.infer<typeof insertMemoryObjectSchema>;

export type MemoryProposal = typeof memoryProposals.$inferSelect;
export type InsertMemoryProposal = z.infer<typeof insertMemoryProposalSchema>;
