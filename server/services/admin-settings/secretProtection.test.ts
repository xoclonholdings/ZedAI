import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { mergeSettings } from "./mergeSettings";
import {
  isProtectedSecret,
  protectAdminSettingsForStorage,
  protectSecret,
  revealSecret,
  revealStoredAdminSettings,
  storedAdminSettingsNeedProtection,
} from "./secretProtection";

const TEST_SESSION_SECRET = "test-session-secret-with-at-least-thirty-two-characters";

describe("admin integration secret protection", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = TEST_SESSION_SECRET;
    delete process.env.ZAR_INTEGRATION_ENCRYPTION_KEY;
  });

  afterEach(() => {
    delete process.env.SESSION_SECRET;
    delete process.env.ZAR_INTEGRATION_ENCRYPTION_KEY;
  });

  it("encrypts integration credentials and browser sessions at rest", () => {
    const settings = mergeSettings(undefined);
    settings.auth.securePhrase = "admin-plaintext-secure-phrase";
    settings.integrations.github.accounts = [{
      id: "github-main",
      label: "main",
      owner: "owner",
      repo: "repo",
      defaultBranch: "main",
      token: "github-plaintext-token",
    }];
    settings.integrations.email.accounts = [{
      id: "email-main",
      label: "Email",
      provider: "smtp",
      fromName: "ZAR",
      fromAddress: "operator@example.com",
      smtpHost: "smtp.example.com",
      smtpPort: 587,
      username: "operator@example.com",
      password: "email-plaintext-password",
    }];
    settings.integrations.socialPublishing.accounts = [{
      id: "social-instagram",
      label: "Instagram",
      platform: "instagram",
      authMethod: "credentials",
      accessToken: "",
      username: "operator",
      sessionState: "social-plaintext-session",
      password: "must-never-be-persisted",
    } as any];
    settings.integrations.custom = [{
      id: "custom",
      label: "Custom",
      enabled: true,
      fields: [{ key: "API key", value: "custom-plaintext-secret", isSecret: true }],
    } as any];

    const stored = protectAdminSettingsForStorage(settings);
    const storedJson = JSON.stringify(stored);

    expect(isProtectedSecret(stored.integrations.github.accounts[0].token)).toBe(true);
    expect(isProtectedSecret(stored.auth.securePhrase)).toBe(true);
    expect(isProtectedSecret(stored.auth.sessionSecret)).toBe(true);
    expect(isProtectedSecret(stored.integrations.email.accounts[0].password)).toBe(true);
    expect(isProtectedSecret(stored.integrations.socialPublishing.accounts[0].sessionState)).toBe(true);
    expect((stored.integrations.socialPublishing.accounts[0] as any).password).toBeUndefined();
    expect(storedJson).not.toContain("github-plaintext-token");
    expect(storedJson).not.toContain("admin-plaintext-secure-phrase");
    expect(storedJson).not.toContain(TEST_SESSION_SECRET);
    expect(storedJson).not.toContain("email-plaintext-password");
    expect(storedJson).not.toContain("social-plaintext-session");
    expect(storedJson).not.toContain("must-never-be-persisted");
    expect(storedJson).not.toContain("custom-plaintext-secret");
    expect(storedAdminSettingsNeedProtection(stored)).toBe(false);

    const revealed = revealStoredAdminSettings(stored);
    expect(revealed.auth.securePhrase).toBe("admin-plaintext-secure-phrase");
    expect(revealed.auth.sessionSecret).toBe(TEST_SESSION_SECRET);
    expect(revealed.integrations.github.accounts[0].token).toBe("github-plaintext-token");
    expect(revealed.integrations.email.accounts[0].password).toBe("email-plaintext-password");
    expect(revealed.integrations.socialPublishing.accounts[0].sessionState).toBe("social-plaintext-session");
    expect((revealed.integrations.socialPublishing.accounts[0] as any).password).toBeUndefined();
    expect(revealed.integrations.custom[0].fields[0].value).toBe("custom-plaintext-secret");
  });

  it("migrates plaintext records and decrypts with the SESSION_SECRET fallback after key separation", () => {
    const encryptedWithSessionSecret = protectSecret("rotate-me");
    expect(storedAdminSettingsNeedProtection({
      integrations: {
        socialPublishing: {
          accounts: [{ sessionState: "plaintext", password: "legacy-password" }],
        },
      },
    } as any)).toBe(true);

    process.env.ZAR_INTEGRATION_ENCRYPTION_KEY =
      "new-dedicated-integration-key-with-at-least-thirty-two-characters";
    expect(revealSecret(encryptedWithSessionSecret)).toBe("rotate-me");
  });

  it("fails closed when encrypted credentials are tampered with", () => {
    const encrypted = protectSecret("sensitive");
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith("a") ? "b" : "a"}`;
    expect(() => revealSecret(tampered)).toThrow(/could not be decrypted/);
  });

  it("refuses to persist a credential without an encryption key", () => {
    delete process.env.SESSION_SECRET;
    expect(() => protectSecret("sensitive")).toThrow(/is required to protect stored secrets/);
  });
});
