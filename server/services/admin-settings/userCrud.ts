import { randomBytes } from "crypto";

import type { AuthSettings, ManagedUser } from "../../../shared/adminSettings";

import { hashPassword, sanitizeUser, verifyPassword } from "./auth-helpers";
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
      users: current.users.map((user) =>
        user.isAdmin
          ? {
              ...user,
              username: auth.adminUsername,
              updatedAt: nowIso(),
            }
          : user,
      ),
    };
  });
  return settings.auth;
}

export async function listManagedUsers() {
  const settings = await loadAdminSettings();
  return settings.users.map(sanitizeUser);
}

export async function createManagedUser(input: {
  username: string;
  password: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}) {
  const settings = await updateAdminSettings((current) => {
    const timestamp = nowIso();
    const normalizedUsername = input.username.trim();

    if (!normalizedUsername) {
      throw new Error("Username is required");
    }
    if (!input.password || input.password.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }

    if (
      current.users.some(
        (user) => user.username.toLowerCase() === normalizedUsername.toLowerCase(),
      )
    ) {
      throw new Error("Username already exists");
    }

    const nextUser: ManagedUser = {
      id: `user_${randomBytes(6).toString("hex")}`,
      username: normalizedUsername,
      email: input.email?.trim() || `${normalizedUsername.toLowerCase()}@zed-ai.local`,
      firstName: input.firstName?.trim() || normalizedUsername,
      lastName: input.lastName?.trim() || "User",
      profileImageUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(normalizedUsername)}`,
      isAdmin: false,
      isActive: true,
      ...hashPassword(input.password),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    return {
      ...current,
      users: [...current.users, nextUser],
    };
  });

  return settings.users.map(sanitizeUser);
}

export async function updateManagedUser(
  userId: string,
  updates: {
    username?: string;
    password?: string;
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

    const username = updates.username?.trim();
    if (
      username &&
      current.users.some(
        (user) =>
          user.id !== userId && user.username.toLowerCase() === username.toLowerCase(),
      )
    ) {
      throw new Error("Username already exists");
    }
    if (updates.password && updates.password.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }

    return {
      ...current,
      users: current.users.map((user) => {
        if (user.id !== userId) return user;
        const next = {
          ...user,
          username: username || user.username,
          email: updates.email?.trim() ?? user.email,
          firstName: updates.firstName?.trim() ?? user.firstName,
          lastName: updates.lastName?.trim() ?? user.lastName,
          isActive: updates.isActive ?? user.isActive,
          updatedAt: nowIso(),
        };
        if (updates.password) {
          Object.assign(next, hashPassword(updates.password));
        }
        return next;
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
 * Two login paths: the admin secure phrase (admin user only), or
 * a regular username + password (any active user). Returns the
 * sanitized user on success, null on any failure.
 */
export async function authenticateManagedUser(input: {
  username?: string;
  password?: string;
  passphrase?: string;
}) {
  const settings = await loadAdminSettings();
  const adminUser = settings.users.find((user) => user.isAdmin);

  if (input.passphrase && adminUser && input.passphrase === settings.auth.securePhrase) {
    return sanitizeUser(adminUser);
  }

  if (!input.username || !input.password) {
    return null;
  }

  const user = settings.users.find(
    (entry) => entry.username.toLowerCase() === input.username?.trim().toLowerCase(),
  );

  if (!user || !user.isActive) {
    return null;
  }

  if (!verifyPassword(input.password, user.passwordHash, user.passwordSalt)) {
    return null;
  }

  return sanitizeUser(user);
}

export async function updateCurrentUserCredentials(
  userId: string,
  input: { username?: string; password?: string },
) {
  const settings = await updateAdminSettings((current) => ({
    ...current,
    users: current.users.map((user) => {
      if (user.id !== userId) return user;
      const next = {
        ...user,
        username: input.username?.trim() || user.username,
        updatedAt: nowIso(),
      };
      if (input.password) {
        Object.assign(next, hashPassword(input.password));
      }
      return next;
    }),
  }));

  const updated = settings.users.find((user) => user.id === userId);
  return updated ? sanitizeUser(updated) : null;
}
