import fs from "fs/promises";
import path from "path";

import type { AdminSettings } from "../../../shared/adminSettings";
import { HUB_CONFIG_DIR } from "../../utils/repoPaths";

import { assertProductionEnvConfiguration } from "./env";
import { mergeSettings } from "./mergeSettings";

const SETTINGS_PATH = path.join(HUB_CONFIG_DIR, "admin-settings.json");

async function writeSettings(settings: AdminSettings) {
  await fs.mkdir(HUB_CONFIG_DIR, { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
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
  return next;
}
