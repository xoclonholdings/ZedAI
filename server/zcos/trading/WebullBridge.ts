import type { IntegrationProvider } from "../../../shared/trading-training-types";
import crypto from "crypto";

import type { ExecutionAccountSummary, ExecutionAdapterStatus } from "./ExecutionAdapterTypes";
import { TradingIntegrationsStore } from "./TradingIntegrationsStore";

const PROVIDER: IntegrationProvider = "webull";
const DEFAULT_SANDBOX_ENDPOINT = "api.sandbox.webull.com";
const DEFAULT_PRODUCTION_ENDPOINT = "api.webull.com";

function value(record: Awaited<ReturnType<typeof TradingIntegrationsStore.getConnection>>, key: string): string {
  return String(record?.fields?.[key] || record?.secrets?.[key] || "").trim();
}

function envValue(key: string): string {
  return String(process.env[key] || "").trim();
}

function resolvedValue(
  record: Awaited<ReturnType<typeof TradingIntegrationsStore.getConnection>>,
  key: string,
  envKey: string,
): string {
  return value(record, key) || envValue(envKey);
}

function environmentMode(raw: string): ExecutionAdapterStatus["mode"] {
  const clean = raw.toLowerCase();
  if (clean === "production" || clean === "live") return "production";
  if (clean === "sandbox" || clean === "test" || clean === "paper") return "sandbox";
  return "sandbox";
}

