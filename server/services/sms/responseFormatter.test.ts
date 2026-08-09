import { describe, expect, it } from "vitest";

import { containsInternalLeakage, formatSmsReply, segmentSms } from "./responseFormatter";

describe("SMS response formatting", () => {
  it("splits long replies in order at logical boundaries", () => {
    const source = Array.from({ length: 40 }, (_, index) => `Sentence ${index + 1} explains a distinct point.`).join(" ");
    const segments = segmentSms(source, 180);
    expect(segments.length).toBeGreaterThan(1);
    expect(segments.every((segment, index) => segment.startsWith(`(${index + 1}/${segments.length}) `))).toBe(true);
    expect(segments.join(" ")).toContain("Sentence 1");
    expect(segments.join(" ")).toContain("Sentence 40");
  });

  it("blocks internal prompt, trace, and JSON leakage", () => {
    expect(containsInternalLeakage("executionTrace: hidden")).toBe(true);
    expect(formatSmsReply('{"reply":"x","metadata":{}}')).toMatch(/safely format/);
  });
});
