import type { AuthSettings, ManagedUser } from "../../../shared/adminSettings";

import { sanitizeUser } from "./auth-helpers";
import { nowIso } from "./env";
import { loadAdminSettings, updateAdminSettings } from "./io";

export async function updateAuthSettings(nextAuth: Partial<AuthSettings>) {
  const settings = await updateAdminSettings((current) => {
    // Drop empty strings/null/undefined so callers can do partial
    // updates without accidentally clearing a stored field.
    const sanitized = Object.fromEntries(
      Object.entries(nextAuth).filter(
        ([, value]) => value !== undefined && value !== null && value !== "",
      ),
    ) as Partial<AuthSettings>;
    const auth = {
      ...current.auth,
      ...sanitized,
    };
    return {
      ...current,
      auth,
    };
  });
  return settings.auth;
}

export async function listManagedUsers() {
  const settings = await loadAdminSettings();
  return settings.users.map(sanitizeUser);
}

export async function updateManagedUser(
  userId: string,
  updates: {
    email?: string;
    firstName?: string;
    lastName?: string;
    isActive?: boolean;
  },
) {
  const settings = await updateAdminSettings((current) => {
    const target = current.users.find((user) => user.id === userId);
    if (!target) {
      throw new Error("User not found");
    }
    if (target.isAdmin && updates.isActive === false) {
      throw new Error("Admin user cannot be disabled");
    }

    return {
      ...current,
      users: current.users.map((user) => {
        if (user.id !== userId) return user;
        return {
          ...user,
          email: updates.email?.trim() ?? user.email,
          firstName: updates.firstName?.trim() ?? user.firstName,
          lastName: updates.lastName?.trim() ?? user.lastName,
          isActive: updates.isActive ?? user.isActive,
          updatedAt: nowIso(),
        };
      }),
    };
  });

  return settings.users.map(sanitizeUser);
}

export async function findAdminUser() {
  const settings = await loadAdminSettings();
  const admin = settings.users.find((user) => user.isAdmin);
  return admin ? sanitizeUser(admin) : null;
}

/**
 * Admin fallback authentication. Regular users authenticate only through
 * Privy; there is no username/password route.
 */
export async function authenticateAdminPassphrase(passphrase?: string) {
  const settings = await loadAdminSettings();
  const adminUser = settings.users.find((user) => user.isAdmin);

  if (passphrase && adminUser && passphrase === settings.auth.securePhrase) {
    return sanitizeUser(adminUser);
  }
  return null;
}
