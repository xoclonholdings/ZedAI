import { pool } from "../../db";
import type { AdminSettings } from "../../../shared/adminSettings";
import {
  protectAdminSettingsForStorage,
  revealStoredAdminSettings,
} from "./secretProtection";

/**
 * Durable persistence for admin settings (managed users, credentials,
 * voice, approvals, integrations) in Postgres.
 *
 * The runtime reads/writes the local hub/config/admin-settings.json for
 * speed, but on an ephemeral host that file disappears on every
 * redeploy. This module mirrors settings into the `app_settings` table
 * (which survives redeploys) and hydrates them back at boot, so newly
 * added users and changed credentials are never lost.
 *
 * Everything here is best-effort and null-safe: with no DATABASE_URL the
 * pool is null and every call degrades to a no-op, leaving the
 * file-backed behavior exactly as it was.
 */

const SETTINGS_ROW_ID = "admin-settings";

/** Read the persisted settings from the database, or null if none/unavailable. */
export async function loadSettingsFromDb(): Promise<AdminSettings | null> {
  if (!pool) return null;
  let stored: AdminSettings | null = null;
  try {
    const result = await pool.query(
      "SELECT data FROM app_settings WHERE id = $1 LIMIT 1",
      [SETTINGS_ROW_ID],
    );
    const row = result.rows[0];
    if (!row?.data) return null;
    // jsonb comes back already parsed from node-postgres; tolerate a
    // string too in case a driver hands back raw text.
    stored = typeof row.data === "string" ? JSON.parse(row.data) : (row.data as AdminSettings);
  } catch (error) {
    console.error("[admin-settings] loadSettingsFromDb failed:", (error as Error)?.message || error);
    return null;
  }
  // Keep cryptographic failures outside the database-availability fallback.
  // A missing/wrong key must stop the boot path rather than silently seeding
  // over encrypted credentials with defaults.
  return stored ? revealStoredAdminSettings(stored) : null;
}

/** Upsert the settings into the database. Database failures are best-effort. */
export async function saveSettingsToDb(settings: AdminSettings): Promise<void> {
  if (!pool) return;
  // Key/configuration failures must surface instead of silently storing
  // or accepting an unprotected credential set.
  const protectedSettings = protectAdminSettingsForStorage(settings);
  try {
    await pool.query(
      `INSERT INTO app_settings (id, data, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [SETTINGS_ROW_ID, JSON.stringify(protectedSettings)],
    );
  } catch (error) {
    console.error("[admin-settings] saveSettingsToDb failed:", (error as Error)?.message || error);
  }
}
