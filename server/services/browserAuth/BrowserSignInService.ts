import fs from "fs";
import path from "path";
import { chromium, type Browser, type BrowserContext, type CDPSession, type Page } from "playwright-core";

import { getLoginProfile, type LoginProfile } from "./loginProfiles";

/**
 * Signs into a service the way a password manager's autofill does —
 * ZAR drives a real (headless) browser, types the username and
 * password into the service's own login form, and submits it. The
 * resulting session (cookies + local storage) is handed back so the
 * caller can store it and reuse it later without logging in again.
 *
 * This is deliberately NOT a password-grant API call: it goes through
 * the exact same login page a human would use, because that's the
 * only path that's actually reachable — these providers don't expose
 * a programmatic "here's a username and password, give me a session"
 * endpoint. If the provider throws up a verification step (an SMS
 * code, an email code, "approve this device"), sign-in pauses and
 * hands back a screenshot + a pendingId so the human can supply that
 * one-time code.
 *
 * If ZAR hits something it doesn't recognize at all — a CAPTCHA, a
 * redesigned login page, anything the selectors above weren't built
 * for — it doesn't just fail. It hands the exact same live browser
 * over to the human (see LiveHandoffService) so they can finish
 * whatever's on screen themselves, then ZAR picks the session back up
 * from wherever they left it.
 */

interface PendingSignIn {
  id: string;
  provider: string;
  username: string;
  browser: Browser;
  context: BrowserContext;
  page: Page;
  createdAt: number;
  cdpSession?: CDPSession;
  liveHandoffActive?: boolean;
}

export interface SignInResult {
  status: "success" | "verification_required" | "human_required" | "error";
  sessionState?: string;
  pendingId?: string;
  screenshotBase64?: string;
  prompt?: string;
  message?: string;
}

const pendingSignIns = new Map<string, PendingSignIn>();
const PENDING_TTL_MS = 5 * 60 * 1000;

function sweepStalePendingSignIns() {
  const now = Date.now();
  for (const [id, entry] of pendingSignIns) {
    // A human actively driving the live hand-off shouldn't get swept
    // out from under them just because the original TTL elapsed.
    if (entry.liveHandoffActive) continue;
    if (now - entry.createdAt > PENDING_TTL_MS) {
      void entry.browser.close().catch(() => {});
      pendingSignIns.delete(id);
    }
  }
}
// Only run the sweep in a long-lived server process, not in one-off scripts.
if (typeof setInterval === "function") {
  setInterval(sweepStalePendingSignIns, 60_000).unref?.();
}

/**
 * The installed Chromium isn't necessarily the exact revision this
 * playwright-core version expects, so resolve the executable
 * directly under PLAYWRIGHT_BROWSERS_PATH instead of relying on
 * playwright's own version-matched auto-download/lookup.
 */
function resolveChromiumExecutable(): string | undefined {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base) return undefined;
  try {
    const entries = fs.readdirSync(base).filter((entry) => entry.startsWith("chromium-"));
    if (entries.length === 0) return undefined;
    const dir = entries.sort().reverse()[0];
    const exe = path.join(base, dir, "chrome-linux", "chrome");
    return fs.existsSync(exe) ? exe : undefined;
  } catch {
    return undefined;
  }
}

async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    executablePath: resolveChromiumExecutable(),
  });
}

async function waitForOutcome(
  page: Page,
  profile: LoginProfile,
  timeoutMs = 25_000,
): Promise<"success" | "verification_required" | "error" | "unknown"> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (page.isClosed()) return "unknown";
    for (const sel of profile.successSelectors) {
      if (await page.locator(sel).first().count().catch(() => 0)) return "success";
    }
    for (const sel of profile.verificationSelectors) {
      if (await page.locator(sel).first().count().catch(() => 0)) return "verification_required";
    }
    for (const sel of profile.errorSelectors) {
      if (await page.locator(sel).first().count().catch(() => 0)) return "error";
    }
    await page.waitForTimeout(500);
  }
  return "unknown";
}

async function screenshotBase64(page: Page): Promise<string | undefined> {
  try {
    return (await page.screenshot()).toString("base64");
  } catch {
    return undefined;
  }
}

