import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const FILE_DIR = path.dirname(fileURLToPath(import.meta.url));

export const SERVER_DIR = path.resolve(FILE_DIR, "..");
export const REPO_ROOT = path.resolve(SERVER_DIR, "..");

export const HUB_DIR = path.resolve(REPO_ROOT, "hub");
export const HUB_CONFIG_DIR = path.resolve(HUB_DIR, "config");
export const HUB_LOG_DIR = path.resolve(HUB_DIR, "logs");
export const HUB_SHARED_MEMORY_DIR = path.resolve(HUB_DIR, "shared-memory");
export const HUB_USER_MEMORY_DIR = path.resolve(HUB_DIR, "user-memory");
export const HUB_SESSIONS_DIR = path.resolve(HUB_DIR, "sessions");

export const UPLOADS_DIR = path.resolve(REPO_ROOT, "uploads");

export function resolveFromRepo(...segments: string[]) {
  return path.resolve(REPO_ROOT, ...segments);
}

export function resolveFromHub(...segments: string[]) {
  return path.resolve(HUB_DIR, ...segments);
}

export function ensureRuntimeDataReady() {
  const dirs = [
    HUB_DIR,
    HUB_CONFIG_DIR,
    HUB_LOG_DIR,
    HUB_SHARED_MEMORY_DIR,
    HUB_USER_MEMORY_DIR,
    HUB_SESSIONS_DIR,
    UPLOADS_DIR,
  ];

  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
