import { randomBytes } from "crypto";

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
    securePhrase: getEnvOrDevelopmentDefault(
      "ZAR_ADMIN_SECURE_PHRASE",
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

/** Constructs the stable bootstrap owner used by the secure-phrase fallback. */
export function createDefaultAdminUser(): ManagedUser {
  const timestamp = nowIso();
  return {
    id: "user_admin",
    username: "ZAR Admin",
    email: "admin@zar-ai.online",
    firstName: "ZAR",
    lastName: "Admin",
    profileImageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=zar-admin",
    isAdmin: true,
    isActive: true,
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
 * Ensures the stable admin owner exists and migrates older display and
 * email values forward. The username is an internal display label, not
 * a sign-in credential.
 */
export function normalizeUsers(
  auth: AuthSettings,
  users: ManagedUser[] | undefined,
): ManagedUser[] {
  const existing = Array.isArray(users) ? users : [];
  const admin = existing.find((user) => user.isAdmin) || createDefaultAdminUser();

  const adminUpdated = {
    ...admin,
    username: "ZAR Admin",
    // Canonical email — older settings files (admin@zed-ai.local) get
    // migrated forward without a separate migration script.
    email: "admin@zar-ai.online",
    passwordHash: undefined,
    passwordSalt: undefined,
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