export async function startSignIn(
  provider: string,
  username: string,
  password: string,
): Promise<SignInResult> {
  const profile = getLoginProfile(provider);
  if (!profile) {
    return { status: "error", message: `No sign-in flow is set up for "${provider}" yet.` };
  }

  sweepStalePendingSignIns();

  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(profile.loginUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

    await page.locator(profile.usernameSelector).first().fill(username, { timeout: 15_000 });
    if (profile.usernameNextSelector) {
      await page.locator(profile.usernameNextSelector).first().click({ timeout: 15_000 });
      await page.waitForTimeout(1500);
    }
    await page.locator(profile.passwordSelector).first().fill(password, { timeout: 15_000 });
    await page.locator(profile.submitSelector).first().click({ timeout: 15_000 });

    const outcome = await waitForOutcome(page, profile);

    if (outcome === "success") {
      const sessionState = JSON.stringify(await context.storageState());
      await browser.close();
      return { status: "success", sessionState };
    }

    if (outcome === "verification_required") {
      const pendingId = `${provider}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      pendingSignIns.set(pendingId, {
        id: pendingId,
        provider,
        username,
        browser,
        context,
        page,
        createdAt: Date.now(),
      });
      return {
        status: "verification_required",
        pendingId,
        screenshotBase64: await screenshotBase64(page),
        prompt: `${profile.label} wants a verification code — check your phone or email, then send it back to ZAR.`,
      };
    }

    if (outcome === "error") {
      await browser.close();
      return { status: "error", message: `${profile.label} rejected that username or password.` };
    }

    // Not a recognized success, verification prompt, or rejection —
    // most likely a CAPTCHA or a page ZAR's selectors don't cover.
    // Hand the live browser to the human instead of just giving up.
    const pendingId = `${provider}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    pendingSignIns.set(pendingId, {
      id: pendingId,
      provider,
      username,
      browser,
      context,
      page,
      createdAt: Date.now(),
    });
    return {
      status: "human_required",
      pendingId,
      screenshotBase64: await screenshotBase64(page),
      prompt: `ZAR got stuck signing in to ${profile.label} — this usually means there's a CAPTCHA or a page it doesn't recognize. Take over the browser to finish it yourself.`,
    };
  } catch (err: any) {
    if (browser) await browser.close().catch(() => {});
    return { status: "error", message: err?.message || "Sign-in failed unexpectedly." };
  }
}

export async function submitVerificationCode(pendingId: string, code: string): Promise<SignInResult> {
  const entry = pendingSignIns.get(pendingId);
  if (!entry) {
    return { status: "error", message: "This sign-in attempt timed out. Start again." };
  }
  const profile = getLoginProfile(entry.provider);
  if (!profile || !profile.verificationInputSelector) {
    pendingSignIns.delete(pendingId);
    await entry.browser.close().catch(() => {});
    return { status: "error", message: "No verification step is configured for this provider." };
  }

  try {
    await entry.page.locator(profile.verificationInputSelector).first().fill(code, { timeout: 15_000 });
    if (profile.verificationSubmitSelector) {
      await entry.page.locator(profile.verificationSubmitSelector).first().click({ timeout: 15_000 });
    }

    const outcome = await waitForOutcome(entry.page, profile);

    if (outcome === "success") {
      const sessionState = JSON.stringify(await entry.context.storageState());
      await entry.browser.close();
      pendingSignIns.delete(pendingId);
      return { status: "success", sessionState };
    }

    if (outcome === "error") {
      await entry.browser.close();
      pendingSignIns.delete(pendingId);
      return { status: "error", message: "That code was rejected." };
    }

    // Still on a verification step (e.g. a second prompt) — keep the
    // browser context alive so the human can try once more.
    entry.createdAt = Date.now();
    return {
      status: "verification_required",
      pendingId,
      screenshotBase64: await screenshotBase64(entry.page),
      prompt: "Still waiting on verification — check the screenshot and try again.",
    };
  } catch (err: any) {
    await entry.browser.close().catch(() => {});
    pendingSignIns.delete(pendingId);
    return { status: "error", message: err?.message || "Verification failed unexpectedly." };
  }
}

export function getPendingIdentity(pendingId: string): { provider: string; username: string } | null {
  const entry = pendingSignIns.get(pendingId);
  return entry ? { provider: entry.provider, username: entry.username } : null;
}

export function cancelPendingSignIn(pendingId: string): void {
  const entry = pendingSignIns.get(pendingId);
  if (entry) {
    void entry.browser.close().catch(() => {});
    pendingSignIns.delete(pendingId);
  }
}

export type LiveInputEvent =
  | { type: "mouseMove"; x: number; y: number }
  | { type: "mouseDown"; x: number; y: number; button?: "left" | "right" }
  | { type: "mouseUp"; x: number; y: number; button?: "left" | "right" }
  | { type: "wheel"; x: number; y: number; deltaX: number; deltaY: number }
  | { type: "insertText"; text: string }
  | { type: "key"; key: "Enter" | "Backspace" | "Tab" | "Escape" };

export function hasPendingSignIn(pendingId: string): boolean {
  return pendingSignIns.has(pendingId);
}

export function getPendingScreenSize(pendingId: string): { width: number; height: number } | null {
  const entry = pendingSignIns.get(pendingId);
  if (!entry) return null;
  const viewport = entry.page.viewportSize();
  return viewport ? { width: viewport.width, height: viewport.height } : null;
}

/**
 * Starts a live CDP screencast of the stuck page and streams frames
 * to `onFrame` as they arrive. This — plus dispatchLiveInput below —
 * is what lets a human see and then drive the exact browser ZAR got
 * stuck in (a CAPTCHA, an unrecognized page), instead of the sign-in
 * just failing outright. Works against a headless page with no real
 * display, the same way Chrome DevTools' remote inspector does.
 */
export async function startLiveScreencast(
  pendingId: string,
  onFrame: (jpegBase64: string) => void,
): Promise<boolean> {
  const entry = pendingSignIns.get(pendingId);
  if (!entry) return false;

  entry.liveHandoffActive = true;
  entry.createdAt = Date.now();

  const cdp = entry.cdpSession ?? (await entry.context.newCDPSession(entry.page));
  entry.cdpSession = cdp;

  cdp.on("Page.screencastFrame", (event: any) => {
    onFrame(event.data);
    void cdp.send("Page.screencastFrameAck", { sessionId: event.sessionId }).catch(() => {});
    entry.createdAt = Date.now();
  });

  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 60,
    maxWidth: 1280,
    maxHeight: 900,
    everyNthFrame: 1,
  });
  return true;
}

