import type { IntegrationProvider } from "../../../shared/trading-training-types";

import type { ExecutionAccountSummary, ExecutionAdapterStatus } from "./ExecutionAdapterTypes";
import { TradingIntegrationsStore } from "./TradingIntegrationsStore";

const PROVIDER: IntegrationProvider = "webull";

function value(record: Awaited<ReturnType<typeof TradingIntegrationsStore.getConnection>>, key: string): string {
  return String(record?.fields?.[key] || record?.secrets?.[key] || "").trim();
}

function environmentMode(raw: string): ExecutionAdapterStatus["mode"] {
  const clean = raw.toLowerCase();
  if (clean === "production" || clean === "live") return "production";
  if (clean === "sandbox" || clean === "test" || clean === "paper") return "sandbox";
  return "sandbox";
}

export async function getWebullStatus(userId: string): Promise<ExecutionAdapterStatus> {
  const connection = await TradingIntegrationsStore.getConnection(userId, PROVIDER);
  const appKey = value(connection, "appKey");
  const appSecret = value(connection, "appSecret");
  const endpoint = value(connection, "endpoint");
  const accountId = value(connection, "accountId");
  const mode = environmentMode(value(connection, "environment"));
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
      placeOrders: false,
      streamOrders: false,
    },
    accounts,
    note: configured
      ? accountId
        ? `Webull ${mode} credentials are saved with a default account. Order routing remains disabled until approval wiring is added.`
        : `Webull ${mode} credentials are saved. Add an account ID after retrieving accounts through the SDK/API.`
      : `Add Webull OpenAPI credentials${endpoint ? ` for ${endpoint}` : ""}.`,
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
