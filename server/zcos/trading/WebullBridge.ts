import type { IntegrationProvider } from "../../../shared/trading-training-types";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

import type { TradingAssetClass, TradeDirection } from "../../../shared/trading-types";
import type { ExecutionAccountSummary, ExecutionAdapterStatus } from "./ExecutionAdapterTypes";
import { averageTrueRange, type MarketBar, type MarketQuote } from "./MarketDataService";
import { computeSignal } from "./TechnicalIndicators";
import { TradingIntegrationsStore } from "./TradingIntegrationsStore";

const PROVIDER: IntegrationProvider = "webull";
const DEFAULT_SANDBOX_ENDPOINT = "api.sandbox.webull.com";
const DEFAULT_PRODUCTION_ENDPOINT = "api.webull.com";
const WEBULL_SDK_ACCOUNT_LIST = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../scripts/webull_sdk_account_list.py",
);
const WEBULL_SDK_QUOTE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../scripts/webull_sdk_quote.py",
);

const WEBULL_SCAN_UNIVERSE: Record<TradingAssetClass, string[]> = {
  stock: ["AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "TSLA", "AMD"],
  etf: ["SPY", "QQQ", "IWM", "DIA"],
  option: ["SPY", "QQQ", "AAPL", "NVDA"],
  future: ["ES", "NQ", "YM", "CL", "GC"],
  crypto: ["BTCUSD", "ETHUSD", "SOLUSD"],
  forex: [],
};

type WebullCredentialCandidate = {
  source: "Render env" | "saved UI";
  appKey: string;
  appSecret: string;
  endpoint: string;
  mode: ExecutionAdapterStatus["mode"];
};

function defaultPythonBin(): string {
  return process.platform === "win32" ? "python" : "python3";
}

function parseHelperJson(stdout: string): any {
  const trimmed = stdout.trim();
  if (!trimmed) throw new Error("empty stdout");
  try {
    return JSON.parse(trimmed);
  } catch {
    const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const line = lines[i];
      if (!line.startsWith("{") || !line.endsWith("}")) continue;
      try {
        return JSON.parse(line);
      } catch {
        // Keep scanning earlier lines.
      }
    }
    throw new Error("no JSON object found in helper stdout");
  }
}

function explainWebullAuthFailure(message: string, endpoint: string): string {
  if (!/x-signature is invalid|unauthorized|401/i.test(message)) return message;
  const environment = /sandbox/i.test(endpoint) ? "sandbox" : "production";
  return [
    `Webull rejected the signed ${environment} request: ${message}`,
    "Most likely cause: the App Key and App Secret do not belong to the same Webull OpenAPI app, or the key pair is for the other environment.",
    "Zed tests each credential pair against sandbox and production before giving up.",
  ].join(" ");
}

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

function resolvedSecretValue(
  record: Awaited<ReturnType<typeof TradingIntegrationsStore.getConnection>>,
  key: string,
  envKey: string,
): string {
  return envValue(envKey) || value(record, key);
}

