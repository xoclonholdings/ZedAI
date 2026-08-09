import type { Request } from "express";

export const PROHIBITED_OWNER_IDS = new Set([
  "user",
  "user_001",
  "default-user",
  "anonymous",
  "admin-user",
  "unknown",
]);

export interface OwnerContext {
  ownerUserId: string;
  source: "authenticated_session";
}

export class OwnerContextError extends Error {
  readonly statusCode = 401;

  constructor(message = "Authenticated owner is required") {
    super(message);
    this.name = "OwnerContextError";
  }
}

export function createOwnerContext(ownerUserId: unknown): OwnerContext {
  const normalized = typeof ownerUserId === "string" ? ownerUserId.trim() : "";
  if (!normalized || PROHIBITED_OWNER_IDS.has(normalized.toLowerCase())) {
    throw new OwnerContextError();
  }
  return {
    ownerUserId: normalized,
    source: "authenticated_session",
  };
}

export function ownerContextFromAuthenticatedRequest(req: Request): OwnerContext {
  return createOwnerContext((req as any)?.user?.claims?.sub);
}

export function assertOwnerContext(value: unknown): asserts value is OwnerContext {
  const candidate = value as OwnerContext | null | undefined;
  if (
    !candidate ||
    candidate.source !== "authenticated_session" ||
    createOwnerContext(candidate.ownerUserId).ownerUserId !== candidate.ownerUserId
  ) {
    throw new OwnerContextError();
  }
}
