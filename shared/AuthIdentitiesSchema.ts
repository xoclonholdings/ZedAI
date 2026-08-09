import { relations } from "drizzle-orm";
import { pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

import { users } from "./UsersSchema";

/**
 * Provider credentials resolve through this table to one internal ZCOS owner.
 * The provider subject is hashed before persistence so it never becomes the
 * owner identifier used by conversations, Memory, Text, voice, or actions.
 */
export const authIdentities = pgTable(
  "auth_identities",
  {
    id: varchar("id").primaryKey(),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider").notNull(),
    issuer: varchar("issuer").notNull(),
    subjectHash: varchar("subject_hash").notNull(),
    verifiedEmail: varchar("verified_email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastAuthenticatedAt: timestamp("last_authenticated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    providerSubject: uniqueIndex("auth_identities_provider_subject_unique").on(
      table.provider,
      table.issuer,
      table.subjectHash,
    ),
  }),
);

export const authIdentityRelations = relations(authIdentities, ({ one }) => ({
  user: one(users, {
    fields: [authIdentities.userId],
    references: [users.id],
  }),
}));

export type AuthIdentity = typeof authIdentities.$inferSelect;
export type InsertAuthIdentity = typeof authIdentities.$inferInsert;
