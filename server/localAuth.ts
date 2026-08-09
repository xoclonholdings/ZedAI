import type { Express } from "express";

import { getSessionMiddleware } from "./local-auth/session-middleware";
import { registerLoginRoutes } from "./local-auth/routes-login";
import { registerPrivyAuthRoutes } from "./local-auth/routes-privy";
import { registerAdminOtpRoutes } from "./local-auth/routes-admin-otp";
import { registerCredentialRoutes } from "./local-auth/routes-credentials";
import { registerSecuritySettingsRoutes } from "./local-auth/routes-security-settings";

/**
 * Local auth entry point. Splits into focused modules under
 * ./local-auth/:
 *
 *   types.ts                       LocalUser shape
 *   session-helpers.ts             attempt-counter map, IP extractor,
 *                                  sessionUser/attachUser
 *   session-middleware.ts          express-session config from
 *                                  admin settings (cookie hardening
 *                                  for hosted deploys)
 *   middleware.ts                  ensureAuthenticatedSession +
 *                                  isAuthenticated / isAdmin /
 *                                  isLocalAuthenticated guards
 *   routes-login.ts                /api/login + /api/logout
 *   routes-admin-otp.ts            admin email OTP flow
 *   routes-credentials.ts          challenge unlock + self-service
 *                                  credential update
 *   routes-security-settings.ts    admin security settings GET + POST
 *
 * This file re-exports the middleware so existing route imports
 * (`from "./localAuth"` or `"../localAuth"`) keep working.
 */

export type { LocalUser } from "./local-auth/types";
export {
  isAdmin,
  isAuthenticated,
  isLocalAuthenticated,
} from "./local-auth/middleware";

export async function setupLocalAuth(app: Express): Promise<void> {
  app.use(await getSessionMiddleware());

  registerPrivyAuthRoutes(app);
  registerLoginRoutes(app);
  registerAdminOtpRoutes(app);
  registerCredentialRoutes(app);
  registerSecuritySettingsRoutes(app);
}
