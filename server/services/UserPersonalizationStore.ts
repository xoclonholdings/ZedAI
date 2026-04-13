import fs from "fs/promises";
import path from "path";

import type { PersonalizationSettings } from "../../shared/adminSettings";
import { defaultPersonalizationSettings } from "../../shared/adminSettings";
import { resolveFromHub } from "../utils/repoPaths";

const USER_PREFS_DIR = resolveFromHub("user-preferences");

function getUserPrefsPath(userId: string) {
  return path.join(USER_PREFS_DIR, `${userId}.json`);
}

function mergePersonalization(
  current: Partial<PersonalizationSettings> | null | undefined,
): PersonalizationSettings {
  return {
    ...defaultPersonalizationSettings,
    ...(current || {}),
  };
}

export async function getUserPersonalization(userId: string): Promise<PersonalizationSettings> {
  try {
    const raw = await fs.readFile(getUserPrefsPath(userId), "utf-8");
    return mergePersonalization(JSON.parse(raw));
  } catch {
    const merged = mergePersonalization(undefined);
    await fs.mkdir(USER_PREFS_DIR, { recursive: true });
    await fs.writeFile(getUserPrefsPath(userId), JSON.stringify(merged, null, 2), "utf-8");
    return merged;
  }
}

export async function saveUserPersonalization(
  userId: string,
  next: Partial<PersonalizationSettings>,
): Promise<PersonalizationSettings> {
  await fs.mkdir(USER_PREFS_DIR, { recursive: true });
  const current = await getUserPersonalization(userId).catch(() => defaultPersonalizationSettings);
  const merged = mergePersonalization({ ...current, ...next });
  await fs.writeFile(getUserPrefsPath(userId), JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}
