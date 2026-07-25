/**
 * Per-provider config for credential-based sign-in via a real browser
 * (Playwright), for services that don't offer a paste-a-token path.
 * Zed fills the login form itself — the same action a password
 * manager's autofill performs — using a headless Chromium instance,
 * then keeps the resulting session (cookies/local storage) so it
 * doesn't have to log in again on every request.
 *
 * Login pages change their markup over time; these selectors are a
 * best-effort starting point per provider, not a guarantee. When a
 * selector goes stale, `startSignIn` fails with a clear "couldn't
 * find X on the page" error instead of hanging — that's the signal
 * this file needs an update, not that the whole approach is broken.
 */

export interface LoginProfile {
  label: string;
  loginUrl: string;
  usernameSelector: string;
  /** Some providers (Google) show username and password on separate
   *  steps with a "Next" button between them. */
  usernameNextSelector?: string;
  passwordSelector: string;
  submitSelector: string;
  /** Any of these appearing means login succeeded. */
  successSelectors: string[];
  /** Any of these appearing means an extra verification step (2FA,
   *  device confirmation, code-by-SMS/email) is being asked for. */
  verificationSelectors: string[];
  /** The field the user's verification code goes into, once we know
   *  a verification step is showing. */
  verificationInputSelector?: string;
  verificationSubmitSelector?: string;
  /** Any of these appearing means the credentials were rejected. */
  errorSelectors: string[];
}

export const LOGIN_PROFILES: Record<string, LoginProfile> = {
  instagram: {
    label: "Instagram",
    loginUrl: "https://www.instagram.com/accounts/login/",
    usernameSelector: 'input[name="username"]',
    passwordSelector: 'input[name="password"]',
    submitSelector: 'button[type="submit"]',
    successSelectors: ['nav[aria-label="Primary site navigation"]', 'svg[aria-label="Home"]'],
    verificationSelectors: [
      'input[name="verificationCode"]',
      'text=Enter the code',
      'text=Check your',
    ],
    verificationInputSelector: 'input[name="verificationCode"], input[autocomplete="one-time-code"]',
    verificationSubmitSelector: 'button[type="submit"]',
    errorSelectors: ['#slfErrorAlert', 'text=incorrect'],
  },
  facebook: {
    label: "Facebook",
    loginUrl: "https://www.facebook.com/login",
    usernameSelector: "#email",
    passwordSelector: "#pass",
    submitSelector: 'button[name="login"]',
    successSelectors: ['div[role="navigation"]', 'div[aria-label="Facebook"]'],
    verificationSelectors: ['input[name="approvals_code"]', 'text=Enter the code'],
    verificationInputSelector: 'input[name="approvals_code"]',
    verificationSubmitSelector: 'button[id="checkpointSubmitButton"], button[type="submit"]',
    errorSelectors: ['div[role="alert"]'],
  },
  linkedin: {
    label: "LinkedIn",
    loginUrl: "https://www.linkedin.com/login",
    usernameSelector: "#username",
    passwordSelector: "#password",
    submitSelector: 'button[type="submit"]',
    successSelectors: ['div.feed-identity-module', 'a[href*="/feed/"]'],
    verificationSelectors: ['input#input__email_verification_pin', 'text=Enter the code'],
    verificationInputSelector: "input#input__email_verification_pin",
    verificationSubmitSelector: 'button[type="submit"]',
    errorSelectors: ['#error-for-username', '#error-for-password'],
  },
  tiktok: {
    label: "TikTok",
    loginUrl: "https://www.tiktok.com/login/phone-or-email/email",
    usernameSelector: 'input[name="username"]',
    passwordSelector: 'input[type="password"]',
    submitSelector: 'button[data-e2e="login-button"]',
    successSelectors: ['[data-e2e="profile-icon"]'],
    verificationSelectors: ['input[placeholder*="code"]', 'text=Enter the code'],
    verificationInputSelector: 'input[placeholder*="code"]',
    verificationSubmitSelector: 'button[data-e2e="verify-button"], button[type="submit"]',
    errorSelectors: ['text=incorrect'],
  },
  google: {
    label: "Google (YouTube / Drive)",
    loginUrl: "https://accounts.google.com/signin/v2/identifier",
    usernameSelector: 'input[type="email"]',
    usernameNextSelector: "#identifierNext button",
    passwordSelector: 'input[type="password"]',
    submitSelector: "#passwordNext button",
    successSelectors: ['a[aria-label*="Google Account"]'],
    verificationSelectors: ['text=2-Step Verification', 'text=Verify it', 'input[type="tel"]'],
    verificationInputSelector: 'input[type="tel"], input[name="code"]',
    verificationSubmitSelector: "#idvPreregisteredPhoneNext button, button[type=submit]",
    errorSelectors: ["text=Wrong password", "text=Couldn't find your Google Account"],
  },
  microsoft: {
    label: "Microsoft (OneDrive)",
    loginUrl: "https://login.live.com/",
    usernameSelector: 'input[type="email"]',
    usernameNextSelector: "#idSIButton9",
    passwordSelector: 'input[type="password"]',
    submitSelector: "#idSIButton9",
    successSelectors: ['div[data-testid="app-launcher"]'],
    verificationSelectors: ["text=Enter code", 'input[name="otc"]'],
    verificationInputSelector: 'input[name="otc"]',
    verificationSubmitSelector: "#idSIButton9",
    errorSelectors: ["#passwordError", "#usernameError"],
  },
};

export function getLoginProfile(provider: string): LoginProfile | null {
  return LOGIN_PROFILES[provider] || null;
}