function webullCredentialCandidates(
  record: Awaited<ReturnType<typeof TradingIntegrationsStore.getConnection>>,
): WebullCredentialCandidate[] {
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
  const credentials = webullCredentialCandidates(connection);
  const activeCredentials = credentials[0];
  const appKey = activeCredentials?.appKey || "";
  const appSecret = activeCredentials?.appSecret || "";
  const accessToken = resolvedValue(connection, "accessToken", "WEBULL_ACCESS_TOKEN");
  const endpoint = activeCredentials?.endpoint || endpointFor(resolvedValue(connection, "endpoint", "WEBULL_API_ENDPOINT"), environmentMode(resolvedValue(connection, "environment", "WEBULL_ENVIRONMENT")));
  const accountId = resolvedValue(connection, "accountId", "WEBULL_ACCOUNT_ID");
  const mode = activeCredentials?.mode || environmentMode(resolvedValue(connection, "environment", "WEBULL_ENVIRONMENT"));
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
      accessToken: Boolean(accessToken),
      endpoint: effectiveEndpoint,
      accountId: accountId || undefined,
      environment: mode,
      credentialSource: activeCredentials?.source,
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
  const existing = await TradingIntegrationsStore.getConnection(userId, PROVIDER);
  const existingAppKey = resolvedSecretValue(existing, "appKey", "WEBULL_APP_KEY");
  const nextAppKey = String(input.appKey || "").trim();
  const nextSecret = String(input.appSecret || "").trim();
  if (nextAppKey && existingAppKey && nextAppKey !== existingAppKey && !nextSecret) {
    throw new Error(
      "Webull App Key changed, but no matching App Secret was entered. Re-enter the App Secret for this App Key, then save again.",
    );
  }
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

async function runWebullSdkAccountList(input: {
  appKey: string;
  appSecret: string;
  endpoint: string;
}): Promise<{
  ok: boolean;
  statusCode?: number;
  accounts: ExecutionAccountSummary[];
  message: string;
}> {
  const python = envValue("WEBULL_PYTHON_BIN") || defaultPythonBin();
  return new Promise((resolve) => {
    const child = spawn(python, [WEBULL_SDK_ACCOUNT_LIST], {
      env: {
        ...process.env,
        WEBULL_APP_KEY: input.appKey,
        WEBULL_APP_SECRET: input.appSecret,
        WEBULL_API_ENDPOINT: input.endpoint,
        WEBULL_REGION: "us",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve({
        ok: false,
        accounts: [],
        message:
          "Webull SDK account-list test timed out after 20 seconds. This follows Webull's official SDK flow; check host network access to Webull.",
      });
    }, 20000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        accounts: [],
        message: `Could not start Python for Webull's official SDK flow. Set WEBULL_PYTHON_BIN to Python 3.8-3.13 with webull-openapi-python-sdk installed. ${err.message}`,
      });
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        const parsed = parseHelperJson(stdout);
        const accounts: ExecutionAccountSummary[] = Array.isArray(parsed.accounts)
          ? parsed.accounts.map((account: any, index: number) => ({
              id: String(account.id || account.account_id || account.accountId || `account-${index + 1}`),
              label: String(account.label || account.account_type || account.accountType || account.type || "Webull account"),
              type: String(account.type || account.account_type || account.accountType || "unknown"),
              raw: account.raw ?? account,
            }))
          : [];
        resolve({
          ok: Boolean(parsed.ok),
          statusCode: parsed.statusCode,
          accounts,
          message:
            parsed.message ||
            (parsed.ok
              ? `Webull SDK account-list test succeeded (${accounts.length} account${accounts.length === 1 ? "" : "s"} returned).`
              : `Webull SDK account-list test failed.${stderr ? ` ${stderr.slice(0, 240)}` : ""}`),
        });
      } catch {
        resolve({
          ok: false,
          accounts: [],
          message: `Webull SDK account-list test did not return valid JSON. stdout=${stdout.slice(0, 180)} stderr=${stderr.slice(0, 180)}`,
        });
      }
    });
  });
}

