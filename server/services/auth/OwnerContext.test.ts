import { describe, expect, it } from "vitest";

import {
  assertOwnedBy,
  OwnerAccessError,
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

  it("accepts an owned record and rejects a cross-user record", () => {
    const owner = createOwnerContext("account-123");
    expect(() => assertOwnedBy(owner, "account-123")).not.toThrow();
    expect(() => assertOwnedBy(owner, "account-456")).toThrow(OwnerAccessError);
  });
});
