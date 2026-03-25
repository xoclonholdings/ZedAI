import * as fs from "fs/promises";

export const fallbackStorage = {
  async store(key: string, data: unknown): Promise<void> {
    try {
      const filePath = `./fallback_storage/${key}.json`;
      await fs.mkdir("./fallback_storage", { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
      console.log(`[FALLBACK] Stored ${key}`);
    } catch (error) {
      console.error(`[FALLBACK] Failed to store ${key}:`, error);
    }
  },

  async retrieve<T = unknown>(key: string): Promise<T | null> {
    try {
      const filePath = `./fallback_storage/${key}.json`;
      const fileContent = await fs.readFile(filePath, "utf-8");
      console.log(`[FALLBACK] Retrieved ${key}`);
      return JSON.parse(fileContent) as T;
    } catch {
      return null;
    }
  },

  async delete(key: string): Promise<boolean> {
    try {
      const filePath = `./fallback_storage/${key}.json`;
      await fs.unlink(filePath);
      console.log(`[FALLBACK] Deleted ${key}`);
      return true;
    } catch {
      return false;
    }
  },
};