async function runWebullSdkQuote(input: {
  appKey: string;
  appSecret: string;
  endpoint: string;
  symbol: string;
  asset: TradingAssetClass;
}): Promise<{ ok: boolean; quote?: MarketQuote; message: string }> {
  const python = envValue("WEBULL_PYTHON_BIN") || defaultPythonBin();
  return new Promise((resolve) => {
    const child = spawn(python, [WEBULL_SDK_QUOTE], {
      env: {
        ...process.env,
        WEBULL_APP_KEY: input.appKey,
        WEBULL_APP_SECRET: input.appSecret,
        WEBULL_API_ENDPOINT: input.endpoint,
        WEBULL_REGION: "us",
        WEBULL_SYMBOL: input.symbol,
        WEBULL_ASSET: input.asset,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve({
        ok: false,
        message: `Webull SDK quote request timed out for ${input.symbol}.`,
      });
    }, 20000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        message: `Could not start Python for Webull market data. Set WEBULL_PYTHON_BIN to Python 3.8-3.13 with webull-openapi-python-sdk installed. ${err.message}`,
      });
    });
    child.on("close", () => {
      clearTimeout(timer);
      try {
        const parsed = parseHelperJson(stdout);
        const rawQuote = parsed.quote || null;
        const bars: MarketBar[] = Array.isArray(rawQuote?.bars)
          ? rawQuote.bars
              .map((bar: any) => ({
                o: Number(bar.o),
                h: Number(bar.h),
                l: Number(bar.l),
                c: Number(bar.c),
              }))
              .filter((bar: MarketBar) => bar.o > 0 && bar.h > 0 && bar.l > 0 && bar.c > 0)
          : [];
        const price = Number(rawQuote?.price);
        if (!parsed.ok || !(price > 0)) {
          resolve({
            ok: false,
            message: parsed.message || `Webull returned no usable quote for ${input.symbol}.${stderr ? ` ${stderr.slice(0, 180)}` : ""}`,
          });
          return;
        }
        resolve({
          ok: true,
          quote: {
            symbol: String(rawQuote.symbol || input.symbol).toUpperCase(),
            price: Math.round(price * 100) / 100,
            asOf: rawQuote.asOf || new Date().toISOString(),
            source: "Webull OpenAPI",
            atr: averageTrueRange(bars),
            bars,
            signal: computeSignal(bars) ?? undefined,
          },
          message: "Webull quote received.",
        });
      } catch {
        resolve({
          ok: false,
          message: `Webull SDK quote did not return valid JSON. stdout=${stdout.slice(0, 180)} stderr=${stderr.slice(0, 180)}`,
        });
      }
    });
  });
}

export async function getWebullMarketQuote(
  userId: string,
  symbol: string,
  asset: TradingAssetClass = "stock",
): Promise<MarketQuote | null> {
  const connection = await TradingIntegrationsStore.getConnection(userId, PROVIDER);
  const credentials = webullCredentialCandidates(connection);
  if (!credentials.length) {
    throw new Error("Webull market data requires WEBULL_APP_KEY and WEBULL_APP_SECRET.");
  }
  const failures: string[] = [];
  for (const candidate of credentials) {
    const result = await runWebullSdkQuote({
      appKey: candidate.appKey,
      appSecret: candidate.appSecret,
      endpoint: candidate.endpoint,
      symbol: symbol.trim().toUpperCase(),
      asset,
    });
    if (result.ok && result.quote) return result.quote;
    failures.push(`${candidate.source}: ${explainWebullAuthFailure(result.message, candidate.endpoint)}`);
  }
  throw new Error(`Webull market data failed for every credential source. ${failures.join(" ")}`);
}

function webullScoreQuote(quote: MarketQuote): { score: number; direction: TradeDirection } | null {
  if (quote.signal && quote.signal.signal !== "neutral") {
    return {
      score: 100 + quote.signal.strength,
      direction: quote.signal.signal === "buy" ? "long" : "short",
    };
  }
  const closes = (quote.bars || []).map((bar) => bar.c).filter((close) => Number.isFinite(close) && close > 0);
  if (closes.length < 10) return null;
  const last = closes[closes.length - 1];
  const ref = closes[closes.length - 10];
  if (!(ref > 0)) return null;
  const momentum = (last - ref) / ref;
  return {
    score: Math.abs(momentum),
    direction: momentum >= 0 ? "long" : "short",
  };
}

