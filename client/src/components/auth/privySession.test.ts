import { describe, expect, it, vi } from "vitest";

import { establishPrivySession } from "./privySession";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("establishPrivySession", () => {
  it("exchanges the Privy token through the ZAR session route", async () => {
    const fetchSession = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    await establishPrivySession(async () => "signed-token", fetchSession);
    expect(fetchSession).toHaveBeenCalledWith("/api/auth/privy/session", {
      method: "POST",
      headers: { Authorization: "Bearer signed-token" },
    });
  });

  it("does not contact ZAR when Privy returns no token", async () => {
    const fetchSession = vi.fn();
    await expect(establishPrivySession(async () => null, fetchSession)).rejects.toThrow(
      "Privy did not return an access token",
    );
    expect(fetchSession).not.toHaveBeenCalled();
  });

  it("surfaces a server verification failure", async () => {
    const fetchSession = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: "Privy access token is invalid" }, 401));
    await expect(
      establishPrivySession(async () => "forged-token", fetchSession),
    ).rejects.toThrow("Privy access token is invalid");
  });
});
