import type { IntegrationProvider } from "../../../shared/trading-training-types";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

import type { ExecutionAccountSummary, ExecutionAdapterStatus } from "./ExecutionAdapterTypes";
import { TradingIntegrationsStore } from "./TradingIntegrationsStore";

const PROVIDER: IntegrationProvider = "webull";
const DEFAULT_SANDBOX_ENDPOINT = "api.sandbox.webull.com";
const DEFAULT_PRODUCTION_ENDPOINT = "api.webull.com";
const WEBULL_SDK_PROBE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../scripts/webull_sdk_account_list.py",
);

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
  const accessToken = resolvedValue(connection, "accessToken", "WEBULL_ACCESS_TOKEN");
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
      accessToken: Boolean(accessToken),
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
  const existing = await TradingIntegrationsStore.getConnection(userId, PROVIDER);
  const existingAppKey = resolvedValue(existing, "appKey", "WEBULL_APP_KEY");
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
  const python = envValue("WEBULL_PYTHON_BIN") || "python";
  return new Promise((resolve) => {
    const child = spawn(python, [WEBULL_SDK_PROBE], {
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
        const parsed = JSON.parse(stdout.trim());
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
  const appKey = resolvedValue(connection, "appKey", "WEBULL_APP_KEY");
  const appSecret = resolvedValue(connection, "appSecret", "WEBULL_APP_SECRET");
  const mode = environmentMode(resolvedValue(connection, "environment", "WEBULL_ENVIRONMENT"));
  const endpoint = endpointFor(resolvedValue(connection, "endpoint", "WEBULL_API_ENDPOINT"), mode);
  const savedAccountId = resolvedValue(connection, "accountId", "WEBULL_ACCOUNT_ID");
  if (!appKey || !appSecret) {
    return {
      ok: false,
      endpoint,
      accounts: [],
      message: "Missing WEBULL_APP_KEY or WEBULL_APP_SECRET on the server, and no saved Webull credentials exist.",
    };
  }

  const result = await runWebullSdkAccountList({ appKey, appSecret, endpoint });
  const selectedAccountId = savedAccountId || result.accounts[0]?.id;
  if (result.ok && selectedAccountId && !savedAccountId) {
    await TradingIntegrationsStore.connect({
      userId,
      provider: PROVIDER,
      fields: {
        accountId: selectedAccountId,
        endpoint,
        environment: mode,
      },
    });
  }
  return {
    ...result,
    endpoint,
    accountCount: result.accounts.length,
    selectedAccountId,
    message: result.ok
      ? selectedAccountId
        ? `Webull SDK account-list test succeeded. Paper account ${selectedAccountId} is selected.`
        : "Webull SDK account-list test succeeded, but Webull returned no accounts. Add the paper account ID manually."
      : result.message,
  };
}