function endpointFor(rawEndpoint: string, mode: ExecutionAdapterStatus["mode"]): string {
  const clean = rawEndpoint.replace(/^https?:\/\//, "").replace(/\/+$/, "").trim();
  if (clean) return clean;
  return mode === "production" ? DEFAULT_PRODUCTION_ENDPOINT : DEFAULT_SANDBOX_ENDPOINT;
}

export async function getWebullStatus(userId: string): Promise<ExecutionAdapterStatus> {
  const connection = await TradingIntegrationsStore.getConnection(userId, PROVIDER);
  const appKey = resolvedValue(connection, "appKey", "WEBULL_APP_KEY");
  const appSecret = resolvedValue(connection, "appSecret", "WEBULL_APP_SECRET");
  const endpoint = resolvedValue(connection, "endpoint", "WEBULL_API_ENDPOINT");
  const accountId = resolvedValue(connection, "accountId", "WEBULL_ACCOUNT_ID");
  const mode = environmentMode(resolvedValue(connection, "environment", "WEBULL_ENVIRONMENT"));
  const effectiveEndpoint = endpointFor(endpoint, mode);
  const missing = [
    !appKey ? "App key" : "",
    !appSecret ? "App secret" : "",
  ].filter(Boolean);

  const configured = missing.length === 0;
  const accounts = accountId
    ? [{ id: accountId, label: `Webull ${mode} account`, type: "default" }]
    : [];

  return {
    provider: PROVIDER,
    label: "Webull",
    configured,
    connected: configured && Boolean(accountId),
    status: configured ? (accountId ? "connected" : "configured") : "disconnected",
    mode,
    missing,
    capabilities: {
      assets: ["stock", "option", "future", "crypto", "event_contract"],
      readAccounts: true,
      readPositions: true,
      placeOrders: true,
      streamOrders: false,
    },
    accounts,
    note: configured
      ? accountId
        ? `Webull ${mode} credentials are saved with a default paper account. Governed paper order tickets are enabled.`
        : `Webull ${mode} credentials are available. Run the Webull test to retrieve accounts, then save the paper account ID.`
      : `Add Webull OpenAPI credentials${effectiveEndpoint ? ` for ${effectiveEndpoint}` : ""}.`,
    saved: {
      appKey: Boolean(appKey),
      appKeyLast4: appKey ? appKey.slice(-4) : undefined,
      appSecret: Boolean(appSecret),
      endpoint: effectiveEndpoint,
      accountId: accountId || undefined,
      environment: mode,
    },
  };
}

export async function saveWebullCredentials(
  userId: string,
  input: {
    appKey?: string;
    appSecret?: string;
    endpoint?: string;
    accountId?: string;
    environment?: string;
    accessToken?: string;
  },
): Promise<ExecutionAdapterStatus> {
  await TradingIntegrationsStore.connect({
    userId,
    provider: PROVIDER,
    fields: {
      ...(input.appKey ? { appKey: input.appKey } : {}),
      ...(input.endpoint ? { endpoint: input.endpoint } : {}),
      ...(input.accountId ? { accountId: input.accountId } : {}),
      ...(input.environment ? { environment: input.environment } : {}),
    },
    secrets: {
      ...(input.appSecret ? { appSecret: input.appSecret } : {}),
      ...(input.accessToken ? { accessToken: input.accessToken } : {}),
    },
  });
  return getWebullStatus(userId);
}

export async function listWebullAccounts(userId: string): Promise<{
  connected: boolean;
  accounts: ExecutionAccountSummary[];
  note: string;
}> {
  const status = await getWebullStatus(userId);
  return {
    connected: status.connected,
    accounts: status.accounts,
    note: status.accounts.length
      ? "Using the saved Webull default account. Full account discovery is next in the Webull SDK bridge."
      : status.note,
  };
}

export async function listWebullPositions(userId: string): Promise<{
  connected: boolean;
  positions: unknown[];
  note: string;
}> {
  const status = await getWebullStatus(userId);
  return {
    connected: status.connected,
    positions: [],
    note: status.configured
      ? "Webull position sync endpoint is reserved; SDK-backed position reads are not enabled yet."
      : status.note,
  };
}

export async function listWebullOrders(userId: string): Promise<{
  connected: boolean;
  orders: unknown[];
  note: string;
}> {
  const status = await getWebullStatus(userId);
  return {
    connected: status.connected,
    orders: [],
    note: status.configured
      ? "Webull order sync endpoint is reserved; SDK-backed order reads are not enabled yet."
      : status.note,
  };
}

function compactBody(body: unknown): string | undefined {
  return body ? JSON.stringify(body) : undefined;
}

function signWebullRequest(input: {
  appKey: string;
  appSecret: string;
  host: string;
  path: string;
  queryParams?: Record<string, string>;
  body?: unknown;
}): { headers: Record<string, string>; bodyString?: string } {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const bodyString = compactBody(input.body);
  const signingParams: Record<string, string> = {
    ...(input.queryParams || {}),
    host: input.host,
    "x-app-key": input.appKey,
    "x-signature-algorithm": "HMAC-SHA1",
    "x-signature-nonce": nonce,
    "x-signature-version": "1.0",
    "x-timestamp": timestamp,
  };
  const str1 = Object.keys(signingParams)
    .sort()
    .map((key) => `${key}=${signingParams[key]}`)
    .join("&");
  const str3 = bodyString
    ? `${input.path}&${str1}&${crypto.createHash("md5").update(bodyString).digest("hex").toUpperCase()}`
    : `${input.path}&${str1}`;
  const encoded = encodeURIComponent(str3);
  const signature = crypto
    .createHmac("sha1", `${input.appSecret}&`)
    .update(encoded)
    .digest("base64");
  return {
    bodyString,
    headers: {
      "x-app-key": input.appKey,
      "x-timestamp": timestamp,
      "x-signature": signature,
      "x-signature-algorithm": "HMAC-SHA1",
      "x-signature-version": "1.0",
      "x-signature-nonce": nonce,
      "x-version": "v2",
    },
  };
}

export async function testWebullConnection(userId: string): Promise<{
  ok: boolean;
  statusCode?: number;
  endpoint?: string;
  accountCount?: number;
  accounts: ExecutionAccountSummary[];
  message: string;
}> {
  const connection = await TradingIntegrationsStore.getConnection(userId, PROVIDER);
  const appKey = resolvedValue(connection, "appKey", "WEBULL_APP_KEY");
  const appSecret = resolvedValue(connection, "appSecret", "WEBULL_APP_SECRET");
  const mode = environmentMode(resolvedValue(connection, "environment", "WEBULL_ENVIRONMENT"));
  const endpoint = endpointFor(resolvedValue(connection, "endpoint", "WEBULL_API_ENDPOINT"), mode);
  const accessToken = resolvedValue(connection, "accessToken", "WEBULL_ACCESS_TOKEN");
  if (!appKey || !appSecret) {
    return {
      ok: false,
      endpoint,
      accounts: [],
      message: "Missing WEBULL_APP_KEY or WEBULL_APP_SECRET on the server, and no saved Webull credentials exist.",
    };
  }

  const path = "/openapi/account/list";
  const signed = signWebullRequest({ appKey, appSecret, host: endpoint, path });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`https://${endpoint}${path}`, {
      method: "GET",
      headers: {
        ...signed.headers,
        ...(accessToken ? { "x-access-token": accessToken } : {}),
      },
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    const rawAccounts = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as any)?.data)
        ? (parsed as any).data
        : Array.isArray((parsed as any)?.accounts)
          ? (parsed as any).accounts
          : [];
    const accounts: ExecutionAccountSummary[] = rawAccounts.map((account: any, index: number) => ({
      id: String(account.account_id || account.accountId || account.id || `account-${index + 1}`),
      label: String(account.account_type || account.accountType || account.type || "Webull account"),
      type: String(account.account_type || account.accountType || account.type || "unknown"),
      raw: account,
    }));
    return {
      ok: res.ok,
      statusCode: res.status,
      endpoint,
      accountCount: accounts.length,
      accounts,
      message: res.ok
        ? `Webull account-list test succeeded (${accounts.length} account${accounts.length === 1 ? "" : "s"} returned).`
        : `Webull account-list test failed with HTTP ${res.status}: ${text.slice(0, 240) || res.statusText}`,
    };
  } catch (err: any) {
    return {
      ok: false,
      endpoint,
      accounts: [],
      message: `Could not reach Webull ${endpoint}: ${err?.message || "request failed"}.`,
    };
  } finally {
    clearTimeout(timeout);
  }
}
