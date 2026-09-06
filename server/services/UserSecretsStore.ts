import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

import { HUB_USER_MEMORY_DIR } from "../utils/repoPaths";
import {
  isProtectedSecret,
  protectSecret,
  revealSecret,
} from "./admin-settings/secretProtection";

/**
 * A per-user secrets vault - arbitrary named credentials (an API key, a
 * token, anything) the user adds themselves, independent of the shared
 * admin-wide IntegrationsSettings. Unlike that shared config, every user can
 * have their own regardless of admin status, since these are scoped to
 * hub/user-memory/<userId>/ rather than a single instance-wide file.
 *
 * Values are never returned once stored - only list()/create() return the
 * masked shape (id/label/createdAt). getValue() exists for future
 * agent/context wiring and is never exposed over an HTTP route.
 */

export interface UserSecret {
  id: string;
  label: string;
  value: string;
  createdAt: string;
}

export interface PublicUserSecret {
  id: string;
  label: string;
  createdAt: string;
}

const MAX_SECRETS = 100;

function safeUserId(userId: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!safe) throw new Error("A valid userId is required.");
  return safe;
}

function fileFor(userId: string): string {
  return path.resolve(HUB_USER_MEMORY_DIR, safeUserId(userId), "secrets.json");
}

async function readAll(userId: string): Promise<UserSecret[]> {
  let stored: UserSecret[];
  try {
    const raw = await fs.readFile(fileFor(userId), "utf8");
    const parsed = JSON.parse(raw) as { secrets?: UserSecret[] };
    stored = Array.isArray(parsed.secrets) ? parsed.secrets : [];
  } catch (error: any) {
    if (error?.code === "ENOENT") return [];
    // Corrupt data must fail closed. Returning [] here would allow a later
    // write to silently erase credentials that might still be recoverable.
    throw error;
  }

  const revealed = stored.map((secret) => ({
    ...secret,
    value: revealSecret(secret.value),
  }));
  if (stored.some((secret) => secret.value && !isProtectedSecret(secret.value))) {
    await writeAll(userId, revealed);
  }
  return revealed;
}

async function writeAll(userId: string, secrets: UserSecret[]): Promise<void> {
  const file = fileFor(userId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  const protectedSecrets = secrets.map((secret) => ({
    ...secret,
    value: protectSecret(secret.value),
  }));
  await fs.writeFile(file, JSON.stringify({ secrets: protectedSecrets }, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  await fs.chmod(file, 0o600);
}

function mask(secret: UserSecret): PublicUserSecret {
  return { id: secret.id, label: secret.label, createdAt: secret.createdAt };
}

export const UserSecretsStore = {
  /** Encrypt every legacy plaintext vault before the server accepts traffic. */
  async migrateAll(): Promise<void> {
    const entries = await fs.readdir(HUB_USER_MEMORY_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) await readAll(entry.name);
    }
  },

  async list(userId: string): Promise<PublicUserSecret[]> {
    return (await readAll(userId)).map(mask);
  },

  async create(userId: string, label: string, value: string): Promise<PublicUserSecret> {
    const secrets = await readAll(userId);
    const entry: UserSecret = { id: randomUUID(), label, value, createdAt: new Date().toISOString() };
    await writeAll(userId, [...secrets, entry].slice(-MAX_SECRETS));
    return mask(entry);
  },

  async remove(userId: string, id: string): Promise<void> {
    const secrets = await readAll(userId);
    await writeAll(userId, secrets.filter((secret) => secret.id !== id));
  },

  /** Real value, for agent/context use only - never returned over HTTP. */
  async getValue(userId: string, id: string): Promise<string | null> {
    const secrets = await readAll(userId);
    return secrets.find((secret) => secret.id === id)?.value ?? null;
  },
};
