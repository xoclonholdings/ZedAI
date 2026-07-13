import { getMarketQuote } from "./MarketDataService";
import { TradingStore } from "./TradingStore";

/**
 * Resolve open paper trades against the live market price.
 *
 * This closes the validation loop objectively: for each open trade Zed
 * proposed, we fetch the live price and check it against the plan. If the
 * price has reached the target the trade is a win (closed at target); if
 * it has hit the stop it is a loss (closed at stop). Nothing in between is
 * touched — the trade stays open until price actually resolves it.
 *
 * Because there is no intraday tick history wired in, resolution uses the
 * current price (a conservative "has it hit yet" check), not a look-back
 * over every tick. When no live feed is reachable, nothing is resolved
 * and the caller is told the feed was unavailable.
 */

export interface ResolvedTrade {
  id: string;
  symbol: string;
  direction: "long" | "short";
  outcome: "win" | "loss";
  exitPrice: number;
  livePrice: number;
  source: string;
}

export interface ResolveResult {
  checked: number;
  resolved: number;
  live: boolean;
  details: ResolvedTrade[];
  note: string;
}

/**
 * Decide a trade's outcome from the current price. Returns null when price
 * is still between the stop and the target (trade stays open). Exported so
 * the win/loss/no-hit rules can be unit-tested without a live feed.
 */
export function resolveAgainstPrice(
  direction: "long" | "short",
  stop: number,
  target: number,
  price: number,
): { outcome: "win" | "loss"; exit: number } | null {
  if (direction === "long") {
    if (price >= target) return { outcome: "win", exit: target };
    if (price <= stop) return { outcome: "loss", exit: stop };
    return null;
  }
  if (price <= target) return { outcome: "win", exit: target };
  if (price >= stop) return { outcome: "loss", exit: stop };
  return null;
}

export async function resolveOpenPaperTrades(userId: string): Promise<ResolveResult> {
  const open = await TradingStore.listPaperTrades(userId, "open");
  const details: ResolvedTrade[] = [];
  let anyLive = false;

  // Cache one quote per symbol/asset so five open trades on the same
  // symbol don't fire five identical requests.
  const quoteCache = new Map<string, Awaited<ReturnType<typeof getMarketQuote>>>();

  for (const trade of open) {
    const cacheKey = `${trade.symbol}:${trade.assetClass}`;
    let quote = quoteCache.get(cacheKey);
    if (quote === undefined) {
      quote = await getMarketQuote(trade.symbol, trade.assetClass);
      quoteCache.set(cacheKey, quote);
    }
    if (!quote) continue;
    anyLive = true;
    const price = quote.price;

    const hit = resolveAgainstPrice(trade.direction, trade.stop, trade.target, price);
    if (!hit) continue;

    const reason =
      hit.outcome === "win"
        ? `Auto-resolved: target hit (${quote.source} $${price}).`
        : `Auto-resolved: stop hit (${quote.source} $${price}).`;
    const closed = await TradingStore.closePaperTrade({
      id: trade.id,
      userId,
      exitPrice: hit.exit,
      exitReason: reason,
    });
    if (closed) {
      details.push({
        id: trade.id,
        symbol: trade.symbol,
        direction: trade.direction,
        outcome: hit.outcome,
        exitPrice: hit.exit,
        livePrice: price,
        source: quote.source,
      });
    }
  }

  const note = !open.length
    ? "No open trades to check."
    : !anyLive
      ? "No live market-data source was reachable, so nothing could be resolved."
      : details.length
        ? `${details.length} of ${open.length} open trade(s) resolved against live prices.`
        : `Checked ${open.length} open trade(s); none have hit their target or stop yet.`;

  return { checked: open.length, resolved: details.length, live: anyLive, details, note };
}
