import { describe, expect, it } from "vitest";

import {
  analyzeMarketStructure,
  detectSwings,
  labelSwings,
  classifyTrend,
  generateStructureAlerts,
} from "./MarketStructureEngine";
import type { MarketBar } from "./MarketDataService";

function synthBars(n: number, trend: "up" | "down" | "range"): MarketBar[] {
  const bars: MarketBar[] = [];
  let price = 100;
  for (let i = 0; i < n; i++) {
    const noise = (Math.sin(i * 1.3) + Math.sin(i * 0.4)) * 0.6;
    const drift = trend === "up" ? 0.35 : trend === "down" ? -0.35 : 0;
    const o = price;
    price = Math.max(1, price + drift + noise);
    const c = price;
    const h = Math.max(o, c) + Math.abs(noise) * 0.5 + 0.2;
    const l = Math.min(o, c) - Math.abs(noise) * 0.5 - 0.2;
    bars.push({ o: round(o), h: round(h), l: round(l), c: round(c) });
  }
  return bars;
}
function round(n: number) {
  return Math.round(n * 100) / 100;
}

describe("MarketStructureEngine", () => {
  it("detects swings and labels them HH/HL/LH/LL relative to prior same-kind swing", () => {
    const bars = synthBars(150, "up");
    const swings = labelSwings(detectSwings(bars, 4));
    expect(swings.length).toBeGreaterThan(0);
    for (const s of swings) {
      expect(["HH", "HL", "LH", "LL", null]).toContain(s.label);
    }
    // In a sustained uptrend, HH/HL should be the dominant labels.
    const highs = swings.filter((s) => s.kind === "high");
    const lows = swings.filter((s) => s.kind === "low");
    const hhCount = highs.filter((s) => s.label === "HH").length;
    const hlCount = lows.filter((s) => s.label === "HL").length;
    expect(hhCount).toBeGreaterThanOrEqual(highs.filter((s) => s.label === "LH").length);
    expect(hlCount).toBeGreaterThanOrEqual(lows.filter((s) => s.label === "LL").length);
  });

  it("classifies trend as bullish for a sustained uptrend and bearish for a sustained downtrend", () => {
    const up = labelSwings(detectSwings(synthBars(150, "up"), 4));
    const down = labelSwings(detectSwings(synthBars(150, "down"), 4));
    expect(classifyTrend(up)).toBe("bullish");
    expect(classifyTrend(down)).toBe("bearish");
  });

  it("analyzeMarketStructure returns a coherent analysis with alignment, confluence, and explanation", () => {
    const series = [
      { timeframe: "Monthly", bars: synthBars(36, "up") },
      { timeframe: "Weekly", bars: synthBars(60, "up") },
      { timeframe: "Daily", bars: synthBars(150, "up") },
    ];
    const analysis = analyzeMarketStructure("TESTSYM", series, "Daily", null);
    expect(analysis).not.toBeNull();
    if (!analysis) return;

    expect(analysis.symbol).toBe("TESTSYM");
    expect(analysis.timeframes.length).toBe(3);
    expect(analysis.confluence.score).toBeGreaterThanOrEqual(0);
    expect(analysis.confluence.score).toBeLessThanOrEqual(100);
    expect(analysis.alignment.agreementScore).toBeGreaterThanOrEqual(0);
    expect(analysis.alignment.agreementScore).toBeLessThanOrEqual(100);
    expect(analysis.explanation.length).toBeGreaterThan(0);
    // No jargon-only output — explanation must be readable prose, not a bare enum dump.
    expect(analysis.explanation).toMatch(/[a-z]{3,}/);
    expect(analysis.setupTag.length).toBeGreaterThan(0);

    // No footprint description should contain a duplicated direction word
    // (regression check for the "bullish bullish order block" bug).
    expect(analysis.explanation).not.toMatch(/(bullish bullish|bearish bearish)/);
  });

  it("returns null instead of throwing when there are too few bars", () => {
    const analysis = analyzeMarketStructure("TINY", [{ timeframe: "Daily", bars: synthBars(5, "range") }], "Daily", null);
    expect(analysis).toBeNull();
  });

  it("returns null instead of throwing when given no series at all", () => {
    expect(analyzeMarketStructure("NONE", [], "Daily", null)).toBeNull();
  });

  it("single-timeframe analysis reports zero agreement score and a clear summary, not a crash", () => {
    const analysis = analyzeMarketStructure("SOLO", [{ timeframe: "Daily", bars: synthBars(80, "down") }], "Daily", null);
    expect(analysis).not.toBeNull();
    expect(analysis?.alignment.agreementScore).toBe(0);
    expect(analysis?.alignment.summary).toMatch(/no higher-timeframe context/i);
  });

  it("generateStructureAlerts is idempotent: diffing an analysis against itself produces no new alerts", () => {
    const series = [{ timeframe: "Daily", bars: synthBars(150, "up") }];
    const analysis = analyzeMarketStructure("IDEMP", series, "Daily", null);
    expect(analysis).not.toBeNull();
    if (!analysis) return;
    const alertsVsNothing = generateStructureAlerts("user1", analysis, null);
    const alertsVsSelf = generateStructureAlerts("user1", analysis, analysis);
    expect(alertsVsSelf.length).toBe(0);
    // At least the confluence/alignment-driven alert types should be well-formed when they do fire.
    for (const alert of alertsVsNothing) {
      expect(alert.symbol).toBe("IDEMP");
      expect(alert.confluence).toBe(analysis.confluence.score);
      expect(alert.message.length).toBeGreaterThan(0);
    }
  });
});
