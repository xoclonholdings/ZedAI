import fs from "fs/promises";
import path from "path";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

import type {
  AdminSettings,
  AppSettings,
  AuthSettings,
  IntegrationsSettings,
  ManagedUser,
  PersonalizationSettings,
  PublicManagedUser,
} from "../../shared/adminSettings";
import {
  defaultAgentDefinitions,
  defaultAppSettings,
  defaultIntegrations,
  defaultPersonalizationSettings,
} from "../../shared/adminSettings";
import { HUB_CONFIG_DIR } from "../utils/repoPaths";

const SETTINGS_PATH = path.join(HUB_CONFIG_DIR, "admin-settings.json");
const REQUIRED_PRODUCTION_ENV_VARS = [
  "ZED_ADMIN_USERNAME",
  "ZED_ADMIN_SECURE_PHRASE",
  "ZED_ADMIN_PASSWORD",
  "SESSION_SECRET",
] as const;

function nowIso() {
  return new Date().toISOString();
}

function isProductionEnvironment() {
  return process.env.NODE_ENV === "production";
}

function requireProductionEnv(name: (typeof REQUIRED_PRODUCTION_ENV_VARS)[number]) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be set in production`);
  }
  return value;
}

function getEnvOrDevelopmentDefault(name: string, developmentDefault: string) {
  const value = process.env[name]?.trim();
  if (value) {
    return value;
  }

  if (isProductionEnvironment()) {
    throw new Error(`${name} must be set in production`);
  }

  return developmentDefault;
}

function defaultAuthSettings(): AuthSettings {
  return {
    adminUsername: getEnvOrDevelopmentDefault("ZED_ADMIN_USERNAME", "LocalAdmin"),
    securePhrase: getEnvOrDevelopmentDefault("ZED_ADMIN_SECURE_PHRASE", "LOCAL-DEV-SECURE-PHRASE"),
    sessionTimeoutMinutes: 45,
    maxFailedAttempts: 3,
    lockoutDurationMinutes: 15,
    requireSecureCookies: process.env.NODE_ENV === "production",
    sessionSecret: isProductionEnvironment()
      ? requireProductionEnv("SESSION_SECRET")
      : process.env.SESSION_SECRET || randomBytes(24).toString("hex"),
  };
}

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { passwordHash: hash, passwordSalt: salt };
}

function verifyPassword(password: string, passwordHash?: string, passwordSalt?: string) {
  if (!passwordHash || !passwordSalt) return false;
  const incoming = scryptSync(password, passwordSalt, 64);
  const stored = Buffer.from(passwordHash, "hex");
  return incoming.length === stored.length && timingSafeEqual(incoming, stored);
}

function createDefaultAdminUser(auth: AuthSettings): ManagedUser {
  const timestamp = nowIso();
  const bootstrapPassword = getEnvOrDevelopmentDefault("ZED_ADMIN_PASSWORD", "LocalDevPassword!234");
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

function sanitizeUser(user: ManagedUser): PublicManagedUser {
  const { passwordHash: _passwordHash, passwordSalt: _passwordSalt, ...safe } = user;
  return safe;
}

function normalizeUsers(auth: AuthSettings, users: ManagedUser[] | undefined): ManagedUser[] {
  const existing = Array.isArray(users) ? users : [];
  const admin = existing.find((user) => user.isAdmin) || createDefaultAdminUser(auth);

  const adminUpdated = {
    ...admin,
    username: auth.adminUsername,
    // Force the admin email to the hardcoded canonical value so older
    // settings files (admin@zed-ai.local) get migrated forward without
    // an explicit migration script.
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

function mergeSettings(raw: Partial<AdminSettings> | null | undefined): AdminSettings {
  const auth = {
    ...defaultAuthSettings(),
    ...(raw?.auth || {}),
  };

  return {
    auth,
    app: {
      ...defaultAppSettings,
      ...(raw?.app || {}),
    },
    personalization: {
      ...defaultPersonalizationSettings,
      ...(raw?.personalization || {}),
    },
    agents: raw?.agents?.length ? raw.agents : defaultAgentDefinitions,
    integrations: {
      ...defaultIntegrations,
      ...(raw?.integrations || {}),
      gusto: {
        ...defaultIntegrations.gusto,
        ...(raw?.integrations?.gusto || {}),
      },
      github: {
        ...defaultIntegrations.github,
        ...(raw?.integrations?.github || {}),
        hasToken: !!(raw?.integrations?.github?.token || raw?.integrations?.github?.hasToken),
      },
      email: {
        ...defaultIntegrations.email,
        ...(raw?.integrations?.email || {}),
        hasPassword: !!(raw?.integrations?.email?.password || raw?.integrations?.email?.hasPassword),
      },
      telephony: {
        ...defaultIntegrations.telephony,
        ...(raw?.integrations?.telephony || {}),
        hasApiKey: !!(raw?.integrations?.telephony?.apiKey || raw?.integrations?.telephony?.hasApiKey),
      },
      firewall: {
        ...defaultIntegrations.firewall,
        ...(raw?.integrations?.firewall || {}),
        hasAuthToken: !!(raw?.integrations?.firewall?.authToken || raw?.integrations?.firewall?.hasAuthToken),
      },
      businessOperations: {
        ...defaultIntegrations.businessOperations,
        ...(raw?.integrations?.businessOperations || {}),
      },
      kalshi: {
        ...defaultIntegrations.kalshi,
        ...(raw?.integrations?.kalshi || {}),
      },
      voiceTranscription: {
        ...defaultIntegrations.voiceTranscription,
        ...(raw?.integrations?.voiceTranscription || {}),
      },
    },
    users: normalizeUsers(auth, raw?.users),
  };
}

async function writeSettings(settings: AdminSettings) {
  await fs.mkdir(HUB_CONFIG_DIR, { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}

function assertProductionEnvConfiguration() {
  if (!isProductionEnvironment()) {
    return;
  }

  for (const name of REQUIRED_PRODUCTION_ENV_VARS) {
    requireProductionEnv(name);
  }
}

export async function loadAdminSettings(): Promise<AdminSettings> {
  assertProductionEnvConfiguration();
  try {
    const raw = await fs.readFile(SETTINGS_PATH, "utf-8");
    const settings = mergeSettings(JSON.parse(raw));
    await writeSettings(settings);
    return settings;
  } catch {
    const settings = mergeSettings(undefined);
    await writeSettings(settings);
    return settings;
  }
}

export async function updateAdminSettings(
  updater: (current: AdminSettings) => AdminSettings | Promise<AdminSettings>,
) {
  const current = await loadAdminSettings();
  const next = mergeSettings(await updater(current));
  await writeSettings(next);
  return next;
}

export async function updateAppSettings(nextApp: Partial<AppSettings>) {
  const settings = await updateAdminSettings((current) => ({
    ...current,
    app: { ...current.app, ...nextApp },
  }));
  return settings.app;
}

export async function resetAppSettings() {
  const settings = await updateAdminSettings((current) => ({
    ...current,
    app: { ...defaultAppSettings },
    personalization: { ...defaultPersonalizationSettings },
  }));
  return { app: settings.app, personalization: settings.personalization };
}

export async function updatePersonalizationSettings(nextPersonalization: Partial<PersonalizationSettings>) {
  const settings = await updateAdminSettings((current) => ({
    ...current,
    personalization: { ...current.personalization, ...nextPersonalization },
  }));
  return settings.personalization;
}

export async function updateIntegrationSettings(nextIntegrations: Partial<IntegrationsSettings>) {
  const settings = await updateAdminSettings((current) => ({
    ...current,
    integrations: {
      ...current.integrations,
      ...nextIntegrations,
      gusto: {
        ...current.integrations.gusto,
        ...(nextIntegrations.gusto || {}),
      },
      github: {
        ...current.integrations.github,
        ...(nextIntegrations.github || {}),
        token:
          nextIntegrations.github && "token" in nextIntegrations.github
            ? nextIntegrations.github.token || current.integrations.github.token
            : current.integrations.github.token,
      },
      email: {
        ...current.integrations.email,
        ...(nextIntegrations.email || {}),
        password:
          nextIntegrations.email && "password" in nextIntegrations.email
            ? nextIntegrations.email.password || current.integrations.email.password
            : current.integrations.email.password,
      },
      telephony: {
        ...current.integrations.telephony,
        ...(nextIntegrations.telephony || {}),
        apiKey:
          nextIntegrations.telephony && "apiKey" in nextIntegrations.telephony
            ? nextIntegrations.telephony.apiKey || current.integrations.telephony.apiKey
            : current.integrations.telephony.apiKey,
      },
      firewall: {
        ...current.integrations.firewall,
        ...(nextIntegrations.firewall || {}),
        authToken:
          nextIntegrations.firewall && "authToken" in nextIntegrations.firewall
            ? nextIntegrations.firewall.authToken || current.integrations.firewall.authToken
            : current.integrations.firewall.authToken,
      },
      businessOperations: {
        ...current.integrations.businessOperations,
        ...(nextIntegrations.businessOperations || {}),
      },
      kalshi: {
        ...current.integrations.kalshi,
        ...(nextIntegrations.kalshi || {}),
      },
      voiceTranscription: {
        ...current.integrations.voiceTranscription,
        ...(nextIntegrations.voiceTranscription || {}),
      },
    },
  }));
  return settings.integrations;
}

export async function updateAuthSettings(nextAuth: Partial<AuthSettings>) {
  const settings = await updateAdminSettings((current) => {
    const sanitized = Object.fromEntries(
      Object.entries(nextAuth).filter(([, value]) => value !== undefined && value !== null && value !== ""),
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

    if (current.users.some((user) => user.username.toLowerCase() === normalizedUsername.toLowerCase())) {
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
      current.users.some((user) => user.id !== userId && user.username.toLowerCase() === username.toLowerCase())
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

export async function updateCurrentUserCredentials(userId: string, input: { username?: string; password?: string }) {
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

export async function getPublicAdminSettings() {
  const settings = await loadAdminSettings();
  return {
    ...settings,
    integrations: {
      ...settings.integrations,
      github: {
        ...settings.integrations.github,
        token: "",
        hasToken: !!settings.integrations.github.token,
      },
      email: {
        ...settings.integrations.email,
        password: "",
        hasPassword: !!settings.integrations.email.password,
      },
      telephony: {
        ...settings.integrations.telephony,
        apiKey: "",
        hasApiKey: !!settings.integrations.telephony.apiKey,
      },
      firewall: {
        ...settings.integrations.firewall,
        authToken: "",
        hasAuthToken: !!settings.integrations.firewall.authToken,
      },
    },
    users: settings.users.map(sanitizeUser),
  };
}
