import { storage } from "../storage";
import { db } from "../db";
import { sql } from "drizzle-orm";

class OptimizationService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    // Start optimization service
    this.start();
  }

  private start(): void {
    if (this.intervalId) return;
    
    // Run optimization every 15 minutes
    this.intervalId = setInterval(() => {
      this.runOptimization();
    }, 15 * 60 * 1000);

    // Run initial optimization after 30 seconds
    setTimeout(() => {
      this.runOptimization();
    }, 30000);

    // Optimization service started
  }

  private async runOptimization(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    const startTime = Date.now();

    try {
      // Starting optimization cycle

      // 1. Clean expired data
      await storage.cleanupExpiredData();

      // 2. Optimize storage
      await storage.optimizeStorage();

      // 3. Update statistics
      await this.updateStatistics();

      // 4. Optimize database connections
      await this.optimizeConnections();

      const duration = Date.now() - startTime;
      // Optimization completed successfully

    } catch (error) {
      console.error('[OPTIMIZATION] Failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async updateStatistics(): Promise<void> {
    try {
      // Update conversation message counts
      await db.execute(sql`
        UPDATE conversations 
        SET preview = (
          SELECT content 
          FROM messages 
          WHERE conversation_id = conversations.id 
          ORDER BY created_at DESC 
          LIMIT 1
        )
        WHERE preview IS NULL OR preview = ''
      `);

      // Update file processing status
      await db.execute(sql`
        UPDATE files 
        SET status = 'completed' 
        WHERE status = 'processing' 
        AND created_at < NOW() - INTERVAL '5 minutes'
      `);

    } catch (error) {
      console.warn('[OPTIMIZATION] Statistics update failed:', error);
    }
  }

  private async optimizeConnections(): Promise<void> {
    try {
      // Ensure database connection pool is healthy
      const result = await db.execute(sql`SELECT 1 as health_check`);
      if (!result) {
        console.warn('[OPTIMIZATION] Database connection check failed');
      }
    } catch (error) {
      console.error('[OPTIMIZATION] Connection optimization failed:', error);
    }
  }

  public async forceOptimization(): Promise<void> {
    await this.runOptimization();
  }

  public getStats(): any {
    return {
      isRunning: this.isRunning,
      lastRun: new Date().toISOString(),
      cache: storage.getCacheStats()
    };
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('[OPTIMIZATION] Service stopped');
  }
}

export const optimizationService = new OptimizationService();