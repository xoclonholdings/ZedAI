import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

import type {
  AuthSettings,
  ManagedUser,
  PublicManagedUser,
} from "../../../shared/adminSettings";
import {
  getEnvOrDevelopmentDefault,
  isProductionEnvironment,
  nowIso,
  requireProductionEnv,
} from "./env";

/** Defaults for the auth section, pulled from env in production. */
export function defaultAuthSettings(): AuthSettings {
  return {
    adminUsername: getEnvOrDevelopmentDefault("ZED_ADMIN_USERNAME", "LocalAdmin"),
    securePhrase: getEnvOrDevelopmentDefault(
      "ZED_ADMIN_SECURE_PHRASE",
      "LOCAL-DEV-SECURE-PHRASE",
    ),
    sessionTimeoutMinutes: 45,
    maxFailedAttempts: 10,
    lockoutDurationMinutes: 1,
    requireSecureCookies: process.env.NODE_ENV === "production",
    sessionSecret: isProductionEnvironment()
      ? requireProductionEnv("SESSION_SECRET")
      : process.env.SESSION_SECRET || randomBytes(24).toString("hex"),
  };
}

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { passwordHash: hash, passwordSalt: salt };
}

export function verifyPassword(
  password: string,
  passwordHash?: string,
  passwordSalt?: string,
) {
  if (!passwordHash || !passwordSalt) return false;
  const incoming = scryptSync(password, passwordSalt, 64);
  const stored = Buffer.from(passwordHash, "hex");
  return incoming.length === stored.length && timingSafeEqual(incoming, stored);
}

/** Constructs the bootstrap admin user with a password from env in production. */
export function createDefaultAdminUser(auth: AuthSettings): ManagedUser {
  const timestamp = nowIso();
  const bootstrapPassword = getEnvOrDevelopmentDefault(
    "ZED_ADMIN_PASSWORD",
    "LocalDevPassword!234",
  );
  return {
    id: "user_admin",
    username: auth.adminUsername,
    email: "admin@zed-ai.online",
    firstName: "ZED",
    lastName: "Admin",
    profileImageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=zed-admin",
    isAdmin: true,
    isActive: true,
    ...hashPassword(bootstrapPassword),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/** Drops password hash/salt before returning a user over the wire. */
export function sanitizeUser(user: ManagedUser): PublicManagedUser {
  const { passwordHash: _passwordHash, passwordSalt: _passwordSalt, ...safe } = user;
  return safe;
}

/**
 * Ensures the admin user exists, syncs the admin's username to the
 * current auth setting, and migrates older email values forward to
 * the canonical admin@zed-ai.online.
 */
export function normalizeUsers(
  auth: AuthSettings,
  users: ManagedUser[] | undefined,
): ManagedUser[] {
  const existing = Array.isArray(users) ? users : [];
  const admin = existing.find((user) => user.isAdmin) || createDefaultAdminUser(auth);

  const adminUpdated = {
    ...admin,
    username: auth.adminUsername,
    // Canonical email — older settings files (admin@zed-ai.local) get
    // migrated forward without a separate migration script.
    email: "admin@zed-ai.online",
    updatedAt: admin.updatedAt || nowIso(),
  };

  const others = existing
    .filter((user) => user.id !== adminUpdated.id)
    .map((user) => ({
      ...user,
      isAdmin: false,
      isActive: user.isActive !== false,
      createdAt: user.createdAt || nowIso(),
      updatedAt: user.updatedAt || nowIso(),
    }));

  return [adminUpdated, ...others];
}
