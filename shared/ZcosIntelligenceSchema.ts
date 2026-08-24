import { index, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

import type { ZcosExecutionTrace } from "./zcos-intelligence";
import { users } from "./UsersSchema";

export const zcosExecutionTraces = pgTable(
  "zcos_execution_traces",
  {
    traceId: varchar("trace_id").primaryKey(),
    requestId: varchar("request_id").notNull(),
    ownerUserId: varchar("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    originGalaxy: varchar("origin_galaxy").notNull(),
    status: varchar("status").notNull(),
    trace: jsonb("trace").$type<ZcosExecutionTrace>().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_zcos_execution_traces_owner_started").on(table.ownerUserId, table.startedAt),
    index("idx_zcos_execution_traces_request").on(table.requestId),
  ],
);

export type ZcosExecutionTraceRow = typeof zcosExecutionTraces.$inferSelect;
export type InsertZcosExecutionTrace = typeof zcosExecutionTraces.$inferInsert;