export async function stopLiveScreencast(pendingId: string): Promise<void> {
  const entry = pendingSignIns.get(pendingId);
  if (!entry?.cdpSession) return;
  await entry.cdpSession.send("Page.stopScreencast").catch(() => {});
  entry.liveHandoffActive = false;
}

/**
 * Relays one input event from the human's browser into the stuck
 * page via CDP.
 */
export async function dispatchLiveInput(pendingId: string, event: LiveInputEvent): Promise<void> {
  const entry = pendingSignIns.get(pendingId);
  if (!entry?.cdpSession) return;
  const cdp = entry.cdpSession;
  entry.createdAt = Date.now();

  switch (event.type) {
    case "mouseMove":
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: event.x, y: event.y });
      break;
    case "mouseDown":
      await cdp.send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x: event.x,
        y: event.y,
        button: event.button || "left",
        clickCount: 1,
      });
      break;
    case "mouseUp":
      await cdp.send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x: event.x,
        y: event.y,
        button: event.button || "left",
        clickCount: 1,
      });
      break;
    case "wheel":
      await cdp.send("Input.dispatchMouseEvent", {
        type: "mouseWheel",
        x: event.x,
        y: event.y,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
      });
      break;
    case "insertText":
      await cdp.send("Input.insertText", { text: event.text });
      break;
    case "key": {
      const keyMap: Record<string, { key: string; code: string; windowsVirtualKeyCode: number }> = {
        Enter: { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 },
        Backspace: { key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8 },
        Tab: { key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 },
        Escape: { key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 },
      };
      const mapped = keyMap[event.key];
      if (!mapped) break;
      await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", ...mapped });
      await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...mapped });
      break;
    }
  }
}

/**
 * Called once the human says they're done taking over — stops the
 * screencast and re-checks the page the same way an automated attempt
 * would. If it now matches success, the session is captured and the
 * connection is live going forward. If it's still stuck, the
 * pendingId stays valid so the human can keep driving.
 */
export async function finalizeAfterHandoff(pendingId: string): Promise<SignInResult> {
  const entry = pendingSignIns.get(pendingId);
  if (!entry) {
    return { status: "error", message: "This sign-in attempt timed out. Start again." };
  }
  const profile = getLoginProfile(entry.provider);
  if (!profile) {
    return { status: "error", message: "Unknown provider for this sign-in attempt." };
  }

  await stopLiveScreencast(pendingId);

  const outcome = await waitForOutcome(entry.page, profile, 8_000);

  if (outcome === "success") {
    const sessionState = JSON.stringify(await entry.context.storageState());
    await entry.browser.close();
    pendingSignIns.delete(pendingId);
    return { status: "success", sessionState };
  }

  if (outcome === "error") {
    await entry.browser.close();
    pendingSignIns.delete(pendingId);
    return { status: "error", message: "Sign-in didn't go through." };
  }

  entry.createdAt = Date.now();
  return {
    status: "human_required",
    pendingId,
    screenshotBase64: await screenshotBase64(entry.page),
    prompt: "Still not signed in — keep going, or take over again.",
  };
}

/**
 * Rehydrates a saved session into a live, authenticated browser
 * context for later use (posting, reading, etc.) — this is what makes
 * the connection stand rather than one-off: the login only has to
 * happen once, and every later action reuses this context instead of
 * signing in again. Caller owns closing the returned browser.
 */
export async function loadAuthenticatedContext(
  sessionState: string,
): Promise<{ browser: Browser; context: BrowserContext }> {
  const browser = await launchBrowser();
  const context = await browser.newContext({ storageState: JSON.parse(sessionState) });
  return { browser, context };
}
