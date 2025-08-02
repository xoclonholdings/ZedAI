import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

// Connection health check
export async function checkDatabaseConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('[DATABASE] Connection healthy:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('[DATABASE] Connection failed:', error);
    return false;
  }
}

// Database maintenance utilities
export async function optimizeDatabase() {
  try {
    // Clean expired cache entries
    await pool.query(`
      DELETE FROM cache_storage 
      WHERE expiration IS NOT NULL AND expiration < NOW()
    `);
    
    // Update analytics aggregations
    await pool.query(`
      UPDATE analytics 
      SET metadata = jsonb_set(
        COALESCE(metadata, '{}'), 
        '{processed}', 
        'true'
      )
      WHERE metadata->>'processed' IS NULL
    `);
    
    console.log('[DATABASE] Optimization completed');
  } catch (error) {
    console.error('[DATABASE] Optimization failed:', error instanceof Error ? error.message : 'Unknown error');
  }
}

// Database optimization service will handle this
// setInterval(optimizeDatabase, 60 * 60 * 1000);