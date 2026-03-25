export class MemoryCache {
  private cache = new Map<string, { data: unknown; expires: number; hits: number }>();
  private maxSize = 1000;
  private ttl = 300000;

  get<T = unknown>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }

    item.hits++;
    return item.data as T;
  }

  set(key: string, data: unknown, ttl?: number): void {
    if (this.cache.size >= this.maxSize) {
      const sorted = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].hits - b[1].hits,
      );

      for (let i = 0; i < Math.floor(this.maxSize * 0.1); i++) {
        const entry = sorted[i];
        if (entry) this.cache.delete(entry[0]);
      }
    }

    this.cache.set(key, {
      data,
      expires: Date.now() + (ttl || this.ttl),
      hits: 0,
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clearPattern(pattern: string): void {
    const regex = new RegExp(pattern.replace("*", ".*"));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: Array.from(this.cache.values()).reduce(
        (sum, item) => sum + item.hits,
        0,
      ),
    };
  }
}

export const memoryCache = new MemoryCache();