import session from "express-session";

import { FileSessionStore } from "../services/FileSessionStore";
import { loadAdminSettings } from "../services/AdminSettingsStore";

/**
 * Builds the express-session middleware from admin settings. Cookie
 * security is automatic when FRONTEND_URL is set (hosted cross-origin
 * deploy on Render → cross-site cookies need `secure: true` and
 * `sameSite: "none"`); for local dev it falls back to lax + non-secure.
 */
export async function getSessionMiddleware() {
  const settings = await loadAdminSettings();
  const sessionTtl = settings.auth.sessionTimeoutMinutes * 60 * 1000;
  const frontendOrigin = process.env.FRONTEND_URL?.trim();
  const isHostedCrossOrigin = Boolean(frontendOrigin);

  return session({
    name: "zar.sid",
    proxy: isHostedCrossOrigin,
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
