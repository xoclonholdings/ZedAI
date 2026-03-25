
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';

interface StorageEntry {
  id: string;
  data: any;
  timestamp: number;
  checksum: string;
}

interface StorageIndex {
  [key: string]: StorageEntry;
}

export class FallbackStorage {
  private storagePath: string;
  private indexPath: string;
  private memoryCache: Map<string, StorageEntry> = new Map();
  private isInitialized = false;

  constructor(storagePath = './storage') {
    this.storagePath = path.resolve(storagePath);
    this.indexPath = path.join(this.storagePath, 'index.json');
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Ensure storage directory exists
      await fs.mkdir(this.storagePath, { recursive: true });
      
      // Load existing index
      await this.loadIndex();
      
      this.isInitialized = true;
      console.log('[FALLBACK_STORAGE] Initialized successfully');
    } catch (error) {
      console.error('[FALLBACK_STORAGE] Initialization failed:', error);
      throw error;
    }
  }

  private async loadIndex(): Promise<void> {
    try {
      const indexData = await fs.readFile(this.indexPath, 'utf-8');
      const index: StorageIndex = JSON.parse(indexData);
      
      // Load all entries into memory cache
      for (const [key, entry] of Object.entries(index)) {
        this.memoryCache.set(key, entry);
      }
      
      console.log(`[FALLBACK_STORAGE] Loaded ${this.memoryCache.size} entries from index`);
    } catch (error) {
      // Index doesn't exist or is corrupted, start fresh
      console.log('[FALLBACK_STORAGE] Starting with empty index');
    }
  }

  private async saveIndex(): Promise<void> {
    try {
      const index: StorageIndex = {};
      for (const [key, entry] of this.memoryCache.entries()) {
        index[key] = entry;
      }
      
      await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2));
    } catch (error) {
      console.error('[FALLBACK_STORAGE] Failed to save index:', error);
    }
  }

  private generateChecksum(data: any): string {
    return createHash('md5').update(JSON.stringify(data)).digest('hex');
  }

  async store(key: string, data: any): Promise<boolean> {
    if (!this.isInitialized) await this.initialize();
    
    try {
      const timestamp = Date.now();
      const checksum = this.generateChecksum(data);
      const entry: StorageEntry = { id: key, data, timestamp, checksum };
      
      // Store in memory cache
      this.memoryCache.set(key, entry);
      
      // Store individual file
      const filePath = path.join(this.storagePath, `${key}.json`);
      await fs.writeFile(filePath, JSON.stringify(entry, null, 2));
      
      // Update index
      await this.saveIndex();
      
      return true;
    } catch (error) {
      console.error(`[FALLBACK_STORAGE] Failed to store ${key}:`, error);
      return false;
    }
  }

  async retrieve(key: string): Promise<any | null> {
    if (!this.isInitialized) await this.initialize();
    
    try {
      // Check memory cache first
      const cached = this.memoryCache.get(key);
      if (cached) {
        return cached.data;
      }
      
      // Try loading from file
      const filePath = path.join(this.storagePath, `${key}.json`);
      const fileData = await fs.readFile(filePath, 'utf-8');
      const entry: StorageEntry = JSON.parse(fileData);
      
      // Verify checksum
      const expectedChecksum = this.generateChecksum(entry.data);
      if (entry.checksum !== expectedChecksum) {
        console.warn(`[FALLBACK_STORAGE] Checksum mismatch for ${key}, data may be corrupted`);
      }
      
      // Update memory cache
      this.memoryCache.set(key, entry);
      
      return entry.data;
    } catch (error) {
      console.error(`[FALLBACK_STORAGE] Failed to retrieve ${key}:`, error);
      return null;
    }
  }

  async remove(key: string): Promise<boolean> {
    if (!this.isInitialized) await this.initialize();
    
    try {
      // Remove from memory cache
      this.memoryCache.delete(key);
      
      // Remove file
      const filePath = path.join(this.storagePath, `${key}.json`);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // File might not exist, that's okay
      }
      
      // Update index
      await this.saveIndex();
      
      return true;
    } catch (error) {
      console.error(`[FALLBACK_STORAGE] Failed to remove ${key}:`, error);
      return false;
    }
  }

  async list(): Promise<string[]> {
    if (!this.isInitialized) await this.initialize();
    return Array.from(this.memoryCache.keys());
  }

  async clear(): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    
    try {
      // Clear memory cache
      this.memoryCache.clear();
      
      // Remove all files
      const files = await fs.readdir(this.storagePath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(this.storagePath, file));
        }
      }
      
      console.log('[FALLBACK_STORAGE] Storage cleared');
    } catch (error) {
      console.error('[FALLBACK_STORAGE] Failed to clear storage:', error);
    }
  }

  getStats() {
    return {
      entriesCount: this.memoryCache.size,
      isInitialized: this.isInitialized,
      storagePath: this.storagePath
    };
  }
}

export const fallbackStorage = new FallbackStorage();
