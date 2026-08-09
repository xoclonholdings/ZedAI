import { describe, expect, it } from "vitest";

import {
  OwnerContextError,
  createOwnerContext,
  ownerContextFromAuthenticatedRequest,
} from "./OwnerContext";

describe("OwnerContext", () => {
  it("creates an owner only from a verified non-placeholder session subject", () => {
    expect(createOwnerContext("account-123")).toEqual({
      ownerUserId: "account-123",
      source: "authenticated_session",
    });
  });

  it.each([undefined, "", "user", "user_001", "anonymous", "unknown", "default-user"])(
    "rejects prohibited owner %s",
    (ownerId) => {
      expect(() => createOwnerContext(ownerId)).toThrow(OwnerContextError);
    },
  );

  it("ignores request-body ownership and uses the authenticated session subject", () => {
    const request = {
      body: { user_id: "attacker" },
      user: { claims: { sub: "account-123" } },
    } as any;
    expect(ownerContextFromAuthenticatedRequest(request).ownerUserId).toBe("account-123");
  });
});
