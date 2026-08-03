import { readTradingObject, writeTradingObject } from "./tradingPersistence";

/**
 * Tradovate execution bridge — the real order rail.
 *
 * Handles auth against Tradovate's REST API (demo = paper account, live =
 * funded account), lists accounts, and places orders. Credentials are
 * stored server-side and NEVER returned to the client.
 *
 * This is the one integration that makes external paper (Tradovate demo)
 * and live trading (Tradovate live) real. It is written to the documented
 * Tradovate API but only runs once you add your credentials and the
 * server can reach the internet — use the "test connection" action to
 * confirm. Nothing here fabricates a fill.
 *
 * Credentials needed (from your Tradovate API application):
 *   username, password, appId, cid, sec  (+ optional deviceId)
 */

const CRED_SCOPE = "tradovate-credentials";

export type TradovateEnvironment = "demo" | "live";

export interface TradovateCredentials {
  environment: TradovateEnvironment;
  username: string;
  password: string;
  appId: string;
  appVersion: string;
  cid: string;
  sec: string;
  deviceId: string;
}

const REQUIRED: (keyof TradovateCredentials)[] = [
  "username",
  "password",
  "appId",
  "cid",
  "sec",
];

function baseUrl(env: TradovateEnvironment): string {
  return env === "live"
    ? "https://live.tradovateapi.com/v1"
    : "https://demo.tradovateapi.com/v1";
}

async function loadCreds(userId: string): Promise<Partial<TradovateCredentials>> {
  const stored = await readTradingObject<Partial<TradovateCredentials>>(CRED_SCOPE, userId);
  return stored || {};
}

export async function saveTradovateCredentials(
  userId: string,
  patch: Partial<TradovateCredentials>,
): Promise<void> {
  const current = await loadCreds(userId);
  const next: Partial<TradovateCredentials> = { ...current };
  for (const [k, v] of Object.entries(patch)) {
    if (typeof v === "string" && v.trim()) (next as any)[k] = v.trim();
  }
  if (patch.environment === "demo" || patch.environment === "live") next.environment = patch.environment;
  if (!next.appVersion) next.appVersion = "1.0";
  if (!next.deviceId) next.deviceId = `zar-${userId}`.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64);
  await writeTradingObject(CRED_SCOPE, userId, next);
}

function completeness(creds: Partial<TradovateCredentials>): { complete: boolean; missing: string[] } {
  const missing = REQUIRED.filter((k) => !String(creds[k] || "").trim());
  return { complete: missing.length === 0, missing };
}

// In-memory access-token cache per user (tokens are short-lived).
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getAccessToken(
  userId: string,
): Promise<{ token: string; env: TradovateEnvironment } | { error: string }> {
  const creds = await loadCreds(userId);
  const env: TradovateEnvironment = creds.environment === "live" ? "live" : "demo";
  const { complete, missing } = completeness(creds);
  if (!complete) return { error: `Missing Tradovate credentials: ${missing.join(", ")}.` };

  const cached = tokenCache.get(userId);
  if (cached && cached.expiresAt > Date.now() + 30_000) return { token: cached.token, env };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(`${baseUrl(env)}/auth/accessTokenRequest`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: creds.username,
        password: creds.password,
        appId: creds.appId,
        appVersion: creds.appVersion || "1.0",
        cid: creds.cid,
        sec: creds.sec,
        deviceId: creds.deviceId || `zar-${userId}`,
      }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (body?.accessToken) {
      const expiresAt = body.expirationTime ? new Date(body.expirationTime).getTime() : Date.now() + 60 * 60_000;
      tokenCache.set(userId, { token: body.accessToken, expiresAt });
      return { token: body.accessToken, env };
    }
    if (body?.["p-ticket"]) {
      return { error: "Tradovate returned a captcha/penalty challenge — wait and try again." };
    }
    return { error: body?.errorText || `Auth failed (HTTP ${res.status}).` };
  } catch (err: any) {
    return { error: `Could not reach Tradovate: ${err?.message || "request failed"}.` };
  } finally {
    clearTimeout(timer);
  }
}

async function authed<T>(
  userId: string,
  path: string,
  init?: RequestInit,
): Promise<{ data: T } | { error: string }> {
  const auth = await getAccessToken(userId);
  if ("error" in auth) return { error: auth.error };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(`${baseUrl(auth.env)}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.token}`,
        ...(init?.headers || {}),
      },
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data?.errorText || `Tradovate HTTP ${res.status}.` };
    return { data: data as T };
  } catch (err: any) {
    return { error: `Tradovate request failed: ${err?.message || "unknown"}.` };
  } finally {
    clearTimeout(timer);
  }
}

export interface TradovateStatus {
  configured: boolean;
  environment: TradovateEnvironment;
  missing: string[];
  connected: boolean;
  accounts: Array<{ id: number; name: string; type: string }>;
  note: string;
}

export async function getTradovateStatus(userId: string): Promise<TradovateStatus> {
  const creds = await loadCreds(userId);
  const environment: TradovateEnvironment = creds.environment === "live" ? "live" : "demo";
  const { complete, missing } = completeness(creds);
  if (!complete) {
    return {
      configured: false,
      environment,
      missing,
      connected: false,
      accounts: [],
      note: "Add your Tradovate API credentials to connect.",
    };
  }
  const accounts = await authed<any[]>(userId, "/account/list");
  if ("error" in accounts) {
    return { configured: true, environment, missing: [], connected: false, accounts: [], note: accounts.error };
  }
  const list = Array.isArray(accounts.data)
    ? accounts.data.map((a: any) => ({ id: a.id, name: a.name, type: a.accountType || a.legalStatus || "account" }))
    : [];
  return {
    configured: true,
    environment,
    missing: [],
    connected: true,
    accounts: list,
    note: `Connected to Tradovate ${environment}. ${list.length} account(s).`,
  };
}

export interface PlaceOrderInput {
  accountId: number;
  accountSpec: string;
  action: "Buy" | "Sell";
  symbol: string;
  orderQty: number;
  orderType: "Market" | "Limit";
  price?: number;
}

export async function placeTradovateOrder(
  userId: string,
  input: PlaceOrderInput,
): Promise<{ orderId: number } | { error: string }> {
  const payload: Record<string, unknown> = {
    accountId: input.accountId,
    accountSpec: input.accountSpec,
    action: input.action,
    symbol: input.symbol,
    orderQty: input.orderQty,
    orderType: input.orderType,
    isAutomated: true,
  };
  if (input.orderType === "Limit" && typeof input.price === "number") payload.price = input.price;

  const result = await authed<any>(userId, "/order/placeorder", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if ("error" in result) return { error: result.error };
  if (result.data?.orderId) return { orderId: result.data.orderId };
  if (result.data?.failureReason) return { error: `${result.data.failureReason}: ${result.data.failureText || ""}`.trim() };
  return { error: "Tradovate did not return an order id." };
}

/** Credential presence for other engines (broker-connected checks). */
export async function tradovateConfigured(userId: string): Promise<{ configured: boolean; environment: TradovateEnvironment }> {
  const creds = await loadCreds(userId);
  const environment: TradovateEnvironment = creds.environment === "live" ? "live" : "demo";
  return { configured: completeness(creds).complete, environment };
}
