import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";

import { getExternalPaperReport } from "./ExternalPaperEngine";
import { saveTradovateCredentials } from "./TradovateBridge";
import { getEvaluationReport } from "./EvaluationEngine";
import { getLiveState } from "./LiveTradingEngine";

/**
 * Regression tests for the "Tradovate users can never pass Stage 5/6"
 * bug: ExternalPaperEngine and EvaluationEngine's provider-connected
 * checks previously only recognized Webull (via TradingIntegrationsStore,
 * which Tradovate credentials never populate — they live in their own
 * store). A fully-configured Tradovate connection must now be
 * recognized by both.
 */

function testUserId(): string {
  return `test-tradovate-${randomUUID()}`;
}

describe("Tradovate connection recognized outside its own bridge", () => {
  it("getExternalPaperReport reports 'no broker connected' before any credentials are saved", async () => {
    const userId = testUserId();
    const report = await getExternalPaperReport(userId);
    expect(report.providerConnected).toBe(false);
  });

  it("getExternalPaperReport recognizes a fully-configured Tradovate connection", async () => {
    const userId = testUserId();
    await saveTradovateCredentials(userId, {
      environment: "demo",
      username: "test",
      password: "test",
      appId: "test-app",
      cid: "test-cid",
      sec: "test-sec",
    });
    const report = await getExternalPaperReport(userId);
    expect(report.providerConnected).toBe(true);
    expect(report.providerLabel).toMatch(/tradovate/i);
  });

  it("getEvaluationReport recognizes a fully-configured Tradovate connection", async () => {
    const userId = testUserId();
    await saveTradovateCredentials(userId, {
      environment: "live",
      username: "test",
      password: "test",
      appId: "test-app",
      cid: "test-cid",
      sec: "test-sec",
    });
    const report = await getEvaluationReport(userId);
    expect(report.providerConnected).toBe(true);
    expect(report.providerLabel).toMatch(/tradovate/i);
  });

  it("getEvaluationReport reports the sandbox engine when nothing is connected", async () => {
    const userId = testUserId();
    const report = await getEvaluationReport(userId);
    expect(report.providerConnected).toBe(false);
    expect(report.providerLabel).toMatch(/sandbox engine/i);
  });

  it("getLiveState recognizes a live Tradovate connection as a connected broker — the exact gate the Tradovate order route depends on", async () => {
    const userId = testUserId();
    await saveTradovateCredentials(userId, {
      environment: "live",
      username: "test",
      password: "test",
      appId: "test-app",
      cid: "test-cid",
      sec: "test-sec",
    });
    const live = await getLiveState(userId);
    expect(live.brokerConnected).toBe(true);
    expect(live.brokerLabel).toMatch(/tradovate/i);
    // Broker connected alone is still not sufficient — qualification and
    // the kill switch are separate, independently-required gates.
    expect(live.canExecute).toBe(false);
    expect(live.blockers.join(" ")).not.toMatch(/no broker/i);
  });

  it("getLiveState does NOT treat a Tradovate demo connection as a live broker", async () => {
    const userId = testUserId();
    await saveTradovateCredentials(userId, {
      environment: "demo",
      username: "test",
      password: "test",
      appId: "test-app",
      cid: "test-cid",
      sec: "test-sec",
    });
    const live = await getLiveState(userId);
    expect(live.brokerConnected).toBe(false);
    expect(live.blockers.join(" ")).toMatch(/no broker/i);
  });
});
