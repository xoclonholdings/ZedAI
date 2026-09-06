import { beforeEach, describe, expect, it, vi } from "vitest";

import { mergeSettings } from "./mergeSettings";

const { loadAdminSettingsMock } = vi.hoisted(() => ({
  loadAdminSettingsMock: vi.fn(),
}));

vi.mock("./io", () => ({
  loadAdminSettings: loadAdminSettingsMock,
}));

import { getPublicAdminSettings } from "./publicMasking";

describe("public admin settings masking", () => {
  beforeEach(() => {
    loadAdminSettingsMock.mockReset();
  });

  it("never returns auth secrets, social sessions, or legacy social passwords", async () => {
    const settings = mergeSettings(undefined);
    settings.auth.securePhrase = "plaintext-admin-phrase";
    settings.auth.sessionSecret = "plaintext-session-secret";
    settings.integrations.socialPublishing.accounts = [{
      id: "social-instagram",
      label: "Instagram",
      platform: "instagram",
      accessToken: "plaintext-token",
      sessionState: "plaintext-browser-session",
      password: "legacy-plaintext-password",
    } as any];
    loadAdminSettingsMock.mockResolvedValue(settings);

    const publicSettings = await getPublicAdminSettings();
    const publicJson = JSON.stringify(publicSettings);

    expect(publicSettings.auth.securePhrase).toBe("•••••• (set)");
    expect(publicSettings.auth.sessionSecret).toBe("");
    expect(publicJson).not.toContain("plaintext-admin-phrase");
    expect(publicJson).not.toContain("plaintext-session-secret");
    expect(publicJson).not.toContain("plaintext-token");
    expect(publicJson).not.toContain("plaintext-browser-session");
    expect(publicJson).not.toContain("legacy-plaintext-password");
  });
});
