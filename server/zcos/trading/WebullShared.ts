import type { IntegrationProvider } from "../../../shared/trading-training-types";
import type { ExecutionAdapterStatus } from "./ExecutionAdapterTypes";
import { TradingIntegrationsStore } from "./TradingIntegrationsStore";
import { webullSign } from "./WebullSigner";

/**
 * Shared credential/endpoint resolution for the Webull integration.
 * Every Webull call (accounts, market data, orders) signs with the same
 * app key/secret against the same host, so this is the one place that
 * decides which credentials and host a request uses.
 */

export const WEBULL_PROVIDER: IntegrationProvider = "webull";
export const DEFAULT_SANDBOX_ENDPOINT = "api.sandbox.webull.com";
export const DEFAULT_PRODUCTION_ENDPOINT = "api.webull.com";

export type WebullConnection = Awaited<ReturnType<typeof TradingIntegrationsStore.getConnection>>;

export type WebullCredentialCandidate = {
  source: "Render env" | "saved UI";
  appKey: string;
  appSecret: string;
  endpoint: string;
  mode: ExecutionAdapterStatus["mode"];
};

/**
 * Webull serves market data from a dedicated data host, separate from the
 * trading host (per the SDK's regional endpoint map: api / quotes-api /
 * events-api each resolve to a different host). There is no sandbox data
 * host — market data is always production.
 */
export function webullDataHost(region: string): string {
  const map: Record<string, string> = {
    us: "data-api.webull.com",
    hk: "data-api.webull.hk",
    jp: "data-api.webull.co.jp",
    sg: "data-api.webull.com.sg",
  };
  return map[region.toLowerCase()] || "data-api.webull.com";
}

export function explainWebullAuthFailure(message: string, endpoint: string): string {
  if (!/x-signature is invalid|unauthorized|401/i.test(message)) return message;
  const environment = /sandbox/i.test(endpoint) ? "sandbox" : "production";
  return [
    `Webull rejected the signed ${environment} request: ${message}`,
    "Most likely cause: the App Key and App Secret do not belong to the same Webull OpenAPI app, or the key pair is for the other environment.",
    "ZAR tests each credential pair against sandbox and production before giving up.",
  ].join(" ");
}

function value(record: WebullConnection, key: string): string {
  return String(record?.fields?.[key] || record?.secrets?.[key] || "").trim();
}

export function envValue(key: string): string {
  return String(process.env[key] || "").trim();
}

export function resolvedValue(record: WebullConnection, key: string, envKey: string): string {
  return value(record, key) || envValue(envKey);
}

export function resolvedSecretValue(record: WebullConnection, key: string, envKey: string): string {
  return envValue(envKey) || value(record, key);
}

export function environmentMode(raw: string): ExecutionAdapterStatus["mode"] {
  const clean = raw.toLowerCase();
  if (clean === "production" || clean === "live") return "production";
  if (clean === "sandbox" || clean === "test" || clean === "paper") return "sandbox";
  return "sandbox";
}

