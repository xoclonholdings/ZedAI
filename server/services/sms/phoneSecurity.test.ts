import { describe, expect, it } from "vitest";

import { decryptPhone, encryptPhone, hashPhone, normalizePhoneNumber } from "./phoneSecurity";

const secret = "test-secret-that-is-at-least-thirty-two-characters";

describe("SMS phone security", () => {
  it.each([
    ["(937) 555-0100", "+19375550100"],
    ["+44 20 7946 0958", "+442079460958"],
    ["1-937-555-0100", "+19375550100"],
  ])("normalizes %s", (value, expected) => {
    expect(normalizePhoneNumber(value)).toBe(expected);
  });

  it("rejects invalid phone numbers", () => {
    expect(() => normalizePhoneNumber("1234")).toThrow(/E\.164/);
  });

  it("encrypts reversibly and hashes deterministically without retaining plaintext", () => {
    const phone = "+19375550100";
    const encrypted = encryptPhone(phone, secret);
    expect(encrypted).not.toContain(phone);
    expect(decryptPhone(encrypted, secret)).toBe(phone);
    expect(hashPhone(phone, secret)).toBe(hashPhone(phone, secret));
  });
});
