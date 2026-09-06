import fs from "fs/promises";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { HUB_USER_MEMORY_DIR } from "../utils/repoPaths";
import { UserSecretsStore } from "./UserSecretsStore";

const TEST_SESSION_SECRET = "test-user-vault-session-secret-with-enough-entropy";
const TEST_USER_ID = `secret-test-${process.pid}`;
const TEST_USER_DIR = path.join(HUB_USER_MEMORY_DIR, TEST_USER_ID);
const TEST_FILE = path.join(TEST_USER_DIR, "secrets.json");

describe("UserSecretsStore encrypted persistence", () => {
  beforeEach(async () => {
    process.env.SESSION_SECRET = TEST_SESSION_SECRET;
    await fs.rm(TEST_USER_DIR, { recursive: true, force: true });
  });

  afterEach(async () => {
    delete process.env.SESSION_SECRET;
    await fs.rm(TEST_USER_DIR, { recursive: true, force: true });
  });

  it("stores new vault values encrypted and still returns them internally", async () => {
    const created = await UserSecretsStore.create(TEST_USER_ID, "API key", "plaintext-vault-secret");
    const raw = await fs.readFile(TEST_FILE, "utf8");

    expect(raw).not.toContain("plaintext-vault-secret");
    expect(raw).toContain("zar-secret:v1:");
    expect(await UserSecretsStore.getValue(TEST_USER_ID, created.id)).toBe("plaintext-vault-secret");
    expect((await fs.stat(TEST_FILE)).mode & 0o777).toBe(0o600);
  });

  it("migrates an existing plaintext vault during the boot scan", async () => {
    await fs.mkdir(TEST_USER_DIR, { recursive: true });
    await fs.writeFile(TEST_FILE, JSON.stringify({
      secrets: [{
        id: "legacy-secret",
        label: "Legacy",
        value: "legacy-plaintext-secret",
        createdAt: "2026-01-01T00:00:00.000Z",
      }],
    }));

    await UserSecretsStore.migrateAll();
    const migrated = await fs.readFile(TEST_FILE, "utf8");

    expect(migrated).not.toContain("legacy-plaintext-secret");
    expect(await UserSecretsStore.getValue(TEST_USER_ID, "legacy-secret")).toBe(
      "legacy-plaintext-secret",
    );
  });
});
