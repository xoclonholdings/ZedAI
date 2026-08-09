import { describe, expect, it, vi } from "vitest";

import {
  authenticatePrivyAccessToken,
  PrivyAuthError,
  readBearerToken,
  readPrivyServerConfig,
  verifiedEmailFromPrivyUser,
  type PrivyAuthDependencies,
} from "./PrivyAuthService";

const privyUser = {
  id: "did:privy:verified-user",
  created_at: 1,
  has_accepted_terms: true,
  is_guest: false,
  linked_accounts: [
    {
      type: "email" as const,
      address: "Pretty@Example.com",
      verified_at: 1,
      first_verified_at: 1,
      latest_verified_at: 1,
    },
  ],
  mfa_methods: [],
};

describe("PrivyAuthService", () => {
  it("reads only a non-empty Bearer token", () => {
    expect(readBearerToken("Bearer signed-token")).toBe("signed-token");
    expect(() => readBearerToken("Basic nope")).toThrow(PrivyAuthError);
    expect(() => readBearerToken(undefined)).toThrow(PrivyAuthError);
  });

  it("fails closed when server configuration is incomplete", () => {
    expect(() => readPrivyServerConfig({})).toThrow(PrivyAuthError);
    expect(() =>
      readPrivyServerConfig({ VITE_PRIVY_APP_ID: "app", PRIVY_APP_SECRET: "secret" }),
    ).not.toThrow();
  });

  it("accepts only a verified email account", () => {
    expect(verifiedEmailFromPrivyUser(privyUser)).toBe("pretty@example.com");
    expect(() =>
      verifiedEmailFromPrivyUser({ ...privyUser, linked_accounts: [] }),
    ).toThrow(PrivyAuthError);
  });

  it("verifies the token and resolves one internal owner", async () => {
    const localUser = {
      id: "user_privy_internal",
      username: "pretty",
      email: "pretty@example.com",
      firstName: "pretty",
      lastName: "",
      profileImageUrl: "",
      isAdmin: false,
      isActive: true,
    };
    const dependencies: PrivyAuthDependencies = {
      verifyAccessToken: vi.fn().mockResolvedValue({ userId: privyUser.id }),
      getUser: vi.fn().mockResolvedValue(privyUser),
      resolveIdentity: vi.fn().mockResolvedValue(localUser),
    };

    await expect(
      authenticatePrivyAccessToken(
        "signed-token",
        { appId: "app", appSecret: "secret" },
        dependencies,
      ),
    ).resolves.toEqual(localUser);
    expect(dependencies.resolveIdentity).toHaveBeenCalledWith({
      appId: "app",
      privyUser,
      verifiedEmail: "pretty@example.com",
    });
  });

  it("rejects a user response that does not match the verified token", async () => {
    const dependencies: PrivyAuthDependencies = {
      verifyAccessToken: vi.fn().mockResolvedValue({ userId: privyUser.id }),
      getUser: vi.fn().mockResolvedValue({ ...privyUser, id: "did:privy:other" }),
      resolveIdentity: vi.fn(),
    };

    await expect(
      authenticatePrivyAccessToken(
        "signed-token",
        { appId: "app", appSecret: "secret" },
        dependencies,
      ),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(dependencies.resolveIdentity).not.toHaveBeenCalled();
  });
});