export async function recommendWebullSymbol(
  userId: string,
  asset: TradingAssetClass,
  _market = "US",
  opts: { avoidSymbols?: string[]; preferDirection?: TradeDirection | "auto" } = {},
): Promise<{ symbol: string; direction: TradeDirection; reason: string; quote: MarketQuote } | null> {
  const universe = WEBULL_SCAN_UNIVERSE[asset] || WEBULL_SCAN_UNIVERSE.stock;
  if (!universe.length) return null;
  const avoid = new Set((opts.avoidSymbols || []).map((symbol) => symbol.toUpperCase()));
  const scored: Array<{ symbol: string; direction: TradeDirection; score: number; quote: MarketQuote }> = [];
  for (const symbol of universe) {
    if (avoid.has(symbol.toUpperCase())) continue;
    try {
      const quote = await getWebullMarketQuote(userId, symbol, asset);
      if (!quote) continue;
      const scoredQuote = webullScoreQuote(quote);
      if (!scoredQuote) continue;
      let score = scoredQuote.score;
      if (opts.preferDirection && opts.preferDirection !== "auto" && scoredQuote.direction !== opts.preferDirection) {
        score *= 0.82;
      }
      scored.push({ symbol: quote.symbol || symbol, direction: scoredQuote.direction, score, quote });
    } catch {
      // Skip symbols Webull does not return. A total miss is handled below.
    }
  }
  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  const signal = top.quote.signal;
  return {
    symbol: top.symbol,
    direction: top.direction,
    quote: top.quote,
    reason: signal
      ? `ZAR scanned ${scored.length} Webull ${asset} symbol(s) and picked ${top.symbol}: ${signal.signal.toUpperCase()} signal with ${signal.strength}% conviction.`
      : `ZAR scanned ${scored.length} Webull ${asset} symbol(s) and picked ${top.symbol}: strongest Webull momentum from available bars.`,
  };
}

export async function testWebullConnection(userId: string): Promise<{
  ok: boolean;
  statusCode?: number;
  endpoint?: string;
  accountCount?: number;
  selectedAccountId?: string;
  accounts: ExecutionAccountSummary[];
  message: string;
}> {
  const connection = await TradingIntegrationsStore.getConnection(userId, PROVIDER);
  const credentials = webullCredentialCandidates(connection);
  const fallbackMode = environmentMode(resolvedValue(connection, "environment", "WEBULL_ENVIRONMENT"));
  const fallbackEndpoint = endpointFor(resolvedValue(connection, "endpoint", "WEBULL_API_ENDPOINT"), fallbackMode);
  const savedAccountId = resolvedValue(connection, "accountId", "WEBULL_ACCOUNT_ID");
  if (!credentials.length) {
    return {
      ok: false,
      endpoint: fallbackEndpoint,
      accounts: [],
      message: "Missing WEBULL_APP_KEY or WEBULL_APP_SECRET on the server, and no saved Webull credentials exist.",
    };
  }

  const failures: string[] = [];
  for (const candidate of credentials) {
    const result = await runWebullSdkAccountList({
      appKey: candidate.appKey,
      appSecret: candidate.appSecret,
      endpoint: candidate.endpoint,
    });
    const selectedAccountId = savedAccountId || result.accounts[0]?.id;
    if (result.ok) {
      if (selectedAccountId && !savedAccountId) {
        await TradingIntegrationsStore.connect({
          userId,
          provider: PROVIDER,
          fields: {
            accountId: selectedAccountId,
            endpoint: candidate.endpoint,
            environment: candidate.mode,
          },
        });
      }
      return {
        ...result,
        endpoint: candidate.endpoint,
        accountCount: result.accounts.length,
        selectedAccountId,
        message: selectedAccountId
          ? `Webull SDK account-list test succeeded using ${candidate.source} on ${candidate.endpoint}. Paper account ${selectedAccountId} is selected.`
          : `Webull SDK account-list test succeeded using ${candidate.source} on ${candidate.endpoint}, but Webull returned no accounts. Add the paper account ID manually.`,
      };
    }
    failures.push(`${candidate.source} on ${candidate.endpoint}: ${explainWebullAuthFailure(result.message, candidate.endpoint)}`);
  }
  return {
    ok: false,
    endpoint: fallbackEndpoint,
    accountCount: 0,
    accounts: [],
    message: `Webull account-list test failed for every credential source. ${failures.join(" ")}`,
  };
}
