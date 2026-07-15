import fs from "fs/promises";
import path from "path";

import type { PersonalizationSettings } from "../../shared/adminSettings";
import { defaultPersonalizationSettings } from "../../shared/adminSettings";
import { resolveFromHub } from "../utils/repoPaths";

const USER_PREFS_DIR = resolveFromHub("user-preferences");

const INVALID_MEMORY_USER_IDS = new Set([
  "",
  "user",
  "user_001",
  "default-user",
  "default_user",
  "anonymous",
  "unknown",
  "offline",
  "admin-user",
  "admin_user",
]);

function requireMemoryUserId(value: unknown, operation: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${operation} requires an authenticated userId.`);
  }
  const userId = value.trim();
  if (
    INVALID_MEMORY_USER_IDS.has(userId) ||
    userId.includes("..") ||
    userId.includes("/") ||
    userId.includes("\\")
  ) {
    throw new Error(`${operation} received an invalid or fallback userId.`);
  }
  return userId;
}

function getUserPrefsPath(userId: string) {
  return path.join(USER_PREFS_DIR, `${requireMemoryUserId(userId, "personalization settings")}.json`);
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
  const prefsPath = getUserPrefsPath(userId);
  try {
    const raw = await fs.readFile(prefsPath, "utf-8");
    return mergePersonalization(JSON.parse(raw));
  } catch {
    const merged = mergePersonalization(undefined);
    await fs.mkdir(USER_PREFS_DIR, { recursive: true });
    await fs.writeFile(prefsPath, JSON.stringify(merged, null, 2), "utf-8");
    return merged;
  }
}

export async function saveUserPersonalization(
  userId: string,
  next: Partial<PersonalizationSettings>,
): Promise<PersonalizationSettings> {
  const owner = requireMemoryUserId(userId, "personalization settings write");
  await fs.mkdir(USER_PREFS_DIR, { recursive: true });
  const current = await getUserPersonalization(owner).catch(() => defaultPersonalizationSettings);
  const merged = mergePersonalization({ ...current, ...next });
  await fs.writeFile(getUserPrefsPath(owner), JSON.stringify(merged, null, 2), "utf-8");
  return merged;
}