export function endpointFor(rawEndpoint: string, mode: ExecutionAdapterStatus["mode"]): string {
  const clean = rawEndpoint.replace(/^https?:\/\//, "").replace(/\/+$/, "").trim();
  if (clean) return clean;
  return mode === "production" ? DEFAULT_PRODUCTION_ENDPOINT : DEFAULT_SANDBOX_ENDPOINT;
}

/**
 * Every credential source (Render env, saved-in-UI) crossed with every
 * plausible endpoint (the configured one, plus both known defaults) —
 * tried in order until one signs successfully. This is what let a wrong
 * sandbox/production pairing surface a clear error instead of a silent
 * hang.
 */
export function webullCredentialCandidates(record: WebullConnection): WebullCredentialCandidate[] {
  const mode = environmentMode(resolvedValue(record, "environment", "WEBULL_ENVIRONMENT"));
  const configuredEndpoint = endpointFor(resolvedValue(record, "endpoint", "WEBULL_API_ENDPOINT"), mode);
  const endpoints: Array<{ endpoint: string; mode: ExecutionAdapterStatus["mode"] }> = [];
  const addEndpoint = (endpoint: string, endpointMode: ExecutionAdapterStatus["mode"]) => {
    const clean = endpointFor(endpoint, endpointMode);
    if (endpoints.some((entry) => entry.endpoint === clean)) return;
    endpoints.push({ endpoint: clean, mode: endpointMode });
  };
  addEndpoint(configuredEndpoint, mode);
  addEndpoint(DEFAULT_SANDBOX_ENDPOINT, "sandbox");
  addEndpoint(DEFAULT_PRODUCTION_ENDPOINT, "production");

  const candidates: WebullCredentialCandidate[] = [];
  const seen = new Set<string>();
  const add = (source: WebullCredentialCandidate["source"], appKey: string, appSecret: string) => {
    if (!appKey || !appSecret) return;
    for (const endpointCandidate of endpoints) {
      const signature = `${appKey}\n${appSecret}\n${endpointCandidate.endpoint}`;
      if (seen.has(signature)) continue;
      seen.add(signature);
      candidates.push({
        source,
        appKey,
        appSecret,
        endpoint: endpointCandidate.endpoint,
        mode: endpointCandidate.mode,
      });
    }
  };
  add("Render env", envValue("WEBULL_APP_KEY"), envValue("WEBULL_APP_SECRET"));
  add("saved UI", value(record, "appKey"), value(record, "appSecret"));
  return candidates;
}

/**
 * Which candidate to actually use for a live request (status display,
 * order signing) — not just `candidates[0]`.
 *
 * `webullCredentialCandidates` always sorts "Render env" first. That's
 * fine for a connection *test*, which tries every candidate and falls
 * back on failure — but `getWebullStatus` and `placeWebullOrder` don't
 * loop; they need one answer. Always taking the first (env) candidate
 * meant a stale or mismatched Render-level WEBULL_APP_KEY/SECRET could
 * keep silently being used to sign real orders even after the user's own
 * saved credentials were confirmed working by a real test — "Test" says
 * connected, but every order still fails, because the two paths were
 * using different key pairs. `testWebullConnection` persists which
 * source last verified successfully (`credentialSource`); prefer that
 * one here so status and signing agree with the last real test.
 */
export function resolveActiveWebullCredential(record: WebullConnection): WebullCredentialCandidate | undefined {
  const candidates = webullCredentialCandidates(record);
  if (!candidates.length) return undefined;
  const preferredSource = value(record, "credentialSource") as WebullCredentialCandidate["source"] | "";
  if (preferredSource) {
    const preferredEndpoint = value(record, "endpoint");
    const exact = candidates.find(
      (c) => c.source === preferredSource && (!preferredEndpoint || c.endpoint === preferredEndpoint),
    );
    if (exact) return exact;
    const bySource = candidates.find((c) => c.source === preferredSource);
    if (bySource) return bySource;
  }
  return candidates[0];
}

export async function getWebullConnection(userId: string): Promise<WebullConnection> {
  return TradingIntegrationsStore.getConnection(userId, WEBULL_PROVIDER);
}

export interface WebullFetchResult {
  ok: boolean;
  status?: number;
  data: any;
  text: string;
  error?: string;
}

/**
 * Sign and issue one Webull request natively (HMAC-SHA1 per Webull's
 * documented algorithm — see WebullSigner). Replaces the old
 * Python-subprocess SDK call: same host/path/credentials, no external
 * process, no interpreter-version constraint.
 */
export async function webullFetch(input: {
  host: string;
  path: string;
  method?: "GET" | "POST";
  appKey: string;
  appSecret: string;
  query?: Record<string, string | string[]>;
  body?: unknown;
  extraHeaders?: Record<string, string>;
  timeoutMs?: number;
}): Promise<WebullFetchResult> {
  const method = input.method || "GET";
  const bodyString = input.body !== undefined ? JSON.stringify(input.body) : undefined;
  const { headers } = webullSign({
    path: input.path,
    host: input.host,
    appKey: input.appKey,
    appSecret: input.appSecret,
    query: input.query,
    bodyString,
  });
  const url = new URL(`https://${input.host}${input.path}`);
  if (input.query) {
    for (const [key, val] of Object.entries(input.query)) {
      url.searchParams.set(key, Array.isArray(val) ? val.join(",") : val);
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 12_000);
  try {
    const res = await fetch(url.toString(), {
      method,
      headers: {
        ...headers,
        ...(bodyString ? { "Content-Type": "application/json" } : {}),
        ...(input.extraHeaders || {}),
      },
      body: bodyString,
      signal: controller.signal,
    });
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      /* leave null — caller decides how to handle non-JSON */
    }
    return { ok: res.ok, status: res.status, data, text };
  } catch (err: any) {
    return { ok: false, data: null, text: "", error: err?.message || "request failed" };
  } finally {
    clearTimeout(timer);
  }
}
