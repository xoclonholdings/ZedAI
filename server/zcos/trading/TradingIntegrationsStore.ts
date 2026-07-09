import fs from "fs/promises";
import path from "path";

import { HUB_DIR } from "../../utils/repoPaths";
import {
  INTEGRATION_PROVIDERS,
  integrationProviderInfo,
  type IntegrationProvider,
  type IntegrationStatus,
  type TradingIntegration,
} from "../../../shared/trading-training-types";

/**
 * Per-user trading provider connections (TopStep, TradingView, Lucid,
 * Tradovate, custom).
 *
 * This is the real connection/credential layer that live sync will
 * use. Secrets are stored server-side and NEVER returned to the
 * client — the API only exposes whether a credential is present.
 *
 * Storage: hub/trading/integrations/<userId>.json
 */

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

function fileFor(userId: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.resolve(INTEGRATIONS_DIR, `${safe}.json`);
}

function now(): string {
  return new Date().toISOString();
}

async function readAll(userId: string): Promise<StoredIntegration[]> {
  try {
    const raw = await fs.readFile(fileFor(userId), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredIntegration[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(userId: string, records: StoredIntegration[]): Promise<void> {
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

  async connect(input: {
    userId: string;
    provider: IntegrationProvider;
    label?: string;
    baseUrl?: string;
    fields?: Record<string, string>;
    secrets?: Record<string, string>;
    notes?: string;
  }): Promise<TradingIntegration> {
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
  },

  async disconnect(userId: string, provider: IntegrationProvider): Promise<void> {
    const records = await readAll(userId);
    await writeAll(userId, records.filter((r) => r.provider !== provider));
  },

  /**
   * Test a connection. For `custom` with a base URL this performs a
   * real reachability check. For the named providers (no live bridge
   * yet) it validates that the required config is present — it does
   * NOT fabricate a live data pull.
   */
  async test(userId: string, provider: IntegrationProvider): Promise<TradingIntegration> {
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
        result = info.liveBridge
          ? "Configuration looks complete."
          : "Credentials saved. Live sync will use these once the provider bridge is enabled.";
      }
    }

    records[index] = { ...record, status, lastTestedAt: now(), lastResult: result, updatedAt: now() };
    await writeAll(userId, records);
    return sanitize(records[index]);
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
