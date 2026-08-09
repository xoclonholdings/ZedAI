import { createHash } from "crypto";

import { PrivyClient, type User as PrivyUser } from "@privy-io/node";
import { and, eq } from "drizzle-orm";

import { authIdentities, users } from "../../../shared/schema";
import { db } from "../../db";
import type { LocalUser } from "../../local-auth/types";

const PROVIDER = "privy";

export class PrivyAuthError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "PrivyAuthError";
  }
}

export interface PrivyServerConfig {
  appId: string;
  appSecret: string;
}

export interface PrivyAuthDependencies {
  verifyAccessToken: (accessToken: string) => Promise<{ userId: string }>;
  getUser: (userId: string) => Promise<PrivyUser>;
  resolveIdentity: (input: {
    appId: string;
    privyUser: PrivyUser;
    verifiedEmail: string;
  }) => Promise<LocalUser>;
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function hashExternalSubject(appId: string, subject: string): string {
  return createHash("sha256")
    .update(`${PROVIDER}\0${appId}\0${subject}`)
    .digest("hex");
}

function canonicalOwnerId(subjectHash: string): string {
  return `user_privy_${subjectHash.slice(0, 32)}`;
}

function authIdentityId(subjectHash: string): string {
  return `auth_privy_${subjectHash.slice(0, 32)}`;
}

function usernameFromEmail(email: string): string {
  const prefix = email.split("@")[0]?.trim();
  return prefix || "ZAR User";
}

export function readPrivyServerConfig(
  env: NodeJS.ProcessEnv = process.env,
): PrivyServerConfig {
  const appId = (env.VITE_PRIVY_APP_ID || env.PRIVY_APP_ID || "").trim();
  const appSecret = (env.PRIVY_APP_SECRET || "").trim();

  if (!appId || !appSecret) {
    throw new PrivyAuthError("Privy sign-in is not configured", 503);
  }

  return { appId, appSecret };
}

export function readBearerToken(authorization: unknown): string {
  if (typeof authorization !== "string") {
    throw new PrivyAuthError("Privy access token is required", 401);
  }
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() || "";
  if (!token) {
    throw new PrivyAuthError("Privy access token is required", 401);
  }
  return token;
}

export function verifiedEmailFromPrivyUser(user: PrivyUser): string {
  for (const account of user.linked_accounts || []) {
    if (account.type !== "email") continue;
    const email = normalizeEmail(account.address);
    if (email && Number(account.verified_at) > 0) return email;
  }
  throw new PrivyAuthError("A verified email is required for ZAR sign-in", 401);
}

export async function resolvePrivyIdentity(input: {
  appId: string;
  privyUser: PrivyUser;
  verifiedEmail: string;
}): Promise<LocalUser> {
  if (!db) {
    throw new PrivyAuthError("ZAR Identity storage is unavailable", 503);
  }

  const subjectHash = hashExternalSubject(input.appId, input.privyUser.id);
  const now = new Date();
  const [existingIdentity] = await db
    .select()
    .from(authIdentities)
    .where(
      and(
        eq(authIdentities.provider, PROVIDER),
        eq(authIdentities.issuer, input.appId),
        eq(authIdentities.subjectHash, subjectHash),
      ),
    )
    .limit(1);

  if (existingIdentity) {
    const [owner] = await db
      .select()
      .from(users)
      .where(eq(users.id, existingIdentity.userId))
      .limit(1);
    if (!owner) {
      throw new PrivyAuthError("ZAR Identity record is incomplete", 503);
    }
    await db
      .update(authIdentities)
      .set({
        verifiedEmail: input.verifiedEmail,
        lastAuthenticatedAt: now,
        updatedAt: now,
      })
      .where(eq(authIdentities.id, existingIdentity.id));

    return {
      id: owner.id,
      username: usernameFromEmail(input.verifiedEmail),
      email: input.verifiedEmail,
      firstName: owner.firstName || usernameFromEmail(input.verifiedEmail),
      lastName: owner.lastName || "",
      profileImageUrl: owner.profileImageUrl || "",
      isAdmin: false,
      isActive: true,
    };
  }

  const [emailOwner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.verifiedEmail))
    .limit(1);
  const ownerUserId = canonicalOwnerId(subjectHash);
  const displayName = usernameFromEmail(input.verifiedEmail);

  await db.transaction(async (tx) => {
    await tx
      .insert(users)
      .values({
        id: ownerUserId,
        email: emailOwner ? null : input.verifiedEmail,
        firstName: displayName,
        lastName: "",
      })
      .onConflictDoNothing({ target: users.id });

    await tx
      .insert(authIdentities)
      .values({
        id: authIdentityId(subjectHash),
        userId: ownerUserId,
        provider: PROVIDER,
        issuer: input.appId,
        subjectHash,
        verifiedEmail: input.verifiedEmail,
        lastAuthenticatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          authIdentities.provider,
          authIdentities.issuer,
          authIdentities.subjectHash,
        ],
        set: {
          verifiedEmail: input.verifiedEmail,
          lastAuthenticatedAt: now,
          updatedAt: now,
        },
      });
  });

  return {
    id: ownerUserId,
    username: displayName,
    email: input.verifiedEmail,
    firstName: displayName,
    lastName: "",
    profileImageUrl: "",
    isAdmin: false,
    isActive: true,
  };
}

function defaultDependencies(config: PrivyServerConfig): PrivyAuthDependencies {
  const client = new PrivyClient({
    appId: config.appId,
    appSecret: config.appSecret,
  });
  return {
    verifyAccessToken: async (accessToken) => {
      const claims = await client.utils().auth().verifyAccessToken(accessToken);
      return { userId: claims.user_id };
    },
    getUser: (userId) => client.users()._get(userId),
    resolveIdentity: resolvePrivyIdentity,
  };
}

export async function authenticatePrivyAccessToken(
  accessToken: string,
  config: PrivyServerConfig = readPrivyServerConfig(),
  dependencies: PrivyAuthDependencies = defaultDependencies(config),
): Promise<LocalUser> {
  try {
    const claims = await dependencies.verifyAccessToken(accessToken);
    if (!claims.userId) {
      throw new PrivyAuthError("Privy access token is invalid", 401);
    }
    const privyUser = await dependencies.getUser(claims.userId);
    if (!privyUser?.id || privyUser.id !== claims.userId) {
      throw new PrivyAuthError("Privy Identity does not match the session", 401);
    }
    const verifiedEmail = verifiedEmailFromPrivyUser(privyUser);
    return await dependencies.resolveIdentity({
      appId: config.appId,
      privyUser,
      verifiedEmail,
    });
  } catch (error) {
    if (error instanceof PrivyAuthError) throw error;
    throw new PrivyAuthError("Privy sign-in could not be verified", 401);
  }
}
