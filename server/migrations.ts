import { db } from "./db";
import { sql } from "drizzle-orm";

export async function runMigrations(): Promise<void> {
  try {
    // Session store (express-session / connect-pg-simple)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        sid varchar NOT NULL COLLATE "default" PRIMARY KEY,
        sess json NOT NULL,
        expire timestamp(6) NOT NULL
      );
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions ("expire");
    `);

    // Durable key/value store for admin settings (managed users,
    // credentials, voice, approvals, integrations). The runtime keeps a
    // local hub/config/admin-settings.json cache for fast reads, but on
    // an ephemeral host (e.g. Render) that file is wiped on every
    // redeploy â€” so this table is the source of truth that survives
    // redeploys and is hydrated back into the file at boot.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS app_settings (
        id text PRIMARY KEY,
        data jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Users (single Admin row; seeded below)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id varchar PRIMARY KEY,
        email varchar UNIQUE,
        first_name varchar,
        last_name varchar,
        profile_image_url varchar,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);

    // Seed the single Admin user so FK constraints are satisfied
    await db.execute(sql`
      INSERT INTO users (id, email, first_name, last_name)
      VALUES ('user_001', 'admin@zed-ai.online', 'ZED', 'Admin')
      ON CONFLICT (id) DO NOTHING;
    `);

    // Conversations
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS conversations (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
        user_id varchar NOT NULL REFERENCES users(id),
        title text NOT NULL,
        preview text,
        model text NOT NULL DEFAULT 'lightning',
        mode text NOT NULL DEFAULT 'chat',
        is_active boolean DEFAULT false,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);

    // Messages
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS messages (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
        conversation_id varchar NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role text NOT NULL,
        content text NOT NULL,
        metadata jsonb,
        created_at timestamp DEFAULT now()
      );
    `);

    // Files
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS files (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
        conversation_id varchar NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        file_name text NOT NULL,
        original_name text NOT NULL,
        mime_type text NOT NULL,
        size integer NOT NULL,
        status text NOT NULL DEFAULT 'processing',
        extracted_content text,
        analysis jsonb,
        created_at timestamp DEFAULT now()
      );
    `);

    // Chat sessions (analytics)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
        conversation_id varchar NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        user_id varchar NOT NULL REFERENCES users(id),
        duration integer DEFAULT 0,
        messages_used integer DEFAULT 0,
        memory_usage integer DEFAULT 0,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);

    // Core memory
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS core_memory (
        id serial PRIMARY KEY,
        key varchar UNIQUE NOT NULL,
        value text NOT NULL,
        description text,
        admin_only boolean DEFAULT true,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);

    // Project memory (per-user durable context)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS project_memory (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
        user_id varchar NOT NULL REFERENCES users(id),
        name varchar NOT NULL,
        description text,
        content text NOT NULL,
        type text NOT NULL DEFAULT 'context',
        is_active boolean DEFAULT true,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_project_memory_user_active
      ON project_memory (user_id, is_active, updated_at DESC);
    `);

    // Scratchpad memory (temporary working context)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS scratchpad_memory (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
        user_id varchar NOT NULL REFERENCES users(id),
        conversation_id varchar REFERENCES conversations(id) ON DELETE CASCADE,
        content text NOT NULL,
        tags text[],
        expires_at timestamp NOT NULL,
        created_at timestamp DEFAULT now()
      );
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_scratchpad_memory_user_expires
      ON scratchpad_memory (user_id, expires_at);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_scratchpad_memory_conversation
      ON scratchpad_memory (conversation_id);
    `);

    // Trading state (durable JSONB blobs for the Trading module:
    // learned knowledge, stage progression, theses, paper trades,
    // governance history, TradingView records).
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS trading_state (
        scope varchar NOT NULL,
        key varchar NOT NULL,
        data jsonb NOT NULL,
        updated_at timestamp DEFAULT now(),
        PRIMARY KEY (scope, key)
      );
    `);

    // Learning Studio state. Each learning object is stored separately
    // so paths, sources, units, lessons, assessments, attempts, and
    // mastery records remain addressable instead of becoming one blob.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS learning_state (
        user_id varchar NOT NULL REFERENCES users(id),
        object_type text NOT NULL,
        object_id varchar NOT NULL,
        data jsonb NOT NULL,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        PRIMARY KEY (user_id, object_type, object_id)
      );
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_learning_state_user_type
      ON learning_state (user_id, object_type, updated_at DESC);
    `);

    console.log('[MIGRATIONS] Database setup completed successfully');
  } catch (error) {
    console.error('[MIGRATIONS] Failed to run migrations:', error);
    throw error;
  }
}
