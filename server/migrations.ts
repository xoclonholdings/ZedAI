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

    // Seed the canonical Admin user so FK constraints are satisfied.
    await db.execute(sql`
      INSERT INTO users (id, email, first_name, last_name)
      VALUES ('user_admin', 'admin@zar-ai.online', 'ZAR', 'Admin')
      ON CONFLICT (id) DO NOTHING;
    `);
    await db.execute(sql`
      UPDATE users
      SET email = 'admin@zar-ai.online', updated_at = now()
      WHERE id = 'user_admin'
        AND email IS DISTINCT FROM 'admin@zar-ai.online';
    `);

    // External authentication identities map verified provider subjects to
    // one internal ZCOS owner. Provider subjects are hashed before storage.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS auth_identities (
        id varchar PRIMARY KEY,
        user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider varchar NOT NULL,
        issuer varchar NOT NULL,
        subject_hash varchar NOT NULL,
        verified_email varchar,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        last_authenticated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (provider, issuer, subject_hash)
      );
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_auth_identities_user
      ON auth_identities (user_id, provider, updated_at DESC);
    `);

    // Replay guard and audit receipt for signed cross-galaxy capabilities.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS capability_message_receipts (
        message_id varchar PRIMARY KEY,
        owner_user_id varchar NOT NULL REFERENCES users(id),
        path varchar NOT NULL,
        capability varchar NOT NULL,
        received_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL
      );
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_capability_receipts_expires
      ON capability_message_receipts (expires_at);
    `);

    // Complete, owner-scoped ZCOS intelligence and capability traces. The
    // JSON document is the versioned execution envelope; PostgreSQL is the
    // canonical store, never a prompt or vector projection.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS zcos_execution_traces (
        trace_id varchar PRIMARY KEY,
        request_id varchar NOT NULL,
        owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        origin_galaxy varchar NOT NULL,
        status varchar NOT NULL,
        trace jsonb NOT NULL,
        started_at timestamptz NOT NULL,
        completed_at timestamptz
      );
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_zcos_execution_traces_owner_started
      ON zcos_execution_traces (owner_user_id, started_at);
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_zcos_execution_traces_request
      ON zcos_execution_traces (request_id);
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

    // ZAR by Text. Phone numbers and message bodies are encrypted before
    // persistence; deterministic phone hashes support identity resolution
    // without making a phone number an account identity.
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sms_phone_connections (
        id varchar PRIMARY KEY,
        user_id varchar NOT NULL REFERENCES users(id),
        phone_hash text NOT NULL UNIQUE,
        phone_ciphertext text NOT NULL,
        phone_last_four varchar(4) NOT NULL,
        status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','revoked')),
        permissions jsonb NOT NULL DEFAULT '{"memory":true,"knowledge":true,"projects":true,"reminders":true,"commands":false}'::jsonb,
        conversation_id varchar REFERENCES conversations(id) ON DELETE SET NULL,
        consented_at timestamptz NOT NULL,
        policy_version text NOT NULL,
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_sms_connections_user_status
      ON sms_phone_connections (user_id, status, updated_at DESC);
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sms_verification_challenges (
        id varchar PRIMARY KEY,
        user_id varchar NOT NULL REFERENCES users(id),
        phone_hash text NOT NULL,
        phone_ciphertext text NOT NULL,
        phone_last_four varchar(4) NOT NULL,
        code_hash text NOT NULL,
        permissions jsonb NOT NULL,
        expires_at timestamptz NOT NULL,
        attempts integer NOT NULL DEFAULT 0,
        max_attempts integer NOT NULL DEFAULT 5,
        consumed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_sms_challenges_user_created
      ON sms_verification_challenges (user_id, created_at DESC);
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sms_message_envelopes (
        id varchar PRIMARY KEY,
        direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
        provider text NOT NULL,
        provider_message_id text,
        idempotency_key text NOT NULL,
        phone_hash text NOT NULL,
        connection_id varchar REFERENCES sms_phone_connections(id) ON DELETE SET NULL,
        body_ciphertext text NOT NULL,
        segment_index integer NOT NULL DEFAULT 1,
        segment_count integer NOT NULL DEFAULT 1,
        delivery_state text NOT NULL,
        received_at timestamptz,
        redacted_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (provider, provider_message_id),
        UNIQUE (provider, idempotency_key)
      );
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_sms_envelopes_connection_created
      ON sms_message_envelopes (connection_id, created_at DESC);
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sms_security_events (
        id varchar PRIMARY KEY,
        user_id varchar REFERENCES users(id) ON DELETE SET NULL,
        connection_id varchar REFERENCES sms_phone_connections(id) ON DELETE SET NULL,
        event_type text NOT NULL,
        phone_last_four varchar(4),
        ip_hash text,
        user_agent_hash text,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_sms_security_user_created
      ON sms_security_events (user_id, created_at DESC);
    `);

    console.log('[MIGRATIONS] Database setup completed successfully');
  } catch (error) {
    console.error('[MIGRATIONS] Failed to run migrations:', error);
    throw error;
  }
}
