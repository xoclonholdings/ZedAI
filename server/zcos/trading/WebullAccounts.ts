import type { ExecutionAccountSummary } from "./ExecutionAdapterTypes";
import { TradingIntegrationsStore } from "./TradingIntegrationsStore";
import { getWebullStatus } from "./WebullAuth";
import {
  WEBULL_PROVIDER,
  explainWebullAuthFailure,
  getWebullConnection,
  webullCredentialCandidates,
  webullFetch,
  type WebullCredentialCandidate,
} from "./WebullShared";

/** GET /openapi/account/list (v2) — confirmed against the SDK's own request class. */
const ACCOUNT_LIST_PATH = "/openapi/account/list";

function parseAccounts(data: any): ExecutionAccountSummary[] {
  const raw = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
  return raw.map((a: any, i: number) => ({
    id: String(a?.account_id ?? a?.accountId ?? a?.id ?? `account-${i + 1}`),
    label: String(a?.account_type ?? a?.accountType ?? a?.type ?? "Webull account"),
    type: String(a?.account_type ?? a?.accountType ?? a?.type ?? "unknown"),
    raw: a,
  }));
}

async function fetchAccountList(
  candidate: WebullCredentialCandidate,
): Promise<{ ok: boolean; accounts: ExecutionAccountSummary[]; message: string }> {
  const result = await webullFetch({
    host: candidate.endpoint,
    path: ACCOUNT_LIST_PATH,
    appKey: candidate.appKey,
    appSecret: candidate.appSecret,
  });
  if (result.error) {
    return { ok: false, accounts: [], message: `Could not reach ${candidate.endpoint}: ${result.error}` };
  }
  if (!result.ok) {
    return {
      ok: false,
      accounts: [],
      message: explainWebullAuthFailure(
        `HTTP ${result.status}: ${result.text.slice(0, 300)}`,
        candidate.endpoint,
      ),
    };
  }
  const accounts = parseAccounts(result.data);
  return {
    ok: true,
    accounts,
    message: `${accounts.length} account(s) returned from ${candidate.endpoint}.`,
  };
}

/**
 * Test the Webull connection: try every credential/endpoint candidate,
 * reconcile the saved account id against Webull's live list (a saved id
 * is kept only if Webull still returns it; otherwise the first live
 * account is adopted), and persist the resolved account.
 */
export async function testWebullConnection(userId: string): Promise<{
  ok: boolean;
  endpoint?: string;
  accountCount?: number;
  selectedAccountId?: string;
  accounts: ExecutionAccountSummary[];
  message: string;
}> {
  const connection = await getWebullConnection(userId);
  const credentials = webullCredentialCandidates(connection);
  if (!credentials.length) {
    return {
      ok: false,
      accounts: [],
      message: "Missing WEBULL_APP_KEY or WEBULL_APP_SECRET on the server, and no saved Webull credentials exist.",
    };
  }

  const savedAccountId = connection?.fields?.accountId || "";
  const failures: string[] = [];
  for (const candidate of credentials) {
    const result = await fetchAccountList(candidate);
    if (!result.ok) {
      failures.push(`${candidate.source} on ${candidate.endpoint}: ${result.message}`);
      continue;
    }
    const liveIds = result.accounts.map((account) => account.id);
    const selectedAccountId =
      savedAccountId && liveIds.includes(savedAccountId) ? savedAccountId : result.accounts[0]?.id;

    // Always record which credential source and endpoint just verified —
    // not only when the account id changes. getWebullStatus/placeWebullOrder
    // prefer this over always defaulting to the env-var candidate, so a
    // stale/mismatched Render-level key pair can't keep silently signing
    // real requests after the user's own saved credentials are confirmed
    // working here.
    const fieldsToSave: Record<string, string> = {
      endpoint: candidate.endpoint,
      environment: candidate.mode,
      credentialSource: candidate.source,
    };
    if (selectedAccountId && selectedAccountId !== savedAccountId) {
      fieldsToSave.accountId = selectedAccountId;
    }
    const changed =
      connection?.fields?.endpoint !== fieldsToSave.endpoint ||
      connection?.fields?.environment !== fieldsToSave.environment ||
      connection?.fields?.credentialSource !== fieldsToSave.credentialSource ||
      Boolean(fieldsToSave.accountId);
    if (changed) {
      await TradingIntegrationsStore.connect({ userId, provider: WEBULL_PROVIDER, fields: fieldsToSave });
    }
    return {
      ok: true,
      endpoint: candidate.endpoint,
      accountCount: result.accounts.length,
      selectedAccountId,
      accounts: result.accounts,
      message: selectedAccountId
        ? `Webull account-list succeeded using ${candidate.source} on ${candidate.endpoint}. Account ${selectedAccountId} is selected.`
        : `Webull account-list succeeded using ${candidate.source} on ${candidate.endpoint}, but Webull returned no accounts. Add the paper account ID manually.`,
    };
  }
  return {
    ok: false,
    accountCount: 0,
    accounts: [],
    message: `Webull account-list failed for every credential source. ${failures.join(" | ")}`,
  };
}

/** Live accounts Webull actually reports (not a cached/saved value). */
export async function listWebullAccounts(userId: string): Promise<{
  connected: boolean;
  accounts: ExecutionAccountSummary[];
  note: string;
}> {
  const connection = await getWebullConnection(userId);
  const credentials = webullCredentialCandidates(connection);
  for (const candidate of credentials) {
    const result = await fetchAccountList(candidate);
    if (result.ok) {
      return { connected: true, accounts: result.accounts, note: result.message };
    }
  }
  const status = await getWebullStatus(userId);
  return { connected: status.connected, accounts: status.accounts, note: status.note };
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
      ? "Webull position sync is reserved for a future build."
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
      ? "Webull order-history sync is reserved for a future build."
      : status.note,
  };
}
