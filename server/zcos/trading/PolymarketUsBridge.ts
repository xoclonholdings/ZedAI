import type { IntegrationProvider } from "../../../shared/trading-training-types";

import type { ExecutionAdapterStatus } from "./ExecutionAdapterTypes";
import { TradingIntegrationsStore } from "./TradingIntegrationsStore";

const PROVIDER: IntegrationProvider = "polymarket";
const PUBLIC_BASE = "https://gateway.polymarket.us";

function value(record: Awaited<ReturnType<typeof TradingIntegrationsStore.getConnection>>, key: string): string {
  return String(record?.fields?.[key] || record?.secrets?.[key] || "").trim();
}

async function fetchJson(url: string): Promise<any | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getPolymarketUsStatus(userId: string): Promise<ExecutionAdapterStatus> {
  const connection = await TradingIntegrationsStore.getConnection(userId, PROVIDER);
  const keyId = value(connection, "keyId");
  const secretKey = value(connection, "secretKey");
  const missing = [
    !keyId ? "Key ID" : "",
    !secretKey ? "Secret key" : "",
  ].filter(Boolean);
  const configured = missing.length === 0;

  return {
    provider: PROVIDER,
    label: "Polymarket US",
    configured,
    connected: configured,
    status: configured ? "configured" : "disconnected",
    mode: "production",
    missing,
    capabilities: {
      assets: ["event_contract"],
      readAccounts: configured,
      readPositions: configured,
      placeOrders: false,
      streamOrders: false,
    },
    accounts: configured ? [{ id: keyId, label: "Polymarket US API key", type: "event_contracts" }] : [],
    note: configured
      ? "Polymarket US API keys are saved. Order routing remains disabled until approval wiring is added."
      : "Add Polymarket US API keys to enable account, balance, and position reads.",
  };
}

export async function searchPolymarketUsMarkets(query: string): Promise<{
  live: boolean;
  markets: Array<{ id: string; slug: string; title: string; active: boolean; closed: boolean }>;
  note: string;
}> {
  const q = String(query || "").trim();
  const url = q
    ? `${PUBLIC_BASE}/markets?active=true&closed=false&limit=10&search=${encodeURIComponent(q)}`
    : `${PUBLIC_BASE}/markets?active=true&closed=false&limit=10`;
  const data = await fetchJson(url);
  const raw = Array.isArray(data) ? data : Array.isArray(data?.markets) ? data.markets : [];
  const markets = raw.slice(0, 10).map((market: any) => ({
    id: String(market.id || market.marketId || ""),
    slug: String(market.slug || market.marketSlug || ""),
    title: String(market.title || market.question || market.name || "Untitled market"),
    active: market.active !== false,
    closed: Boolean(market.closed),
  }));
  return {
    live: Boolean(data),
    markets,
    note: data ? `Found ${markets.length} Polymarket US market(s).` : "Could not reach Polymarket US public market data.",
  };
}

