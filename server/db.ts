import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema";

neonConfig.webSocketConstructor = ws;

export function isDatabaseRequired(): boolean {
  return (
    process.env.REQUIRE_DATABASE === "true" ||
    process.env.NODE_ENV === "production" ||
    process.env.RENDER === "true"
  );
}

if (!process.env.DATABASE_URL) {
  const message = isDatabaseRequired()
    ? "[DATABASE] DATABASE_URL is required in this environment; PostgreSQL is the authoritative store."
    : "[DATABASE] DATABASE_URL not set - running in offline development mode";
  if (isDatabaseRequired()) {
    console.error(message);
  } else {
    console.warn(message);
  }
}

// Configure pool with optimized settings for Neon (only if DATABASE_URL exists)
export const pool = process.env.DATABASE_URL ? new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
}) : null;

export const db = pool ? drizzle({ client: pool, schema }) : null;

// Connection health check with timeout and graceful fallback in development.
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    if (!process.env.DATABASE_URL) {
      const message = isDatabaseRequired()
        ? '[DATABASE] No DATABASE_URL configured - PostgreSQL is required'
        : '[DATABASE] No DATABASE_URL configured - running in offline development mode';
      if (isDatabaseRequired()) {
        console.error(message);
      } else {
        console.log(message);
      }
      return false;
    }

    // Set a shorter timeout for connection check
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    const connectionPromise = (async () => {
      if (!pool) throw new Error('Database pool not available');
      try {
        const client = await pool.connect();
        try {
          const result = await client.query('SELECT NOW()');
          console.log('[DATABASE] Connection healthy:', result.rows[0]);
          return true;
        } finally {
          client.release();
        }
      } catch (connectionError) {
        // Handle specific connection errors more gracefully
        console.log('[DATABASE] Connection attempt failed:', connectionError instanceof Error ? connectionError.message : 'Unknown error');
        throw connectionError;
      }
    })();

    return await Promise.race([connectionPromise, timeoutPromise]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (isDatabaseRequired()) {
      console.error('[DATABASE] Connection failed - PostgreSQL is required:', message);
    } else {
      console.log('[DATABASE] Connection failed - running in offline development mode:', message);
    }
    return false;
  }
}

// Database maintenance utilities
export async function optimizeDatabase() {
  if (!pool) {
    console.log('[DATABASE] Skipping optimization - running in offline mode');
    return;
  }

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

// Connection monitoring and graceful shutdown
export async function startConnectionMonitoring() {
  if (!pool) {
    console.log('[DATABASE] Skipping connection monitoring - running in offline mode');
    return;
  }

  // Set up periodic health checks
  setInterval(async () => {
    try {
      await checkDatabaseConnection();
    } catch (error) {
      console.error('[DATABASE] Health check failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  }, 30000); // Check every 30 seconds
}

export async function gracefulShutdown() {
  console.log('[DATABASE] Shutting down database connections...');
  
  if (pool) {
    try {
      await pool.end();
      console.log('[DATABASE] All connections closed successfully');
    } catch (error) {
      console.error('[DATABASE] Error during shutdown:', error instanceof Error ? error.message : 'Unknown error');
    }
  } else {
    console.log('[DATABASE] No active connections to close');
  }
}