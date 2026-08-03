import { randomUUID } from "crypto";

import type { ExecutionAdapterStatus } from "./ExecutionAdapterTypes";
import { getWebullStatus } from "./WebullAuth";
import { getLiveState } from "./LiveTradingEngine";
import {
  explainWebullAuthFailure,
  getWebullConnection,
  resolveActiveWebullCredential,
  webullFetch,
} from "./WebullShared";

/**
 * Native Webull order placement. Confirmed against the official SDK's
 * PlaceOrderRequest and its own sample script (samples/order/
 * order_stock_client.py) — the order object uses `time_in_force` (not
 * `tif`) and `support_trading_session` (not `extended_hours_trading`),
 * and the body wraps a LIST of orders under `new_orders`, not a single
 * object. The prior Python helper got both of these wrong, which was
 * likely rejecting every real order regardless of the routing bug.
 */

const PLACE_ORDER_PATH = "/openapi/trade/stock/order/place";

export interface WebullOrderInput {
  symbol: string;
  side: "BUY" | "SELL";
  quantity: number;
  orderType?: "LIMIT" | "MARKET";
  limitPrice?: number;
  clientOrderId?: string;
}

export interface WebullOrderResult {
  ok: boolean;
  orderId?: string;
  clientOrderId?: string;
  environment: ExecutionAdapterStatus["mode"];
  message: string;
}

function extractOrderId(data: any, clientOrderId: string): string {
  if (data && typeof data === "object") {
    const direct = data.order_id ?? data.orderId ?? data.client_order_id ?? data.clientOrderId;
    if (direct) return String(direct);
    const first = Array.isArray(data.data) ? data.data[0] : Array.isArray(data.orders) ? data.orders[0] : null;
    if (first) {
      const id = first.order_id ?? first.orderId ?? first.client_order_id ?? first.clientOrderId;
      if (id) return String(id);
    }
  }
  return clientOrderId;
}

/**
 * Place a real order on the connected Webull account. Uses the same
 * credential resolution as the connection test; the saved account is the
 * destination. Never fabricates a fill — Webull's exact response (accept
 * or reject) is what's returned.
 */
export async function placeWebullOrder(userId: string, input: WebullOrderInput): Promise<WebullOrderResult> {
  const status = await getWebullStatus(userId);
  if (!status.connected || !status.saved?.accountId) {
    return {
      ok: false,
      environment: status.mode,
      message: status.note || "Webull is not connected with a saved account id.",
    };
  }
  const connection = await getWebullConnection(userId);
  const candidate = resolveActiveWebullCredential(connection);
  if (!candidate) {
    return { ok: false, environment: status.mode, message: "No Webull credentials available." };
  }

  const clientOrderId = input.clientOrderId || randomUUID().replace(/-/g, "");
  const orderType = input.orderType || "LIMIT";
  const order: Record<string, unknown> = {
    client_order_id: clientOrderId,
    symbol: input.symbol.toUpperCase(),
    instrument_type: "EQUITY",
    market: "US",
    order_type: orderType,
    quantity: String(Math.max(1, Math.floor(input.quantity))),
    support_trading_session: "CORE",
    side: input.side,
    time_in_force: "DAY",
    entrust_type: "QTY",
  };
  if (orderType === "LIMIT" && typeof input.limitPrice === "number") {
    order.limit_price = String(input.limitPrice);
  }

  const result = await webullFetch({
    host: candidate.endpoint,
    path: PLACE_ORDER_PATH,
    method: "POST",
    appKey: candidate.appKey,
    appSecret: candidate.appSecret,
    body: { account_id: status.saved.accountId, new_orders: [order] },
    extraHeaders: { category: "US_STOCK" },
  });

  if (result.error) {
    return { ok: false, environment: status.mode, message: `Could not reach Webull: ${result.error}` };
  }
  if (!result.ok) {
    return {
      ok: false,
      environment: status.mode,
      message: explainWebullAuthFailure(`HTTP ${result.status}: ${result.text.slice(0, 400)}`, candidate.endpoint),
    };
  }
  return {
    ok: true,
    orderId: extractOrderId(result.data, clientOrderId),
    clientOrderId,
    environment: status.mode,
    message: `Webull accepted the ${input.side} ${orderType} order for ${input.quantity} ${input.symbol.toUpperCase()}.`,
  };
}

/**
 * External-paper order placement — hard-requires the resolved credential
 * to be a SANDBOX account. `placeWebullOrder` itself signs against
 * whichever environment the user's saved connection resolves to
 * (sandbox or production); without this check, a user whose saved
 * Webull connection is set to "production" would have a real order
 * placed on their real funded account by what the UI calls "paper
 * trading" — no governance gate, no confirmation. This refuses instead.
 */
export async function placeWebullPaperOrder(userId: string, input: WebullOrderInput): Promise<WebullOrderResult> {
  const connection = await getWebullConnection(userId);
  const candidate = resolveActiveWebullCredential(connection);
  if (!candidate) {
    return { ok: false, environment: "unknown", message: "No Webull credentials available." };
  }
  if (candidate.mode !== "sandbox") {
    return {
      ok: false,
      environment: candidate.mode,
      message:
        "Refused: this Webull connection is configured for production, not sandbox. External paper trading only ever runs against a sandbox account — connect a sandbox Webull app, or use the governed live order path if you actually intend to trade the funded account.",
    };
  }
  return placeWebullOrder(userId, input);
}

/**
 * Live (funded-account) order placement — hard-requires the resolved
 * credential to be PRODUCTION, and requires every governance gate from
 * the Live stage (qualification passed, broker connected, kill switch
 * armed) before signing anything. Mirrors the same gate the Tradovate
 * live path already enforces in trading-tradovate.ts, applied to Webull.
 */
export async function placeWebullLiveOrder(userId: string, input: WebullOrderInput): Promise<WebullOrderResult> {
  const connection = await getWebullConnection(userId);
  const candidate = resolveActiveWebullCredential(connection);
  if (!candidate) {
    return { ok: false, environment: "unknown", message: "No Webull credentials available." };
  }
  if (candidate.mode !== "production") {
    return {
      ok: false,
      environment: candidate.mode,
      message: "Refused: this Webull connection is configured for sandbox, not production. Connect a production Webull app to place live orders on the funded account.",
    };
  }
  const live = await getLiveState(userId);
  if (!live.canExecute) {
    return {
      ok: false,
      environment: candidate.mode,
      message: `Refused by live-trading governance: ${live.blockers.join(" ")}`,
    };
  }
  return placeWebullOrder(userId, input);
}
