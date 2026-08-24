import { sql } from "drizzle-orm";

import type { ZcosExecutionTrace } from "../../../shared/zcos-intelligence";
import { db, isDatabaseRequired } from "../../db";

export class ZcosExecutionTraceStore {
  static async save(trace: ZcosExecutionTrace): Promise<void> {
    if (!db) {
      if (isDatabaseRequired()) throw new Error("PostgreSQL is required for ZCOS execution trace persistence.");
      return;
    }
    await db.execute(sql`
      INSERT INTO zcos_execution_traces (
        trace_id, request_id, owner_user_id, origin_galaxy, status, trace, started_at, completed_at
      ) VALUES (
        ${trace.traceId},
        ${trace.requestId},
        ${trace.ownerUserId},
        ${trace.originGalaxy},
        ${trace.verification?.status || "in_progress"},
        ${JSON.stringify(trace)}::jsonb,
        ${new Date(trace.startedAt)},
        ${trace.completedAt ? new Date(trace.completedAt) : null}
      )
      ON CONFLICT (trace_id) DO UPDATE SET
        status = EXCLUDED.status,
        trace = EXCLUDED.trace,
        completed_at = EXCLUDED.completed_at
    `);
  }
}
