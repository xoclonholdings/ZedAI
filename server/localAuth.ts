import type { Express } from "express";

import { getSessionMiddleware } from "./local-auth/session-middleware";
import { registerLoginRoutes } from "./local-auth/routes-login";
import { registerPrivyAuthRoutes } from "./local-auth/routes-privy";
import { registerAdminOtpRoutes } from "./local-auth/routes-admin-otp";
import { registerCredentialRoutes } from "./local-auth/routes-credentials";
import { registerSecuritySettingsRoutes } from "./local-auth/routes-security-settings";
import { registerZcosSsoRoutes } from "./local-auth/routes-zcos-sso";

/**
 * Local auth entry point. ZCOS is the universal identity authority; this
 * service keeps a local runtime session only as a projection of that identity.
 */

export type { LocalUser } from "./local-auth/types";
export {
  isAdmin,
  isAuthenticated,
  isLocalAuthenticated,
} from "./local-auth/middleware";

export async function setupLocalAuth(app: Express): Promise<void> {
  app.use(await getSessionMiddleware());

  registerZcosSsoRoutes(app);
  registerPrivyAuthRoutes(app);
  registerLoginRoutes(app);
  registerAdminOtpRoutes(app);
  registerCredentialRoutes(app);
  registerSecuritySettingsRoutes(app);
}
