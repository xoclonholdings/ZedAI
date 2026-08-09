import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildCapitalLaunchUrl, invokeCapital, issueCapitalGrant } from "./CapitalGateway";

const originalSecret = process.env.ZILLION_CAPABILITY_SECRET;
const originalUrl = process.env.ZILLION_PROSPER_API_URL;

beforeEach(() => {
  process.env.ZILLION_CAPABILITY_SECRET = "test-capability-secret-with-at-least-32-characters";
  process.env.ZILLION_PROSPER_API_URL = "https://capital.example";
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalSecret === undefined) delete process.env.ZILLION_CAPABILITY_SECRET;
  else process.env.ZILLION_CAPABILITY_SECRET = originalSecret;
  if (originalUrl === undefined) delete process.env.ZILLION_PROSPER_API_URL;
  else process.env.ZILLION_PROSPER_API_URL = originalUrl;
});

describe("ZILLION Capital gateway", () => {
  it("issues an owner-bound launch URL", () => {
    const url = new URL(buildCapitalLaunchUrl("user_privy_123", "/trading"));
    const token = String(url.searchParams.get("token"));
    const payload = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));
    expect(url.origin).toBe("https://capital.example");
    expect(url.searchParams.get("next")).toBe("/trading");
    expect(payload).toMatchObject({
      sub: "user_privy_123",
      kind: "launch",
      aud: "zillion-prosper",
      iss: "zcos",
    });
  });

  it("fails closed on prohibited fallback owners", () => {
    expect(() => issueCapitalGrant("anonymous", "capability")).toThrow(/owner/i);
  });

  it("invokes Capital with a capability grant instead of a provider identity", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const token = String((init?.headers as Record<string, string>).Authorization).slice(7);
      const payload = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));
      expect(payload).toMatchObject({ sub: "user_privy_123", kind: "capability" });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(invokeCapital("user_privy_123", { task: "review" })).resolves.toEqual({ ok: true });
  });
});
