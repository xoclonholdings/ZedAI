import type { NextFunction, Request, Response } from "express";

import { loadAdminSettings } from "../services/AdminSettingsStore";
import { logSecurityEvent } from "../services/SecurityAudit";
import {
  createOwnerContext,
  OwnerContextError,
} from "../services/auth/OwnerContext";

import { getClientIp } from "./session-helpers";

/**
 * Core guard used by isAuthenticated / isAdmin. Verifies the session
 * is present, hasn't idled out, then attaches `req.user.claims` in
 * the shape every downstream handler reads (sub / username / isAdmin).
 *
 * Idle-timeout is computed against the admin settings every request
 * so changes via /api/admin/security-settings take effect on the
 * next call — no restart required.
 */
async function ensureAuthenticatedSession(
  req: Request,
  res: Response,
  next: NextFunction,
  requireAdmin = false,
) {
  const session = req.session as any;

  if (!session?.userId || !session?.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    createOwnerContext(session.userId);
  } catch (error) {
    if (error instanceof OwnerContextError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    throw error;
  }

  const settings = await loadAdminSettings();
  if (
    session.lastActivity &&
    Date.now() - session.lastActivity >
      settings.auth.sessionTimeoutMinutes * 60 * 1000
  ) {
    const userId = session.userId;
    req.session.destroy(() => {
      /* destroy() needs a callback even when we ignore the result */
    });
    await logSecurityEvent({
      type: "auth.session_expired",
      userId,
      ip: getClientIp(req),
      detail: "Session timed out",
    });
    return res.status(401).json({ message: "Session expired" });
  }

  session.lastActivity = Date.now();

  if (requireAdmin && !session.user.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }

  (req as any).user = {
    claims: {
      sub: session.userId,
      username: session.user.username,
      isAdmin: session.user.isAdmin,
    },
  };

  next();
}

export const isLocalAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => ensureAuthenticatedSession(req, res, next, false);

export const isAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => ensureAuthenticatedSession(req, res, next, false);

export const isAdmin = async (req: Request, res: Response, next: NextFunction) =>
  ensureAuthenticatedSession(req, res, next, true);
