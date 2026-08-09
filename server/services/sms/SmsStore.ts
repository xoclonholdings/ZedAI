import { randomUUID } from "crypto";

import { pool } from "../../db";
import { DEFAULT_SMS_PERMISSIONS, type SmsConnection, type SmsPermissions } from "./types";

export interface VerificationChallenge {
  id: string;
  userId: string;
  phoneHash: string;
  phoneCiphertext: string;
  phoneLastFour: string;
  codeHash: string;
  permissions: SmsPermissions;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
  consumedAt: Date | null;
}

function connectionFromRow(row: any): SmsConnection {
  return {
    id: row.id,
    userId: row.user_id,
    phoneHash: row.phone_hash,
    phoneCiphertext: row.phone_ciphertext,
    phoneLastFour: row.phone_last_four,
    status: row.status,
    permissions: { ...DEFAULT_SMS_PERMISSIONS, ...(row.permissions || {}) },
    conversationId: row.conversation_id || null,
    consentedAt: new Date(row.consented_at),
    revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
    policyVersion: row.policy_version,
  };
}

function challengeFromRow(row: any): VerificationChallenge {
  return {
    id: row.id,
    userId: row.user_id,
    phoneHash: row.phone_hash,
    phoneCiphertext: row.phone_ciphertext,
    phoneLastFour: row.phone_last_four,
    codeHash: row.code_hash,
    permissions: { ...DEFAULT_SMS_PERMISSIONS, ...(row.permissions || {}) },
    expiresAt: new Date(row.expires_at),
    attempts: Number(row.attempts),
    maxAttempts: Number(row.max_attempts),
    consumedAt: row.consumed_at ? new Date(row.consumed_at) : null,
  };
}

function database() {
  if (!pool) throw new Error("PostgreSQL is required for ZAR by Text");
  return pool;
}

export class SmsStore {
  async findConnectionByPhoneHash(phoneHash: string): Promise<SmsConnection | null> {
    const result = await database().query(
      "SELECT * FROM sms_phone_connections WHERE phone_hash = $1 LIMIT 1",
      [phoneHash],
    );
    return result.rows[0] ? connectionFromRow(result.rows[0]) : null;
  }

  async getConnectionForUser(userId: string): Promise<SmsConnection | null> {
    const result = await database().query(
      "SELECT * FROM sms_phone_connections WHERE user_id = $1 AND status <> 'revoked' ORDER BY updated_at DESC LIMIT 1",
      [userId],
    );
    return result.rows[0] ? connectionFromRow(result.rows[0]) : null;
  }

  async createChallenge(input: Omit<VerificationChallenge, "attempts" | "consumedAt">): Promise<void> {
    await database().query("UPDATE sms_verification_challenges SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL", [input.userId]);
    await database().query(
      `INSERT INTO sms_verification_challenges
       (id, user_id, phone_hash, phone_ciphertext, phone_last_four, code_hash, permissions, expires_at, max_attempts)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)`,
      [input.id, input.userId, input.phoneHash, input.phoneCiphertext, input.phoneLastFour, input.codeHash, JSON.stringify(input.permissions), input.expiresAt, input.maxAttempts],
    );
  }

  async getChallenge(id: string, userId: string): Promise<VerificationChallenge | null> {
    const result = await database().query(
      "SELECT * FROM sms_verification_challenges WHERE id = $1 AND user_id = $2 LIMIT 1",
      [id, userId],
    );
    return result.rows[0] ? challengeFromRow(result.rows[0]) : null;
  }

  async incrementChallengeAttempts(id: string): Promise<number> {
    const result = await database().query(
      "UPDATE sms_verification_challenges SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts",
      [id],
    );
    return Number(result.rows[0]?.attempts || 0);
  }

