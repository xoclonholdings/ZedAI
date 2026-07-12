import fs from "fs/promises";
import path from "path";

import type { AdminSettings } from "../../../shared/adminSettings";
import { HUB_CONFIG_DIR } from "../../utils/repoPaths";

import { assertProductionEnvConfiguration } from "./env";
import { mergeSettings } from "./mergeSettings";
import { loadSettingsFromDb, saveSettingsToDb } from "./dbPersistence";

const SETTINGS_PATH = path.join(HUB_CONFIG_DIR, "admin-settings.json");

async function writeSettings(settings: AdminSettings) {
  await fs.mkdir(HUB_CONFIG_DIR, { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}

/**
 * Restore admin settings from the durable database into the local file
 * cache. Called once at boot (after the DB is confirmed healthy) so a
 * fresh/ephemeral container gets back the managed users and credentials
 * that were added since the last deploy. If the DB has no settings yet
 * but the local file does, seed the DB from the file instead.
 *
 * No-op (and safe) when the database is offline.
 */
export async function hydrateAdminSettingsFromDb(): Promise<void> {
  const fromDb = await loadSettingsFromDb();
  if (fromDb) {
    const merged = mergeSettings(fromDb);
    await writeSettings(merged);
    console.log("[admin-settings] hydrated from database (managed users + credentials restored)");
    return;
  }
  // DB is empty — seed it from whatever the file currently holds so the
  // next redeploy has something durable to restore.
  const current = await loadAdminSettings();
  await saveSettingsToDb(current);
  console.log("[admin-settings] seeded database from local settings");
}

/**
 * Reads admin-settings.json, runs it through mergeSettings to apply
 * defaults and forward-migrations, then writes the canonical form
 * back so disk and memory stay in sync. Falls back to defaults if
 * the file is missing or unparseable.
 */
export async function loadAdminSettings(): Promise<AdminSettings> {
  assertProductionEnvConfiguration();
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf-8");
    const settings = mergeSettings(JSON.parse(raw));
    await writeSettings(settings);
    return settings;
  } catch {
    const settings = mergeSettings(undefined);
    await writeSettings(settings);
    return settings;
  }
}

/**
 * Read-modify-write helper for admin settings. The updater receives
 * the current canonical settings and returns the next state, which
 * gets re-merged (so partial returns are safe) and written back.
 */
export async function updateAdminSettings(
  updater: (current: AdminSettings) => AdminSettings | Promise<AdminSettings>,
) {
  const current = await loadAdminSettings();
  const next = mergeSettings(await updater(current));
  await writeSettings(next);
  // Persist every mutation (add user, change credentials, voice,
  // approvals, integrations) to the durable store so it survives
  // redeploys. Best-effort and non-blocking — a DB hiccup must not fail
  // the settings write the operator just made.
  void saveSettingsToDb(next);
  return next;
}
