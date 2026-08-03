import fs from "fs/promises";
import path from "path";

import { HUB_DIR } from "../../utils/repoPaths";
import {
  readTradingState,
  writeTradingState,
} from "./tradingPersistence";
import {
  INTEGRATION_PROVIDERS,
  integrationProviderInfo,
  type IntegrationProvider,
  type IntegrationStatus,
  type TradingIntegration,
} from "../../../shared/trading-training-types";

/**
 * Per-user trading provider connections (Webull, Tradovate, Lucid,
 * Kalshi, Polymarket, custom).
 *
 * This is the real connection/credential layer that live sync will
 * use. Secrets are stored server-side and NEVER returned to the
 * client — the API only exposes whether a credential is present.
 *
 * Storage: durable `trading_state` table (scope "integrations", key
 * per user) so a login survives restarts/redeploys and the user
 * staying signed out of the app never wipes what ZAR can sign into.
 * On hosts with no database configured we fall back to the legacy
 * JSON file at hub/trading/integrations/<userId>.json.
 */

const INTEGRATIONS_SCOPE = "integrations";
const INTEGRATIONS_DIR = path.resolve(HUB_DIR, "trading", "integrations");

interface StoredIntegration {
  provider: IntegrationProvider;
  label: string;
  status: IntegrationStatus;
  baseUrl?: string;
  fields: Record<string, string>;
  secrets: Record<string, string>;
  notes?: string;
  lastTestedAt?: string;
  lastResult?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TradingIntegrationConnection {
  provider: IntegrationProvider;
  label: string;
  status: IntegrationStatus;
  baseUrl?: string;
  fields: Record<string, string>;
  secrets: Record<string, string>;
}

function keyFor(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function fileFor(userId: string): string {
  return path.resolve(INTEGRATIONS_DIR, `${keyFor(userId)}.json`);
}

function now(): string {
  return new Date().toISOString();
}

const userLocks = new Map<string, Promise<unknown>>();

/**
 * Serializes read-modify-write operations per user. Every mutator here
 * (connect/disconnect/test/recordTestResult) does readAll → mutate →
 * writeAll with no transaction — two concurrent calls for the same user
 * (e.g. saving one provider's credentials while another finishes a test)
 * would both read the same stale array and the second writeAll would
 * silently overwrite the first's change. Chaining every mutation for a
 * given user behind the previous one closes that window without needing
 * a real database transaction.
 */
function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const previous = userLocks.get(userId) ?? Promise.resolve();
  const settle = previous.then(fn, fn);
  userLocks.set(
    userId,
    settle.then(
      () => undefined,
      () => undefined,
    ),
  );
  return settle;
}

async function readAll(userId: string): Promise<StoredIntegration[]> {
  // Durable DB is the source of truth so connections survive restarts.
  const fromDb = await readTradingState<StoredIntegration[]>(INTEGRATIONS_SCOPE, keyFor(userId));
  if (Array.isArray(fromDb)) return fromDb;
  // No DB row yet (offline mode, or data written before this migration) —
  // seed from the legacy JSON file; the next write persists it to the DB.
  try {
    const raw = await fs.readFile(fileFor(userId), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredIntegration[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(userId: string, records: StoredIntegration[]): Promise<void> {
  const wroteDb = await writeTradingState(INTEGRATIONS_SCOPE, keyFor(userId), records);
  if (wroteDb) return;
  // No database configured — keep the legacy JSON file working offline.
  await fs.mkdir(INTEGRATIONS_DIR, { recursive: true });
  await fs.writeFile(fileFor(userId), JSON.stringify(records, null, 2), "utf8");
}

function sanitize(record: StoredIntegration): TradingIntegration {
  return {
    provider: record.provider,
    label: record.label,
    status: record.status,
    baseUrl: record.baseUrl,
    hasCredential: Object.values(record.secrets || {}).some((v) => Boolean(v)),
    notes: record.notes,
    lastTestedAt: record.lastTestedAt,
    lastResult: record.lastResult,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/** All five providers, each with its current connection state (or disconnected). */
export const TradingIntegrationsStore = {
  async list(userId: string): Promise<TradingIntegration[]> {
    const stored = await readAll(userId);
    const byProvider = new Map(stored.map((s) => [s.provider, s]));
    return INTEGRATION_PROVIDERS.map((info) => {
      const existing = byProvider.get(info.provider);
      if (existing) return sanitize(existing);
      return {
        provider: info.provider,
        label: info.label,
        status: "disconnected" as IntegrationStatus,
        hasCredential: false,
        createdAt: "",
        updatedAt: "",
      };
    });
  },

  async getConnection(userId: string, provider: IntegrationProvider): Promise<TradingIntegrationConnection | null> {
    const records = await readAll(userId);
    const record = records.find((r) => r.provider === provider);
    if (!record) return null;
    return {
      provider: record.provider,
      label: record.label,
      status: record.status,
      baseUrl: record.baseUrl,
      fields: { ...(record.fields || {}) },
      secrets: { ...(record.secrets || {}) },
    };
  },

  async connect(input: {
    userId: string;
    provider: IntegrationProvider;
    label?: string;
    baseUrl?: string;
    fields?: Record<string, string>;
    secrets?: Record<string, string>;
    notes?: string;
  }): Promise<TradingIntegration> {
    return withUserLock(input.userId, async () => {
      const info = integrationProviderInfo(input.provider);
      if (!info) throw new Error(`Unknown provider: ${input.provider}`);

      const records = await readAll(input.userId);
      const index = records.findIndex((r) => r.provider === input.provider);
      const existing = index >= 0 ? records[index] : undefined;

      const record: StoredIntegration = {
        provider: input.provider,
        label: input.label?.trim() || info.label,
        status: "configured",
        baseUrl: input.baseUrl?.trim() || existing?.baseUrl,
        fields: { ...(existing?.fields || {}), ...(input.fields || {}) },
        // Only overwrite a secret when a non-empty value is supplied.
        secrets: { ...(existing?.secrets || {}) },
        notes: input.notes ?? existing?.notes,
        lastTestedAt: existing?.lastTestedAt,
        lastResult: existing?.lastResult,
        createdAt: existing?.createdAt || now(),
        updatedAt: now(),
      };
      for (const [key, value] of Object.entries(input.secrets || {})) {
        if (typeof value === "string" && value.trim()) record.secrets[key] = value.trim();
      }

      if (index >= 0) records[index] = record;
      else records.push(record);
      await writeAll(input.userId, records);
      return sanitize(record);
    });
  },

  async disconnect(userId: string, provider: IntegrationProvider): Promise<void> {
    await withUserLock(userId, async () => {
      const records = await readAll(userId);
      await writeAll(userId, records.filter((r) => r.provider !== provider));
    });
  },

  /**
   * Test a connection. For `custom` with a base URL this performs a
   * real reachability check. For the named providers (no live bridge
   * yet) it validates that the required config is present — it does
   * NOT fabricate a live data pull.
   */
  async test(userId: string, provider: IntegrationProvider): Promise<TradingIntegration> {
    return withUserLock(userId, async () => {
      const info = integrationProviderInfo(provider);
      if (!info) throw new Error(`Unknown provider: ${provider}`);
      const records = await readAll(userId);
      const index = records.findIndex((r) => r.provider === provider);
      if (index < 0) throw new Error(`${info.label} is not connected yet.`);
      const record = records[index];

      let status: IntegrationStatus = "configured";
      let result: string;

      if (provider === "custom") {
        const url = record.baseUrl;
        if (!url) {
          status = "error";
          result = "No base URL set. Add the endpoint URL, then test again.";
        } else {
          const reach = await probeUrl(url);
          status = reach.ok ? "connected" : "error";
          result = reach.message;
        }
      } else {
        const requiredNonSecret = info.fields.filter((f) => !f.secret && !f.optional);
        const missing = requiredNonSecret.filter((f) => !String(record.fields[f.key] || "").trim());
        if (missing.length) {
          status = "error";
          result = `Missing: ${missing.map((f) => f.label).join(", ")}.`;
        } else {
          status = "configured";
          result = "Saved securely. ZAR will use this login to sign in and work in the account for you.";
        }
      }

      records[index] = { ...record, status, lastTestedAt: now(), lastResult: result, updatedAt: now() };
      await writeAll(userId, records);
      return sanitize(records[index]);
    });
  },

  /**
   * Record the outcome of a *real* provider-specific test (e.g. Webull's
   * live account-list call) — for providers with a real `liveBridge`,
   * this replaces the generic `test()` above, which only checks that
   * required fields are non-empty and can't actually tell a wrong
   * credential pair from a working one.
   */
  async recordTestResult(
    userId: string,
    provider: IntegrationProvider,
    outcome: { status: IntegrationStatus; result: string },
  ): Promise<TradingIntegration> {
    return withUserLock(userId, async () => {
      const records = await readAll(userId);
      const index = records.findIndex((r) => r.provider === provider);
      if (index < 0) throw new Error(`${integrationProviderInfo(provider)?.label || provider} is not connected yet.`);
      records[index] = {
        ...records[index],
        status: outcome.status,
        lastTestedAt: now(),
        lastResult: outcome.result,
        updatedAt: now(),
      };
      await writeAll(userId, records);
      return sanitize(records[index]);
    });
  },
};

async function probeUrl(url: string): Promise<{ ok: boolean; message: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    return { ok: res.ok, message: `Reached ${url} — HTTP ${res.status}.` };
  } catch (err: any) {
    return { ok: false, message: `Could not reach ${url}: ${err?.message || "request failed"}.` };
  } finally {
    clearTimeout(timeout);
  }
}
