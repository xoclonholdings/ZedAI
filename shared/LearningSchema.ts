import { sql } from "drizzle-orm";
import { jsonb, pgTable, primaryKey, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { users } from "./UsersSchema";

export const learningState = pgTable(
  "learning_state",
  {
    userId: varchar("user_id").notNull().references(() => users.id),
    objectType: text("object_type").notNull(),
    objectId: varchar("object_id").notNull(),
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").default(sql`now()`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.objectType, table.objectId] }),
  }),
);

export type LearningStateRow = typeof learningState.$inferSelect;
