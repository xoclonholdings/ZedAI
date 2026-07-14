import { sql } from "drizzle-orm";

import { db, isDatabaseRequired } from "../../db";

/**
 * Durable persistence for the Trading module.
 *
 * Everything Trading stores (learned knowledge, stage progression,
 * theses, paper trades, governance history, TradingView records) used to
 * live only in flat JSON files under hub/trading/. On an ephemeral host
 * that directory is wiped on every restart/redeploy, so Zed forgot what
 * it learned and lost its progress.
 *
 * This module backs that same data with the app's Neon/Drizzle database
 * (a single `trading_state` table of JSONB blobs keyed by scope + key),
 * so it survives restarts like the rest of the app. Local/offline
 * development may still fall back to JSON through callers, but
 * production/Render/REQUIRE_DATABASE=true fails closed instead of using
 * ephemeral files as the source of truth.
 */

let ensured: Promise<void> | null = null;

async function ensureTable(): Promise<boolean> {
  if (!db) {
    if (isDatabaseRequired()) {
      throw new Error("trading_state requires PostgreSQL in this environment.");
    }
    return false;
  }
  if (!ensured) {
    ensured = (async () => {
      await db!.execute(sql`
        CREATE TABLE IF NOT EXISTS trading_state (
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

/** True when a database is configured. */
export function tradingDbAvailable(): boolean {
  return !!db;
}

/** True when callers must not fall back to hub/trading JSON files. */
export function tradingPersistenceRequired(): boolean {
  return isDatabaseRequired();
}

/**
 * Read a stored JSON value. Returns null only when the database is
 * unavailable in local/offline development or the row doesn't exist.
 */
export async function readTradingState<T>(scope: string, key: string): Promise<T | null> {
  try {
    if (!(await ensureTable())) return null;
    const result: any = await db!.execute(
      sql`SELECT data FROM trading_state WHERE scope = ${scope} AND key = ${key} LIMIT 1`,
    );
    const rows = result?.rows ?? (Array.isArray(result) ? result : []);
    if (rows.length > 0 && rows[0]?.data != null) {
      return rows[0].data as T;
    }
    return null;
  } catch (error) {
    if (isDatabaseRequired()) throw error;
    return null;
  }
}

/** Upsert a JSON value. Returns false only for local/offline fallback. */
export async function writeTradingState<T>(scope: string, key: string, data: T): Promise<boolean> {
  try {
    if (!(await ensureTable())) return false;
    await db!.execute(sql`
      INSERT INTO trading_state (scope, key, data, updated_at)
      VALUES (${scope}, ${key}, ${JSON.stringify(data)}::jsonb, now())
      ON CONFLICT (scope, key) DO UPDATE SET data = EXCLUDED.data, updated_at = now();
    `);
    return true;
  } catch (error) {
    if (isDatabaseRequired()) throw error;
    return false;
  }
}
