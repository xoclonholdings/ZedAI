import type { ExecutionAdapterStatus } from "./ExecutionAdapterTypes";
import { TradingIntegrationsStore } from "./TradingIntegrationsStore";
import {
  WEBULL_PROVIDER,
  endpointFor,
  environmentMode,
  getWebullConnection,
  resolveActiveWebullCredential,
  resolvedSecretValue,
  resolvedValue,
} from "./WebullShared";

/** Connection status + saved credential summary — never returns secrets. */
export async function getWebullStatus(userId: string): Promise<ExecutionAdapterStatus> {
  const connection = await getWebullConnection(userId);
  const activeCredentials = resolveActiveWebullCredential(connection);
  const appKey = activeCredentials?.appKey || "";
  const appSecret = activeCredentials?.appSecret || "";
  const accessToken = resolvedValue(connection, "accessToken", "WEBULL_ACCESS_TOKEN");
  const endpoint =
    activeCredentials?.endpoint ||
    endpointFor(
      resolvedValue(connection, "endpoint", "WEBULL_API_ENDPOINT"),
      environmentMode(resolvedValue(connection, "environment", "WEBULL_ENVIRONMENT")),
    );
  const accountId = resolvedValue(connection, "accountId", "WEBULL_ACCOUNT_ID");
  const mode =
    activeCredentials?.mode || environmentMode(resolvedValue(connection, "environment", "WEBULL_ENVIRONMENT"));
  const effectiveEndpoint = endpointFor(endpoint, mode);
  const missing = [!appKey ? "App key" : "", !appSecret ? "App secret" : ""].filter(Boolean);

  const configured = missing.length === 0;
  const accounts = accountId
    ? [{ id: accountId, label: `Webull ${mode} account`, type: "default" }]
    : [];

  return {
    provider: WEBULL_PROVIDER,
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
        ? `Webull ${mode} connected. Using the live account ${accountId} returned by Webull. Governed paper order tickets are enabled.`
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
  const existing = await getWebullConnection(userId);
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
    provider: WEBULL_PROVIDER,
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
