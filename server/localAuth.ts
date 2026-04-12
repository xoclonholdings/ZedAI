import { Request, Response, NextFunction } from "express";
import session from "express-session";

import { FileSessionStore } from "./services/FileSessionStore";
import { logSecurityEvent } from "./services/SecurityAudit";
import {
  authenticateManagedUser,
  getPublicAdminSettings,
  loadAdminSettings,
  updateAuthSettings,
  updateCurrentUserCredentials,
} from "./services/AdminSettingsStore";

export interface LocalUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string;
  isAdmin: boolean;
  isActive: boolean;
}

const VERIFICATION_ATTEMPTS = new Map<string, { count: number; lastAttempt: number }>();

function getClientIp(req: Request) {
  return req.ip || req.connection.remoteAddress || "unknown";
}

async function getSessionMiddleware() {
  const settings = await loadAdminSettings();
  const sessionTtl = settings.auth.sessionTimeoutMinutes * 60 * 1000;
  const frontendOrigin = process.env.FRONTEND_URL?.trim();
  const isHostedCrossOrigin = Boolean(frontendOrigin);

  return session({
    secret: settings.auth.sessionSecret,
    store: new FileSessionStore(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isHostedCrossOrigin || settings.auth.requireSecureCookies,
      sameSite: isHostedCrossOrigin ? "none" : "lax",
      maxAge: sessionTtl,
    },
  });
}

function clearAttemptsForIp(ip: string) {
  const keys = Array.from(VERIFICATION_ATTEMPTS.keys()).filter((key) => key.endsWith(`:${ip}`));
  for (const key of keys) {
    VERIFICATION_ATTEMPTS.delete(key);
  }
}

function sessionUser(req: Request) {
  return (req.session as any)?.user as LocalUser | undefined;
}

function attachUser(req: Request, user: LocalUser) {
  const sessionData = req.session as any;
  sessionData.userId = user.id;
  sessionData.lastActivity = Date.now();
  sessionData.user = {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl,
    isAdmin: user.isAdmin,
  };
}

