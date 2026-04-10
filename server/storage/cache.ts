interface CacheEntry {
  value: any;
  expiresAt: number;
}

class MemoryCache {
  private entries: Map<string, CacheEntry> = new Map();

  get(key: string): any {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: any, ttlMs: number = 300000): void {
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  size(): number {
    return this.entries.size;
  }

  stats(): { size: number; hitRate: number } {
    return { size: this.entries.size, hitRate: 0 };
  }
}

export const memoryCache = new MemoryCache();
