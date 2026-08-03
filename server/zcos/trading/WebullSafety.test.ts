import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";

import { placeWebullPaperOrder, placeWebullLiveOrder } from "./WebullBridge";
import { TradingIntegrationsStore } from "./TradingIntegrationsStore";
import { getLiveState, setKillSwitch } from "./LiveTradingEngine";

/**
 * Proves the funded-account safety fix actually holds: "paper trading"
 * can never execute against a production Webull account, and "live"
 * execution can never run against a sandbox account or without every
 * Live-stage governance gate satisfied. These are pure refusal-path
 * tests — no network call happens in any of them, since the guard
 * clauses in WebullOrders.ts return before webullFetch is ever reached.
 */

function testUserId(): string {
  return `test-webull-${randomUUID()}`;
}

const ORDER_INPUT = {
  symbol: "AAPL",
  side: "BUY" as const,
  quantity: 1,
  orderType: "LIMIT" as const,
  limitPrice: 100,
};

describe("Webull environment safety", () => {
  it("placeWebullPaperOrder refuses when the connection is configured for production", async () => {
    const userId = testUserId();
    await TradingIntegrationsStore.connect({
      userId,
      provider: "webull",
      fields: { appKey: "test-key", environment: "production", accountId: "ACC1" },
      secrets: { appSecret: "test-secret" },
    });

    const result = await placeWebullPaperOrder(userId, ORDER_INPUT);
    expect(result.ok).toBe(false);
    expect(result.environment).toBe("production");
    expect(result.message).toMatch(/refused/i);
    expect(result.message).toMatch(/production/i);
  });

  it("placeWebullPaperOrder proceeds to the network call (not refused) when configured for sandbox", async () => {
    const userId = testUserId();
    await TradingIntegrationsStore.connect({
      userId,
      provider: "webull",
      fields: { appKey: "test-key", environment: "sandbox", accountId: "ACC1" },
      secrets: { appSecret: "test-secret" },
    });

    const result = await placeWebullPaperOrder(userId, ORDER_INPUT);
    // No real Webull credentials exist, so the actual HTTP call will fail —
    // the point here is that it was NOT refused for being the wrong
    // environment; it got past the guard clause.
    expect(result.message).not.toMatch(/refused/i);
  });

  it("placeWebullLiveOrder refuses when the connection is configured for sandbox", async () => {
    const userId = testUserId();
    await TradingIntegrationsStore.connect({
      userId,
      provider: "webull",
      fields: { appKey: "test-key", environment: "sandbox", accountId: "ACC1" },
      secrets: { appSecret: "test-secret" },
    });

    const result = await placeWebullLiveOrder(userId, ORDER_INPUT);
    expect(result.ok).toBe(false);
    expect(result.environment).toBe("sandbox");
    expect(result.message).toMatch(/refused/i);
    expect(result.message).toMatch(/sandbox/i);
  });

  it("placeWebullLiveOrder refuses a production connection when the Live-stage gates aren't satisfied", async () => {
    const userId = testUserId();
    await TradingIntegrationsStore.connect({
      userId,
      provider: "webull",
      fields: { appKey: "test-key", environment: "production", accountId: "ACC1" },
      secrets: { appSecret: "test-secret" },
    });
    // Kill switch defaults to disarmed and qualification hasn't been
    // earned — canExecute must be false.
    const live = await getLiveState(userId);
    expect(live.canExecute).toBe(false);

    const result = await placeWebullLiveOrder(userId, ORDER_INPUT);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/governance/i);
  });

  it("the kill switch actually persists across separate calls (regression: readTradingState/writeTradingState had no offline fallback)", async () => {
    const userId = testUserId();
    const armed = await setKillSwitch(userId, true);
    expect(armed.config.killSwitchArmed).toBe(true);
    // A fresh read (simulating the next request/page load) must see the
    // same value — not silently reset to the default false because the
    // write never actually persisted anywhere.
    const reread = await getLiveState(userId);
    expect(reread.config.killSwitchArmed).toBe(true);
  });

  it("arming the kill switch alone is not sufficient — qualification must also pass", async () => {
    const userId = testUserId();
    await TradingIntegrationsStore.connect({
      userId,
      provider: "webull",
      fields: { appKey: "test-key", environment: "production", accountId: "ACC1" },
      secrets: { appSecret: "test-secret" },
    });
    await setKillSwitch(userId, true);
    const live = await getLiveState(userId);
    // A brand-new test user has no closed trades and no qualification —
    // canExecute must still be false even with the kill switch armed.
    expect(live.canExecute).toBe(false);
    expect(live.blockers.join(" ")).toMatch(/qualification/i);
  });
});
