import type { IntegrationProvider, IntegrationStatus } from "../../../shared/trading-training-types";

export type ExecutionAssetRail = "stock" | "option" | "future" | "crypto" | "event_contract";

export interface ExecutionAccountSummary {
  id: string;
  label: string;
  type: string;
  currency?: string;
  raw?: unknown;
}

export interface ExecutionAdapterStatus {
  provider: IntegrationProvider;
  label: string;
  configured: boolean;
  connected: boolean;
  status: IntegrationStatus;
  mode: "sandbox" | "production" | "unknown";
  missing: string[];
  capabilities: {
    assets: ExecutionAssetRail[];
    readAccounts: boolean;
    readPositions: boolean;
    placeOrders: boolean;
    streamOrders: boolean;
  };
  accounts: ExecutionAccountSummary[];
  note: string;
  saved?: {
    appKey?: boolean;
    appKeyLast4?: string;
    appSecret?: boolean;
    accessToken?: boolean;
    endpoint?: string;
    accountId?: string;
    environment?: string;
    credentialSource?: string;
  };
}
