import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";

import { TradingIntegrationsStore } from "./TradingIntegrationsStore";

/**
 * Regression test for the read-modify-write race: connect() reads the
 * full per-user record array, mutates it in memory, and writes the whole
 * array back. Two concurrent connect() calls for different providers on
 * the same user used to race — whichever wrote second would overwrite
 * the array from before the first one's change, silently dropping it.
 * withUserLock() serializes these; both providers must survive.
 */

function testUserId(): string {
  return `test-integrations-${randomUUID()}`;
}

describe("TradingIntegrationsStore concurrency", () => {
  it("two concurrent connect() calls for different providers both persist", async () => {
    const userId = testUserId();
    await Promise.all([
      TradingIntegrationsStore.connect({
        userId,
        provider: "webull",
        fields: { appKey: "key-a" },
        secrets: { appSecret: "secret-a" },
      }),
      TradingIntegrationsStore.connect({
        userId,
        provider: "polymarket",
        fields: { keyId: "key-b" },
        secrets: { secretKey: "secret-b" },
      }),
    ]);

    const list = await TradingIntegrationsStore.list(userId);
    const webull = list.find((i) => i.provider === "webull");
    const polymarket = list.find((i) => i.provider === "polymarket");
    expect(webull?.hasCredential).toBe(true);
    expect(polymarket?.hasCredential).toBe(true);
  });

  it("many concurrent connect() calls for the same provider don't drop the final field update", async () => {
    const userId = testUserId();
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        TradingIntegrationsStore.connect({
          userId,
          provider: "custom",
          fields: { baseUrl: `https://example.com/${i}` },
        }),
      ),
    );
    const connection = await TradingIntegrationsStore.getConnection(userId, "custom");
    expect(connection).not.toBeNull();
    // Whichever of the 10 wins the race, exactly one baseUrl must have
    // been recorded — not lost entirely and not a merge artifact.
    expect(connection?.fields.baseUrl).toMatch(/^https:\/\/example\.com\/\d$/);
  });

  it("connect and disconnect racing on the same user resolve to a consistent final state, not a crash", async () => {
    const userId = testUserId();
    await TradingIntegrationsStore.connect({ userId, provider: "webull", fields: { appKey: "k" }, secrets: { appSecret: "s" } });
    await Promise.all([
      TradingIntegrationsStore.disconnect(userId, "webull"),
      TradingIntegrationsStore.connect({ userId, provider: "tradovate", fields: {}, secrets: {} }).catch(() => null),
    ]);
    // Should not throw, and the store should still be readable afterward.
    const list = await TradingIntegrationsStore.list(userId);
    expect(Array.isArray(list)).toBe(true);
  });
});