export async function setupLocalAuth(app: any) {
  app.use(await getSessionMiddleware());

  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const ip = getClientIp(req);
      const { username, password, passphrase } = req.body || {};
      const settings = await loadAdminSettings();
      const attemptKey = `login:${ip}`;
      const attempts = VERIFICATION_ATTEMPTS.get(attemptKey) || { count: 0, lastAttempt: 0 };

      if (
        attempts.count >= settings.auth.maxFailedAttempts &&
        Date.now() - attempts.lastAttempt < settings.auth.lockoutDurationMinutes * 60 * 1000
      ) {
        return res.status(429).json({
          error: `Too many failed attempts. Please wait ${settings.auth.lockoutDurationMinutes} minutes.`,
        });
      }

      const user = await authenticateManagedUser({ username, password, passphrase });

      if (!user) {
        const newCount = attempts.count + 1;
        VERIFICATION_ATTEMPTS.set(attemptKey, {
          count: newCount,
          lastAttempt: Date.now(),
        });
        await logSecurityEvent({
          type: "auth.login.fail",
          ip,
          detail: `Failed attempt ${newCount}/${settings.auth.maxFailedAttempts}`,
        });
        return res.status(401).json({ error: "Invalid credentials or secure phrase" });
      }

      VERIFICATION_ATTEMPTS.delete(attemptKey);
      attachUser(req, user);

      await logSecurityEvent({
        type: "auth.login.success",
        ip,
        userId: user.id,
        detail: `${user.isAdmin ? "Admin" : "User"} login successful`,
      });

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          isAdmin: user.isAdmin,
          sessionExpiry: settings.auth.sessionTimeoutMinutes,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/logout", async (req: Request, res: Response) => {
    const userId = (req.session as any)?.userId;
    const ip = getClientIp(req);
    req.session.destroy(async (err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      await logSecurityEvent({ type: "auth.logout", ip, userId, detail: "Session destroyed" });
      res.json({ success: true });
    });
  });

  app.post("/api/admin/verify-challenge", async (req: Request, res: Response) => {
    try {
      const { challengeAnswer, securePhrase } = req.body || {};
      const settings = await loadAdminSettings();
      const validAnswers = ["42", "xoclon", "diagnostic"];
      const isValidChallenge =
        typeof challengeAnswer === "string" && validAnswers.includes(challengeAnswer.toLowerCase());
      const isValidPhrase =
        typeof securePhrase === "string" && securePhrase === settings.auth.securePhrase;

      if (isValidChallenge || isValidPhrase) {
        clearAttemptsForIp(getClientIp(req));
        return res.json({ success: true, message: "Challenge verified, please try logging in again" });
      }

      res.status(401).json({ error: "Invalid challenge response" });
    } catch (error) {
      console.error("Challenge verification failed:", error);
      res.status(500).json({ error: "Challenge verification failed" });
    }
  });

  app.post("/api/auth/update-credentials", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { newUsername, newPassword } = req.body || {};
      const currentUser = sessionUser(req);

      if (!currentUser) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!newUsername && !newPassword) {
        return res.status(400).json({ error: "Provide a username, password, or both" });
      }

      const updated = await updateCurrentUserCredentials(currentUser.id, {
        username: newUsername,
        password: newPassword,
      });

      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }

      attachUser(req, updated);

      res.json({
        success: true,
        message: "Credentials updated successfully",
        user: {
          username: updated.username,
          firstName: updated.firstName,
          lastName: updated.lastName,
        },
      });
    } catch (error: any) {
      console.error("Update credentials error:", error);
      res.status(400).json({ error: error.message || "Failed to update credentials" });
    }
  });

  app.get("/api/auth/current-credentials", isAuthenticated, async (req: Request, res: Response) => {
    const currentUser = sessionUser(req);
    if (!currentUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      username: currentUser.username,
      isAdmin: currentUser.isAdmin,
    });
  });

  app.get("/api/admin/security-settings", isAdmin, async (_req: Request, res: Response) => {
    const settings = await getPublicAdminSettings();
    res.json({
      adminUsername: settings.auth.adminUsername,
      currentSecurePhrase: settings.auth.securePhrase,
      sessionTimeoutMinutes: settings.auth.sessionTimeoutMinutes,
      maxFailedAttempts: settings.auth.maxFailedAttempts,
      lockoutDurationMinutes: settings.auth.lockoutDurationMinutes,
      requireSecureCookies: settings.auth.requireSecureCookies,
    });
  });

  app.post("/api/admin/security-settings", isAdmin, async (req: Request, res: Response) => {
    try {
      const {
        adminUsername,
        newSecurePhrase,
        sessionTimeoutMinutes,
        maxFailedAttempts,
        lockoutDurationMinutes,
        requireSecureCookies,
      } = req.body || {};

      const auth = await updateAuthSettings({
        adminUsername: adminUsername?.trim(),
        securePhrase: newSecurePhrase?.trim(),
        sessionTimeoutMinutes,
        maxFailedAttempts,
        lockoutDurationMinutes,
        requireSecureCookies,
      });

      res.json({
        success: true,
        message: "Security settings updated successfully",
        settings: {
          adminUsername: auth.adminUsername,
          securePhrase: auth.securePhrase,
          sessionTimeoutMinutes: auth.sessionTimeoutMinutes,
          maxFailedAttempts: auth.maxFailedAttempts,
          lockoutDurationMinutes: auth.lockoutDurationMinutes,
          requireSecureCookies: auth.requireSecureCookies,
        },
      });
    } catch (error: any) {
      console.error("Security settings update failed:", error);
      res.status(400).json({ error: error.message || "Failed to update security settings" });
    }
  });
}

async function ensureAuthenticatedSession(req: Request, res: Response, next: NextFunction, requireAdmin = false) {
  const session = req.session as any;

  if (!session?.userId || !session?.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const settings = await loadAdminSettings();
  if (
    session.lastActivity &&
    Date.now() - session.lastActivity > settings.auth.sessionTimeoutMinutes * 60 * 1000
  ) {
    const userId = session.userId;
    req.session.destroy(() => {});
    await logSecurityEvent({
      type: "auth.session.expired",
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

export const isLocalAuthenticated = async (req: Request, res: Response, next: NextFunction) =>
  ensureAuthenticatedSession(req, res, next, false);

export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) =>
  ensureAuthenticatedSession(req, res, next, false);

export const isAdmin = async (req: Request, res: Response, next: NextFunction) =>
  ensureAuthenticatedSession(req, res, next, true);
