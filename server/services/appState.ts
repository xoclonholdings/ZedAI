import { sql } from "drizzle-orm";

import { db, isDatabaseRequired } from "../db";

/**
 * Generic durable key/value store for app features that need to persist
 * structured JSON per user without a bespoke table each time.
 *
 * Backed by the Neon/Drizzle database (an `app_state` table of JSONB
 * blobs keyed by scope + key) so data survives restarts. Offline
 * development may receive null/false when no DB is configured, but
 * production/Render/REQUIRE_DATABASE=true fails closed instead of
 * allowing callers to treat ephemeral files as authoritative state.
 */

let ensured: Promise<void> | null = null;

async function ensureTable(): Promise<boolean> {
  if (!db) {
    if (isDatabaseRequired()) {
      throw new Error("app_state requires PostgreSQL in this environment.");
    }
    return false;
  }
  if (!ensured) {
    ensured = (async () => {
      await db!.execute(sql`
        CREATE TABLE IF NOT EXISTS app_state (
          scope varchar NOT NULL,
          key varchar NOT NULL,
          data jsonb NOT NULL,
          updated_at timestamp DEFAULT now(),
          PRIMARY KEY (scope, key)
        );
      `);
    })().catch((error) => {
      ensured = null;
      throw error;
    });
  }
  try {
    await ensured;
    return true;
  } catch (error) {
    if (isDatabaseRequired()) throw error;
    return false;
  }
}

export function appStateAvailable(): boolean {
  return !!db;
}

export async function readAppState<T>(scope: string, key: string): Promise<T | null> {
  try {
    if (!(await ensureTable())) return null;
    const result: any = await db!.execute(
      sql`SELECT data FROM app_state WHERE scope = ${scope} AND key = ${key} LIMIT 1`,
    );
    const rows = result?.rows ?? (Array.isArray(result) ? result : []);
    if (rows.length > 0 && rows[0]?.data != null) return rows[0].data as T;
    return null;
  } catch (error) {
    if (isDatabaseRequired()) throw error;
    return null;
  }
}

export async function writeAppState<T>(scope: string, key: string, data: T): Promise<boolean> {
  try {
    if (!(await ensureTable())) return false;
    await db!.execute(sql`
      INSERT INTO app_state (scope, key, data, updated_at)
      VALUES (${scope}, ${key}, ${JSON.stringify(data)}::jsonb, now())
      ON CONFLICT (scope, key) DO UPDATE SET data = EXCLUDED.data, updated_at = now();
    `);
    return true;
  } catch (error) {
    if (isDatabaseRequired()) throw error;
    return false;
  }
}
