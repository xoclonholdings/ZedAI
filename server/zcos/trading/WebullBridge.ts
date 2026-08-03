/**
 * Webull integration — barrel re-export.
 *
 * The implementation is split by concern:
 *   WebullShared.ts      — credential/endpoint resolution, signed fetch
 *   WebullAuth.ts         — connection status, save credentials
 *   WebullAccounts.ts     — account list, connection test
 *   WebullMarketData.ts   — quotes, bars, symbol recommendation
 *   WebullOrders.ts        — order placement
 *
 * All signing is native (WebullSigner — HMAC-SHA1 per Webull's documented
 * algorithm). There is no Python subprocess anywhere in this path.
 */

export { getWebullStatus, saveWebullCredentials } from "./WebullAuth";
export {
  testWebullConnection,
  listWebullAccounts,
  listWebullPositions,
  listWebullOrders,
} from "./WebullAccounts";
export { getWebullMarketQuote, recommendWebullSymbol } from "./WebullMarketData";
export {
  placeWebullOrder,
  placeWebullPaperOrder,
  placeWebullLiveOrder,
  type WebullOrderInput,
  type WebullOrderResult,
} from "./WebullOrders";
