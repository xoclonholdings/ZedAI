import * as fs from "fs/promises";
import path from "path";

const FALLBACK_DIR = path.resolve(process.cwd(), "fallback_storage");

function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getFilePath(key: string): string {
  return path.join(FALLBACK_DIR, `${sanitizeKey(key)}.json`);
}

export const fallbackStorage = {
  async store(key: string, data: unknown): Promise<void> {
    try {
      const filePath = getFilePath(key);

      await fs.mkdir(FALLBACK_DIR, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");

      console.log(`[FALLBACK] Stored ${key}`);
    } catch (error) {
      console.error(`[FALLBACK] Failed to store ${key}:`, error);
    }
  },

  async retrieve<T = unknown>(key: string): Promise<T | null> {
    try {
      const filePath = getFilePath(key);
      const fileContent = await fs.readFile(filePath, "utf-8");

      console.log(`[FALLBACK] Retrieved ${key}`);
      return JSON.parse(fileContent) as T;
    } catch {
      return null;
    }
  },

  async delete(key: string): Promise<boolean> {
    try {
      const filePath = getFilePath(key);

      await fs.unlink(filePath);
      console.log(`[FALLBACK] Deleted ${key}`);

      return true;
    } catch {
      return false;
    }
  },
};