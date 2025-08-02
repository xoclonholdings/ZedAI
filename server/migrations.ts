// Simple migration runner for database setup
import { db } from "./db";
import { sql } from "drizzle-orm";

export async function runMigrations(): Promise<void> {
  try {
    // Check if sessions table exists (required for authentication)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        sid varchar NOT NULL COLLATE "default" PRIMARY KEY,
        sess json NOT NULL,
        expire timestamp(6) NOT NULL
      );
    `);

    // Create index on sessions expire column if not exists
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions ("expire");
    `);

    console.log('[MIGRATIONS] Database setup completed successfully');
  } catch (error) {
    console.error('[MIGRATIONS] Failed to run migrations:', error);
    // Don't fail the app startup for migration issues
  }
}