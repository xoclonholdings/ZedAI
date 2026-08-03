import { readTradingObject, writeTradingObject } from "./tradingPersistence";

/**
 * Durable storage for market-data vendor API keys the user enters in the
 * app, so ZAR's live feed gets more reliable without touching Render env
 * vars. Keys are stored server-side and NEVER returned to the client —
 * the API only exposes whether each key is present.
 *
 * Resolution order used by MarketDataService: a key saved here wins; if
 * none is saved, the matching environment variable is used as a fallback.
 */

const SCOPE = "config";
const KEY = "market-data-keys";

export type MarketDataVendor = "finnhub" | "alphavantage" | "twelvedata";

export interface StoredMarketDataKeys {
  finnhub?: string;
  alphavantage?: string;
  twelvedata?: string;
}

const ENV_VAR: Record<MarketDataVendor, string> = {
  finnhub: "FINNHUB_API_KEY",
  alphavantage: "ALPHAVANTAGE_API_KEY",
  twelvedata: "TWELVEDATA_API_KEY",
};

export const VENDOR_LABELS: Record<MarketDataVendor, string> = {
  finnhub: "Finnhub",
  alphavantage: "Alpha Vantage",
  twelvedata: "Twelve Data",
};

async function readStored(): Promise<StoredMarketDataKeys> {
  const data = await readTradingObject<StoredMarketDataKeys>(SCOPE, KEY);
  return data && typeof data === "object" ? data : {};
}

/** Save keys. Only non-empty values overwrite; blank leaves the key as-is. */
export async function saveMarketDataKeys(input: Partial<StoredMarketDataKeys>): Promise<void> {
  const current = await readStored();
  const next: StoredMarketDataKeys = { ...current };
  for (const vendor of Object.keys(ENV_VAR) as MarketDataVendor[]) {
    const value = input[vendor];
    if (typeof value === "string" && value.trim()) next[vendor] = value.trim();
  }
  await writeTradingObject(SCOPE, KEY, next);
}

/** Clear one vendor's saved key (falls back to env after this). */
export async function clearMarketDataKey(vendor: MarketDataVendor): Promise<void> {
  const current = await readStored();
  delete current[vendor];
  await writeTradingObject(SCOPE, KEY, current);
}

/**
 * Resolve the effective key for a vendor: the saved key first, then the
 * environment variable. Returns undefined when neither is set.
 */
export async function resolveMarketDataKey(vendor: MarketDataVendor): Promise<string | undefined> {
  const stored = await readStored();
  const saved = stored[vendor];
  if (typeof saved === "string" && saved.trim()) return saved.trim();
  const fromEnv = process.env[ENV_VAR[vendor]];
  return fromEnv && fromEnv.trim() ? fromEnv.trim() : undefined;
}

/** Per-vendor status for the UI — whether a key is set and from where. */
export async function marketDataKeyStatus(): Promise<
  Array<{ vendor: MarketDataVendor; label: string; configured: boolean; source: "saved" | "env" | null }>
> {
  const stored = await readStored();
  return (Object.keys(ENV_VAR) as MarketDataVendor[]).map((vendor) => {
    const saved = stored[vendor];
    if (typeof saved === "string" && saved.trim()) {
      return { vendor, label: VENDOR_LABELS[vendor], configured: true, source: "saved" as const };
    }
    const env = process.env[ENV_VAR[vendor]];
    if (env && env.trim()) {
      return { vendor, label: VENDOR_LABELS[vendor], configured: true, source: "env" as const };
    }
    return { vendor, label: VENDOR_LABELS[vendor], configured: false, source: null };
  });
}
