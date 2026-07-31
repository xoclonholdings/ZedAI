import type { Express } from "express";

import { isAdmin } from "../localAuth";
import { updateIntegrationSettings } from "../services/AdminSettingsStore";
import {
  cancelPendingSignIn,
  finalizeAfterHandoff,
  getPendingCredentials,
  startSignIn,
  submitVerificationCode,
} from "../services/browserAuth/BrowserSignInService";
import { getLoginProfile } from "../services/browserAuth/loginProfiles";
import { mintHandoffTicket } from "../services/browserAuth/liveHandoffSocket";

/**
 * Credential-based sign-in: for providers with no paste-a-token path,
 * ZAR drives a real browser to log in with a username/password
 * (autofill-style) and keeps the resulting session.
 *
 * start   → submits credentials; comes back success, needing a
 *           verification code, or needing a human to take over
 *           (CAPTCHA / unrecognized page).
 * verify  → submits a verification code.
 * handoff/ticket + handoff/finalize → the human-takeover path: mint a
 *           one-time ticket for the live WebSocket view, then once
 *           they've finished, re-check the page and capture the
 *           session if it now shows signed in.
 * cancel  → abandon a stuck attempt.
 */

const SOCIAL_PLATFORMS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
};

async function persistSocialSession(
  provider: string,
  username: string,
  password: string,
  sessionState: string,
) {
  const label = SOCIAL_PLATFORMS[provider];
  if (!label) return;
  await updateIntegrationSettings({
    socialPublishing: {
      accounts: [
        {
          id: `social-${provider}`,
          label,
          platform: provider,
          authMethod: "credentials",
          accessToken: "",
          username,
          password,
          sessionState,
        },
      ],
    } as any,
  });
}

function stripSessionState<T extends { sessionState?: string }>(result: T) {
  const { sessionState: _omit, ...rest } = result;
  return rest;
}

export function registerBrowserSignInRoutes(app: Express): void {
  app.post("/api/admin/integrations/:provider/signin/start", isAdmin, async (req, res) => {
    const provider = String(req.params.provider);
    const { username, password } = req.body || {};

    if (!getLoginProfile(provider)) {
      return res.status(404).json({ error: `No sign-in flow is set up for "${provider}" yet.` });
    }
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are both required." });
    }

    const result = await startSignIn(provider, username, password);
    if (result.status === "success" && result.sessionState) {
      await persistSocialSession(provider, username, password, result.sessionState);
    }
    res.json(stripSessionState(result));
  });

  app.post("/api/admin/integrations/:provider/signin/verify", isAdmin, async (req, res) => {
    const { pendingId, code } = req.body || {};
    if (!pendingId || !code) {
      return res.status(400).json({ error: "pendingId and code are both required." });
    }

    const creds = getPendingCredentials(pendingId);
    const result = await submitVerificationCode(pendingId, code);
    if (result.status === "success" && result.sessionState && creds) {
      await persistSocialSession(creds.provider, creds.username, creds.password, result.sessionState);
    }
    res.json(stripSessionState(result));
  });

  app.post("/api/admin/integrations/:provider/signin/handoff/ticket", isAdmin, async (req, res) => {
    const { pendingId } = req.body || {};
    if (!pendingId) {
      return res.status(400).json({ error: "pendingId is required." });
    }
    const ticket = mintHandoffTicket(pendingId);
    if (!ticket) {
      return res.status(404).json({ error: "This sign-in attempt is no longer active." });
    }
    res.json({ ticket: ticket.ticket, wsPath: "/ws/admin/signin-handoff", expiresAt: ticket.expiresAt });
  });

  app.post("/api/admin/integrations/:provider/signin/handoff/finalize", isAdmin, async (req, res) => {
    const { pendingId } = req.body || {};
    if (!pendingId) {
      return res.status(400).json({ error: "pendingId is required." });
    }
    const creds = getPendingCredentials(pendingId);
    const result = await finalizeAfterHandoff(pendingId);
    if (result.status === "success" && result.sessionState && creds) {
      await persistSocialSession(creds.provider, creds.username, creds.password, result.sessionState);
    }
    res.json(stripSessionState(result));
  });

  app.post("/api/admin/integrations/:provider/signin/cancel", isAdmin, async (req, res) => {
    const { pendingId } = req.body || {};
    if (pendingId) cancelPendingSignIn(pendingId);
    res.json({ ok: true });
  });
}