  async consumeChallengeAndLink(challenge: VerificationChallenge, policyVersion: string): Promise<SmsConnection> {
    const client = await database().connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query("SELECT user_id FROM sms_phone_connections WHERE phone_hash = $1 FOR UPDATE", [challenge.phoneHash]);
      if (existing.rows[0] && existing.rows[0].user_id !== challenge.userId) {
        throw new Error("Phone connection cannot be completed");
      }
      await client.query("UPDATE sms_phone_connections SET status = 'revoked', revoked_at = now(), updated_at = now() WHERE user_id = $1 AND phone_hash <> $2 AND status <> 'revoked'", [challenge.userId, challenge.phoneHash]);
      const id = randomUUID();
      const linked = await client.query(
        `INSERT INTO sms_phone_connections
         (id, user_id, phone_hash, phone_ciphertext, phone_last_four, status, permissions, consented_at, policy_version)
         VALUES ($1,$2,$3,$4,$5,'active',$6::jsonb,now(),$7)
         ON CONFLICT (phone_hash) DO UPDATE SET
           phone_ciphertext = EXCLUDED.phone_ciphertext,
           phone_last_four = EXCLUDED.phone_last_four,
           status = 'active', permissions = EXCLUDED.permissions,
           consented_at = now(), revoked_at = NULL,
           policy_version = EXCLUDED.policy_version, updated_at = now()
         RETURNING *`,
        [id, challenge.userId, challenge.phoneHash, challenge.phoneCiphertext, challenge.phoneLastFour, JSON.stringify(challenge.permissions), policyVersion],
      );
      await client.query("UPDATE sms_verification_challenges SET consumed_at = now() WHERE id = $1", [challenge.id]);
      await client.query("COMMIT");
      return connectionFromRow(linked.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async claimInbound(input: { provider: string; providerMessageId: string; phoneHash: string; connectionId: string | null; bodyCiphertext: string }): Promise<boolean> {
    const result = await database().query(
      `INSERT INTO sms_message_envelopes
       (id, direction, provider, provider_message_id, idempotency_key, phone_hash, connection_id, body_ciphertext, delivery_state, received_at)
       VALUES ($1,'inbound',$2,$3,$4,$5,$6,$7,'received',now())
       ON CONFLICT (provider, provider_message_id) DO NOTHING`,
      [randomUUID(), input.provider, input.providerMessageId, `in:${input.provider}:${input.providerMessageId}`, input.phoneHash, input.connectionId, input.bodyCiphertext],
    );
    return (result.rowCount || 0) === 1;
  }

  async enqueueOutbound(input: { idempotencyKey: string; provider: string; phoneHash: string; connectionId: string | null; bodyCiphertext: string; segmentIndex: number; segmentCount: number }): Promise<string> {
    const id = randomUUID();
    const result = await database().query(
      `INSERT INTO sms_message_envelopes
       (id, direction, provider, idempotency_key, phone_hash, connection_id, body_ciphertext, segment_index, segment_count, delivery_state)
       VALUES ($1,'outbound',$2,$3,$4,$5,$6,$7,$8,'queued')
       ON CONFLICT (provider, idempotency_key) DO UPDATE SET updated_at = sms_message_envelopes.updated_at
       RETURNING id`,
      [id, input.provider, input.idempotencyKey, input.phoneHash, input.connectionId, input.bodyCiphertext, input.segmentIndex, input.segmentCount],
    );
    return result.rows[0].id;
  }

  async markOutbound(id: string, state: string, providerMessageId?: string): Promise<void> {
    await database().query(
      "UPDATE sms_message_envelopes SET delivery_state = $2, provider_message_id = COALESCE($3, provider_message_id), updated_at = now() WHERE id = $1",
      [id, state, providerMessageId || null],
    );
  }

  async updateDelivery(provider: string, providerMessageId: string, state: string): Promise<void> {
    await database().query(
      "UPDATE sms_message_envelopes SET delivery_state = $3, updated_at = now() WHERE provider = $1 AND provider_message_id = $2",
      [provider, providerMessageId, state],
    );
  }

  async setConnectionStatus(connectionId: string, status: SmsConnection["status"]): Promise<void> {
    await database().query(
      "UPDATE sms_phone_connections SET status = $2, revoked_at = CASE WHEN $2 = 'revoked' THEN now() ELSE revoked_at END, updated_at = now() WHERE id = $1",
      [connectionId, status],
    );
  }

  async updatePermissions(connectionId: string, userId: string, permissions: SmsPermissions): Promise<void> {
    await database().query(
      "UPDATE sms_phone_connections SET permissions = $3::jsonb, updated_at = now() WHERE id = $1 AND user_id = $2 AND status <> 'revoked'",
      [connectionId, userId, JSON.stringify(permissions)],
    );
  }

  async setConversation(connectionId: string, conversationId: string): Promise<void> {
    await database().query(
      "UPDATE sms_phone_connections SET conversation_id = $2, updated_at = now() WHERE id = $1",
      [connectionId, conversationId],
    );
  }

  async recordEvent(input: { userId?: string | null; connectionId?: string | null; type: string; phoneLastFour?: string | null; ipHash?: string | null; userAgentHash?: string | null; metadata?: Record<string, unknown> }): Promise<void> {
    await database().query(
      `INSERT INTO sms_security_events
       (id, user_id, connection_id, event_type, phone_last_four, ip_hash, user_agent_hash, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [randomUUID(), input.userId || null, input.connectionId || null, input.type, input.phoneLastFour || null, input.ipHash || null, input.userAgentHash || null, JSON.stringify(input.metadata || {})],
    );
  }

  async listEvents(userId: string, limit = 20): Promise<any[]> {
    const result = await database().query(
      `SELECT event_type AS "eventType", phone_last_four AS "phoneLastFour", metadata, created_at AS "createdAt"
       FROM sms_security_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, Math.min(Math.max(limit, 1), 50)],
    );
    return result.rows;
  }
}
