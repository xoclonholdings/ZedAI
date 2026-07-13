import { TradingStore } from "./TradingStore";
import { resolveOpenPaperTrades } from "./TradeAutoResolver";

/**
 * Periodically resolves open paper trades against live prices so a trade
 * that hits its target or stop is closed on its own — the validation
 * sample grows without the user tapping anything. Runs in-process on an
 * interval; safe to no-op when there are no open trades or no live feed.
 *
 * Interval is configurable via TRADE_RESOLVER_INTERVAL_MS (default 5 min).
 * Set TRADE_RESOLVER_DISABLED=1 to turn it off.
 */

let running = false;
let timer: NodeJS.Timeout | null = null;

async function sweep(log: (msg: string) => void): Promise<void> {
  if (running) return; // don't overlap a slow sweep with the next tick
  running = true;
  try {
    const open = await TradingStore.listPaperTrades(undefined, "open");
    if (!open.length) return;
    const userIds = Array.from(new Set(open.map((t) => t.userId)));
    let resolved = 0;
    for (const userId of userIds) {
      try {
        const result = await resolveOpenPaperTrades(userId);
        resolved += result.resolved;
      } catch {
        /* keep sweeping other users */
      }
    }
    if (resolved > 0) {
      log(`[trade-resolver] auto-closed ${resolved} paper trade(s) across ${userIds.length} user(s)`);
    }
  } catch {
    /* try again next tick */
  } finally {
    running = false;
  }
}

export function startTradeResolverScheduler(log: (msg: string) => void = () => {}): void {
  if (process.env.TRADE_RESOLVER_DISABLED === "1") {
    log("[trade-resolver] disabled via TRADE_RESOLVER_DISABLED");
    return;
  }
  if (timer) return; // already started
  const intervalMs = Math.max(
    60_000,
    Number(process.env.TRADE_RESOLVER_INTERVAL_MS) || 5 * 60_000,
  );
  // First sweep shortly after boot, then on the interval.
  setTimeout(() => void sweep(log), 30_000);
  timer = setInterval(() => void sweep(log), intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  log(`[trade-resolver] scheduled every ${Math.round(intervalMs / 1000)}s`);
}
