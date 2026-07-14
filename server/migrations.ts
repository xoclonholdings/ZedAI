import { db } from "./db";
import { sql } from "drizzle-orm";
import { CANONICAL_ADMIN_USER_ID } from "../shared/memoryOwnership";

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
    // redeploy - so this table is the source of truth that survives
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

    // Seed the canonical Admin user used by managed-user auth and
    // legacy archive ownership. Older deployments may still have a
    // user_001 seed row; this does not delete it.
    await db.execute(sql`
      INSERT INTO users (id, email, first_name, last_name)
      VALUES (${CANONICAL_ADMIN_USER_ID}, 'admin@zed-ai.online', 'ZED', 'Admin')
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

    // Memory boundary foundation. These tables establish the durable
    // split between Zed Core, shared installed knowledge, per-user
    // identity/personalization, and per-user knowledge/history. They do
    // not import, summarize, or migrate legacy archive contents.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_memory_profiles (
        user_id varchar PRIMARY KEY REFERENCES users(id),
        preferred_name text,
        profile_status text NOT NULL DEFAULT 'empty'
          CHECK (profile_status IN ('empty', 'discovered', 'active', 'needs_review', 'disabled')),
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_memory_policies (
        user_id varchar PRIMARY KEY REFERENCES users(id),
        allowed_memory_categories text[] NOT NULL DEFAULT ARRAY[]::text[],
        categories_requiring_confirmation text[] NOT NULL DEFAULT ARRAY[]::text[],
        prohibited_categories text[] NOT NULL DEFAULT ARRAY[]::text[],
        retention_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS memory_sources (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
        user_id varchar REFERENCES users(id),
        source_type text NOT NULL,
        label text NOT NULL,
        original_location_ref text,
        ownership text NOT NULL
          CHECK (ownership IN ('zed_core', 'shared_system', 'user_identity', 'user_history')),
        content_hash text NOT NULL,
        status text NOT NULL DEFAULT 'staged'
          CHECK (status IN ('staged', 'active', 'archived', 'blocked', 'deleted')),
        authority_state text NOT NULL DEFAULT 'observed'
          CHECK (authority_state IN ('historical_evidence', 'observed', 'proposed', 'confirmed', 'rejected', 'superseded')),
        temporal_status text NOT NULL DEFAULT 'unknown'
          CHECK (temporal_status IN ('current', 'historical', 'future', 'deprecated', 'superseded', 'unknown')),
        privacy_level text NOT NULL DEFAULT 'private'
          CHECK (privacy_level IN ('public', 'shared_internal', 'private', 'sensitive', 'secret')),
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        CHECK (
          (ownership IN ('zed_core', 'shared_system') AND user_id IS NULL) OR
          (ownership IN ('user_identity', 'user_history') AND user_id IS NOT NULL)
        )
      );
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_memory_sources_user_owner
      ON memory_sources (user_id, ownership);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_memory_sources_hash
      ON memory_sources (content_hash);
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS memory_objects (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
        user_id varchar REFERENCES users(id),
        source_references jsonb NOT NULL DEFAULT '[]'::jsonb,
        object_type text NOT NULL,
        canonical_name text NOT NULL,
        summary text,
        structured_value jsonb,
        ownership text NOT NULL
          CHECK (ownership IN ('zed_core', 'shared_system', 'user_identity', 'user_history')),
        authority_state text NOT NULL DEFAULT 'observed'
          CHECK (authority_state IN ('historical_evidence', 'observed', 'proposed', 'confirmed', 'rejected', 'superseded')),
        confidence real NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
        temporal_status text NOT NULL DEFAULT 'unknown'
          CHECK (temporal_status IN ('current', 'historical', 'future', 'deprecated', 'superseded', 'unknown')),
        privacy_level text NOT NULL DEFAULT 'private'
          CHECK (privacy_level IN ('public', 'shared_internal', 'private', 'sensitive', 'secret')),
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now(),
        CHECK (
          (ownership IN ('zed_core', 'shared_system') AND user_id IS NULL) OR
          (ownership IN ('user_identity', 'user_history') AND user_id IS NOT NULL)
        )
      );
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_memory_objects_user_owner
      ON memory_objects (user_id, ownership);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_memory_objects_type_name
      ON memory_objects (object_type, canonical_name);
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS memory_proposals (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::varchar,
        user_id varchar NOT NULL REFERENCES users(id),
        proposed_category text NOT NULL,
        proposed_value jsonb NOT NULL,
        evidence_references jsonb NOT NULL DEFAULT '[]'::jsonb,
        status text NOT NULL DEFAULT 'observed'
          CHECK (status IN ('observed', 'proposed', 'confirmed', 'rejected', 'superseded')),
        created_at timestamp DEFAULT now(),
        resolved_at timestamp
      );
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_memory_proposals_user_status
      ON memory_proposals (user_id, status);
    `);

    console.log('[MIGRATIONS] Database setup completed successfully');
  } catch (error) {
    console.error('[MIGRATIONS] Failed to run migrations:', error);
    throw error;
  }
}