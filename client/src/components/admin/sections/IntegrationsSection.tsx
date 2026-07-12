import { useCallback, useEffect, useMemo, useState } from "react";

import {
  LoadErrorBanner,
  SaveIndicator,
  SettingGroup,
  SettingRow,
} from "./settings/atoms";

/**
 * Plain-language Integrations surface — per-provider rows.
 *
 * Each service is one row. Tap Connect and a dialog walks the user
 * through, step by step, how to grab the credential the provider
 * issues to normal users, with a direct link to the provider page.
 * No client-ID/secret/refresh-token jargon. If a provider has no
 * plain-user credential path at all, we say so honestly rather
 * than pretending.
 */

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface Provider {
  key: string;
  label: string;
  /** Plain-English label for the primary field the user pastes. */
  fieldLabel: string;
  /** Optional secondary field (e.g. "Your Gmail address" for SMTP auth). */
  secondaryFieldLabel?: string;
  secondaryFieldPlaceholder?: string;
  /** Ordered steps the user follows to obtain the credential. */
  steps: string[];
  /** Direct link to the provider page where the credential is made. */
  helpUrl?: string;
  /** Reads current integrations state to decide connected vs. not. */
  connectedFn: (integrations: any) => { connected: boolean; account?: string };
  /** Builds the JSON patch for /api/admin/settings/integrations. */
  patch: (primary: string, secondary?: string) => any;
  /**
   * Endpoint URL to POST to after connecting so the user can verify
   * the credential actually works. If set, a "Send test" button
   * appears on the connected row. Response should be
   * { status: "success"|"failed", detail?: string, failureReason?: string }
   */
  testEndpoint?: string;
}

interface ProviderGroup {
  title: string;
  description: string;
  providers: Provider[];
  supportsCustom: boolean;
}

const GROUPS: ProviderGroup[] = [
  {
    title: "Email",
    description: "Where Zed sends outbound mail from.",
    supportsCustom: true,
    providers: [
      {
        key: "gmail",
        label: "Gmail",
        fieldLabel: "Gmail app password (16 characters)",
        secondaryFieldLabel: "Your Gmail address",
        secondaryFieldPlaceholder: "you@gmail.com",
        helpUrl: "https://myaccount.google.com/apppasswords",
        testEndpoint: "/api/admin/integrations/email/test",
        steps: [
          "Tap the link below to open Google's App passwords page.",
          "If you're asked to turn on 2-Step Verification first, do that.",
          "Type “Zed” as the app name and tap Create.",
          "Google shows a 16-character password. Copy it.",
          "Paste your Gmail address AND the app password below, then Save.",
        ],
        connectedFn: (i) => {
          const acc = (i?.email?.accounts || []).find((a: any) => a.provider === "gmail");
          return { connected: Boolean(acc?.hasPassword), account: acc?.fromAddress };
        },
        patch: (password, email = "") => ({
          email: {
            accounts: [
              {
                id: "email-gmail",
                label: `Gmail (${email || "no address"})`,
                provider: "gmail",
                fromName: "ZED",
                fromAddress: email,
                smtpHost: "smtp.gmail.com",
                smtpPort: 587,
                username: email,
                password,
              },
            ],
          },
        }),
      },
      {
        key: "outlook",
        label: "Outlook / Microsoft 365",
        fieldLabel: "Outlook app password",
        secondaryFieldLabel: "Your Outlook / Microsoft 365 address",
        secondaryFieldPlaceholder: "you@outlook.com or you@company.com",
        helpUrl: "https://account.microsoft.com/security",
        testEndpoint: "/api/admin/integrations/email/test",
        steps: [
          "Tap the link to open Microsoft account security.",
          "Under Advanced security options, find App passwords.",
          "Create a new app password and name it “Zed”.",
          "Copy the generated password.",
          "Paste your email address AND the app password below, then Save.",
        ],
        connectedFn: (i) => {
          const acc = (i?.email?.accounts || []).find((a: any) => a.provider === "outlook");
          return { connected: Boolean(acc?.hasPassword), account: acc?.fromAddress };
        },
        patch: (password, email = "") => ({
          email: {
            accounts: [
              {
                id: "email-outlook",
                label: `Outlook (${email || "no address"})`,
                provider: "outlook",
                fromName: "ZED",
                fromAddress: email,
                smtpHost: "smtp.office365.com",
                smtpPort: 587,
                username: email,
                password,
              },
            ],
          },
        }),
      },
      {
        key: "icloud",
        label: "iCloud Mail",
        fieldLabel: "iCloud app-specific password",
        secondaryFieldLabel: "Your iCloud email address",
        secondaryFieldPlaceholder: "you@icloud.com",
        helpUrl: "https://appleid.apple.com/account/manage",
        testEndpoint: "/api/admin/integrations/email/test",
        steps: [
          "Tap the link to open your Apple ID account page and sign in.",
          "Under Sign-In and Security, tap App-Specific Passwords.",
          "Tap the + to generate a new one and name it “Zed”.",
          "Apple shows the password. Copy it.",
          "Paste your iCloud address AND the password below, then Save.",
        ],
        connectedFn: (i) => {
          const acc = (i?.email?.accounts || []).find((a: any) => a.provider === "icloud");
          return { connected: Boolean(acc?.hasPassword), account: acc?.fromAddress };
        },
        patch: (password, email = "") => ({
          email: {
            accounts: [
              {
                id: "email-icloud",
                label: `iCloud (${email || "no address"})`,
                provider: "icloud",
                fromName: "ZED",
                fromAddress: email,
                smtpHost: "smtp.mail.me.com",
                smtpPort: 587,
                username: email,
                password,
              },
            ],
          },
        }),
      },
    ],
  },
  {
    title: "GitHub",
    description: "So Zed can read repos and post pull requests when you approve.",
    supportsCustom: false,
    providers: [
      {
        key: "github",
        label: "GitHub personal access token",
        fieldLabel: "Personal access token (starts with ghp_ or github_pat_)",
        helpUrl: "https://github.com/settings/tokens?type=beta",
        steps: [
          "Tap the link to open GitHub's fine-grained tokens page.",
          "Tap Generate new token.",
          "Name it “Zed”. Set expiration to whatever you're comfortable with.",
          "Pick the repositories Zed should reach.",
          "Under Repository permissions, give Contents: Read + Pull requests: Read/Write + Issues: Read/Write.",
          "Tap Generate token and copy it.",
          "Paste it below and tap Save.",
        ],
        connectedFn: (i) => {
          const acc = (i?.github?.accounts || [])[0];
          return {
            connected: Boolean(acc?.hasToken),
            account: acc?.owner ? `${acc.owner}/${acc.repo || ""}` : acc?.label,
          };
        },
        patch: (value) => ({
          github: {
            accounts: [
              {
                id: "github-primary",
                label: "GitHub",
                owner: "",
                repo: "",
                defaultBranch: "main",
                token: value,
              },
            ],
          },
        }),
      },
    ],
  },
  {
    title: "Deployment",
    description: "So Zed can trigger deploys when you approve.",
    supportsCustom: true,
    providers: [
      {
        key: "render",
        label: "Render",
        fieldLabel: "Render API key",
        helpUrl: "https://dashboard.render.com/u/settings",
        steps: [
          "Tap the link to open your Render account settings.",
          "Scroll to API Keys and tap Create API Key.",
          "Name it “Zed” and copy the key.",
          "Paste it below and tap Save.",
        ],
        connectedFn: (i) => {
          const acc = (i?.deployment?.accounts || []).find((a: any) => a.provider === "render");
          return { connected: Boolean(acc?.hasAccessToken), account: acc?.label };
        },
        patch: (value) => ({
          deployment: {
            accounts: [{ id: "deployment-render", label: "Render", provider: "render", accessToken: value }],
          },
        }),
      },
      {
        key: "netlify",
        label: "Netlify",
        fieldLabel: "Netlify personal access token",
        helpUrl: "https://app.netlify.com/user/applications#personal-access-tokens",
        steps: [
          "Tap the link to open Netlify's Applications page.",
          "Under Personal access tokens, tap New access token.",
          "Name it “Zed” and copy the token.",
          "Paste it below and tap Save.",
        ],
        connectedFn: (i) => {
          const acc = (i?.deployment?.accounts || []).find((a: any) => a.provider === "netlify");
          return { connected: Boolean(acc?.hasAccessToken), account: acc?.label };
        },
        patch: (value) => ({
          deployment: {
            accounts: [{ id: "deployment-netlify", label: "Netlify", provider: "netlify", accessToken: value }],
          },
        }),
      },
      {
        key: "vercel",
        label: "Vercel",
        fieldLabel: "Vercel access token",
        helpUrl: "https://vercel.com/account/tokens",
        steps: [
          "Tap the link to open Vercel Account → Tokens.",
          "Tap Create Token, name it “Zed”.",
          "Copy the token before you close the page — Vercel only shows it once.",
          "Paste it below and tap Save.",
        ],
        connectedFn: (i) => {
          const acc = (i?.deployment?.accounts || []).find((a: any) => a.provider === "vercel");
          return { connected: Boolean(acc?.hasAccessToken), account: acc?.label };
        },
        patch: (value) => ({
          deployment: {
            accounts: [{ id: "deployment-vercel", label: "Vercel", provider: "vercel", accessToken: value }],
          },
        }),
      },
      {
        key: "railway",
        label: "Railway",
        fieldLabel: "Railway API token",
        helpUrl: "https://railway.app/account/tokens",
        steps: [
          "Tap the link to open Railway's Account Tokens page.",
          "Tap Create Token and name it “Zed”.",
          "Copy the token.",
          "Paste it below and tap Save.",
        ],
        connectedFn: (i) => {
          const acc = (i?.deployment?.accounts || []).find((a: any) => a.provider === "railway");
          return { connected: Boolean(acc?.hasAccessToken), account: acc?.label };
        },
        patch: (value) => ({
          deployment: {
            accounts: [{ id: "deployment-railway", label: "Railway", provider: "railway", accessToken: value }],
          },
        }),
      },
    ],
  },
  {
    title: "Cloud files",
    description: "Where Zed reads and writes documents.",
    supportsCustom: true,
    providers: [
      {
        key: "dropbox",
        label: "Dropbox",
        fieldLabel: "Dropbox access token",
        helpUrl: "https://www.dropbox.com/developers/apps",
        steps: [
          "Tap the link to open Dropbox's App Console.",
          "Tap Create app. Pick Scoped access and Full Dropbox.",
          "Name it “Zed” and create the app.",
          "On the app page, scroll to Generated access token and tap Generate.",
          "Copy the token that appears.",
          "Paste it below and tap Save.",
        ],
        connectedFn: (i) => {
          const acc = (i?.cloudStorage?.accounts || []).find((a: any) => a.provider === "dropbox");
          return { connected: Boolean(acc?.hasAccessToken), account: acc?.label };
        },
        patch: (value) => ({
          cloudStorage: {
            accounts: [{ id: "cloudstorage-dropbox", label: "Dropbox", provider: "dropbox", accessToken: value }],
          },
        }),
      },
      {
        key: "gdrive-info",
        label: "Google Drive (info only)",
        fieldLabel: "",
        steps: [
          "Google Drive doesn't offer a paste-a-key path for the kind of access Zed needs.",
          "This one needs a real Google sign-in flow, which isn't set up.",
          "Until that lands, use Dropbox or a custom entry for Drive-like access.",
        ],
        connectedFn: () => ({ connected: false }),
        patch: () => ({}),
      },
      {
        key: "onedrive-info",
        label: "OneDrive (info only)",
        fieldLabel: "",
        steps: [
          "OneDrive doesn't offer a paste-a-key path for the access Zed needs.",
          "This one needs a real Microsoft sign-in flow, which isn't set up.",
          "Until that lands, use Dropbox or a custom entry.",
        ],
        connectedFn: () => ({ connected: false }),
        patch: () => ({}),
      },
    ],
  },
  {
    title: "Payments",
    description: "Send invoices, see revenue, run charges when you approve.",
    supportsCustom: true,
    providers: [
      {
        key: "stripe",
        label: "Stripe",
        fieldLabel: "Stripe secret key (starts with sk_live_ or sk_test_)",
        helpUrl: "https://dashboard.stripe.com/apikeys",
        steps: [
          "Tap the link to open Stripe → Developers → API keys.",
          "Under Standard keys, reveal the Secret key.",
          "For safety, consider creating a Restricted key instead so Zed only has the permissions it needs.",
          "Copy the key.",
          "Paste it below and tap Save.",
        ],
        connectedFn: (i) => {
          const acc = (i?.payments?.accounts || []).find((a: any) => a.provider === "stripe");
          return { connected: Boolean(acc?.hasSecretKey), account: acc?.label };
        },
        patch: (value) => ({
          payments: {
            accounts: [{ id: "payments-stripe", label: "Stripe", provider: "stripe", secretKey: value }],
          },
        }),
      },
      {
        key: "square",
        label: "Square",
        fieldLabel: "Square access token",
        helpUrl: "https://developer.squareup.com/apps",
        steps: [
          "Tap the link to open the Square Developer Dashboard.",
          "Create an application named “Zed” (or reuse one you have).",
          "Under Credentials, copy your Access token. Use Sandbox for testing.",
          "Paste it below and tap Save.",
        ],
        connectedFn: (i) => {
          const acc = (i?.payments?.accounts || []).find((a: any) => a.provider === "square");
          return { connected: Boolean(acc?.hasSecretKey), account: acc?.label };
        },
        patch: (value) => ({
          payments: {
            accounts: [{ id: "payments-square", label: "Square", provider: "square", secretKey: value }],
          },
        }),
      },
      {
        key: "paypal-info",
        label: "PayPal (info only)",
        fieldLabel: "",
        steps: [
          "PayPal's normal-user login can't be used for API access — even with a business account, they require a full app registration.",
          "This one isn't set up. Use Stripe or Square in the meantime.",
        ],
        connectedFn: () => ({ connected: false }),
        patch: () => ({}),
      },
    ],
  },
  {
    title: "Accounting",
    description: "Cashflow and reporting.",
    supportsCustom: true,
    providers: [
      {
        key: "wave",
        label: "Wave",
        fieldLabel: "Wave full-access token",
        helpUrl: "https://developer.waveapps.com/hc/en-us/articles/360019762711",
        steps: [
          "Tap the link to open Wave's developer article on tokens.",
          "Follow the “Get a token” steps — it's a one-time paste.",
          "Copy the full-access token that Wave shows you.",
          "Paste it below and tap Save.",
        ],
        connectedFn: (i) => {
          const acc = (i?.accounting?.accounts || []).find((a: any) => a.provider === "wave");
          return { connected: Boolean(acc?.hasCredentials), account: acc?.label };
        },
        patch: (value) => ({
          accounting: {
            accounts: [{ id: "accounting-wave", label: "Wave", provider: "wave", refreshToken: value }],
          },
        }),
      },
      {
        key: "quickbooks-info",
        label: "QuickBooks (info only)",
        fieldLabel: "",
        steps: [
          "QuickBooks doesn't offer a paste-a-key path for a normal user — it requires a full app registration.",
          "This one isn't set up. Wave works today.",
        ],
        connectedFn: () => ({ connected: false }),
        patch: () => ({}),
      },
      {
        key: "xero-info",
        label: "Xero (info only)",
        fieldLabel: "",
        steps: [
          "Xero requires a full sign-in flow that isn't set up.",
          "Wave works today; Xero will need a proper sign-in flow to land.",
        ],
        connectedFn: () => ({ connected: false }),
        patch: () => ({}),
      },
    ],
  },
  {
    title: "Social",
    description: "For drafts and posts — never sent without your approval.",
    supportsCustom: true,
    providers: [
      {
        key: "twitter",
        label: "Twitter / X",
        fieldLabel: "Twitter bearer token",
        helpUrl: "https://developer.twitter.com/en/portal/dashboard",
        steps: [
          "Tap the link to open Twitter's developer portal (sign in with your @ account).",
          "Create a project + app (call it “Zed”) if you don't have one.",
          "Open the app → Keys and tokens.",
          "Under Authentication Tokens, generate a Bearer Token.",
          "Copy the bearer token.",
          "Paste it below and tap Save.",
        ],
        connectedFn: (i) => {
          const acc = (i?.socialPublishing?.accounts || []).find((a: any) => a.platform === "twitter");
          return { connected: Boolean(acc?.hasAccessToken), account: acc?.label };
        },
        patch: (value) => ({
          socialPublishing: {
            accounts: [{ id: "social-twitter", label: "Twitter / X", platform: "twitter", accessToken: value }],
          },
        }),
      },
      {
        key: "tiktok-info",
        label: "TikTok (info only)",
        fieldLabel: "",
        steps: [
          "TikTok posting only works through their app-approval flow — no paste-a-key path.",
          "Not set up.",
        ],
        connectedFn: () => ({ connected: false }),
        patch: () => ({}),
      },
      {
        key: "instagram-info",
        label: "Instagram (info only)",
        fieldLabel: "",
        steps: [
          "Instagram posting requires going through Meta's Facebook app registration.",
          "Not set up.",
        ],
        connectedFn: () => ({ connected: false }),
        patch: () => ({}),
      },
      {
        key: "facebook-info",
        label: "Facebook (info only)",
        fieldLabel: "",
        steps: [
          "Facebook posting requires Meta's app registration flow.",
          "Not set up.",
        ],
        connectedFn: () => ({ connected: false }),
        patch: () => ({}),
      },
      {
        key: "linkedin-info",
        label: "LinkedIn (info only)",
        fieldLabel: "",
        steps: [
          "LinkedIn's posting API needs a full app registration.",
          "Not set up.",
        ],
        connectedFn: () => ({ connected: false }),
        patch: () => ({}),
      },
      {
        key: "youtube-info",
        label: "YouTube (info only)",
        fieldLabel: "",
        steps: [
          "YouTube uploads require Google's OAuth sign-in flow (not set up).",
        ],
        connectedFn: () => ({ connected: false }),
        patch: () => ({}),
      },
    ],
  },
  {
    title: "CRM",
    description: "Contacts and deals.",
    supportsCustom: true,
    providers: [
      {
        key: "hubspot",
        label: "HubSpot",
        fieldLabel: "HubSpot private app token",
        helpUrl: "https://app.hubspot.com/private-apps/",
        steps: [
          "Tap the link to open HubSpot's private apps page.",
          "Create a private app named “Zed”.",
          "Under Scopes, tick the CRM scopes for contacts, companies, and deals.",
          "Under Auth, tap Generate token.",
          "Copy the token.",
          "Paste it below and tap Save.",
        ],
        connectedFn: (i) => {
          const acc = (i?.crm?.accounts || []).find((a: any) => a.provider === "hubspot");
          return { connected: Boolean(acc?.hasApiKey), account: acc?.label };
        },
        patch: (value) => ({
          crm: { accounts: [{ id: "crm-hubspot", label: "HubSpot", provider: "hubspot", apiKey: value }] },
        }),
      },
      {
        key: "pipedrive",
        label: "Pipedrive",
        fieldLabel: "Pipedrive API token",
        helpUrl: "https://app.pipedrive.com/settings/api",
        steps: [
          "Tap the link to open Pipedrive → Personal preferences → API.",
          "Copy the API token shown there.",
          "Paste it below and tap Save.",
        ],
        connectedFn: (i) => {
          const acc = (i?.crm?.accounts || []).find((a: any) => a.provider === "pipedrive");
          return { connected: Boolean(acc?.hasApiKey), account: acc?.label };
        },
        patch: (value) => ({
          crm: { accounts: [{ id: "crm-pipedrive", label: "Pipedrive", provider: "pipedrive", apiKey: value }] },
        }),
      },
      {
        key: "salesforce-info",
        label: "Salesforce (info only)",
        fieldLabel: "",
        steps: [
          "Salesforce requires their connected-app registration; there's no plain paste-a-key.",
          "Not set up.",
        ],
        connectedFn: () => ({ connected: false }),
        patch: () => ({}),
      },
    ],
  },
  {
    title: "Phone & voicemail",
    description: "So Zed can handle calls, texts, and voicemail.",
    supportsCustom: false,
    providers: [
      {
        key: "twilio",
        label: "Twilio",
        fieldLabel: "Twilio auth token",
        helpUrl: "https://console.twilio.com",
        steps: [
          "Tap the link to open Twilio Console.",
          "On the dashboard, find your Auth Token (right column, next to Account SID).",
          "Tap show to reveal it. Copy the token.",
          "Paste it below and tap Save.",
        ],
        connectedFn: (i) => ({
          connected: i?.telephony?.provider === "twilio" && !!i?.telephony?.hasApiKey,
        }),
        patch: (value) => ({ telephony: { provider: "twilio", apiKey: value } }),
      },
    ],
  },
  {
    title: "Market data",
    description: "Price and fundamentals for the trading intelligence agent.",
    supportsCustom: true,
    providers: [
      {
        key: "polygon",
        label: "Polygon.io",
        fieldLabel: "Polygon API key",
        helpUrl: "https://polygon.io/dashboard/api-keys",
        steps: [
          "Tap the link to open Polygon's API Keys page.",
          "Copy your API key.",
          "Paste it below and tap Save.",
        ],
        connectedFn: (i) => {
          const acc = (i?.marketData?.accounts || []).find((a: any) => a.provider === "polygon");
          return { connected: Boolean(acc?.hasApiKey), account: acc?.label };
        },
        patch: (value) => ({
          marketData: {
            accounts: [{ id: "marketdata-polygon", label: "Polygon.io", provider: "polygon", apiKey: value }],
          },
        }),
      },
      {
        key: "alphavantage",
        label: "Alpha Vantage",
        fieldLabel: "Alpha Vantage API key",
        helpUrl: "https://www.alphavantage.co/support/#api-key",
        steps: [
          "Tap the link to open Alpha Vantage's key request page.",
          "Fill out the short form and submit.",
          "Copy the free API key they email or show you.",
          "Paste it below and tap Save.",
        ],
        connectedFn: (i) => {
          const acc = (i?.marketData?.accounts || []).find((a: any) => a.provider === "alphavantage");
          return { connected: Boolean(acc?.hasApiKey), account: acc?.label };
        },
        patch: (value) => ({
          marketData: {
            accounts: [{ id: "marketdata-alphavantage", label: "Alpha Vantage", provider: "alphavantage", apiKey: value }],
          },
        }),
      },
    ],
  },
  {
    title: "TradingView",
    description: "Send TradingView chart snapshots and alerts to Zed's trading journal.",
    supportsCustom: false,
    providers: [
      {
        key: "tradingview",
        label: "TradingView webhook secret",
        fieldLabel: "Webhook secret (any string you make up)",
        steps: [
          "Pick any random string you'd like — Zed will use it to verify alerts.",
          "In TradingView, when you set up an alert with a webhook URL, append ?secret=THAT_STRING to your webhook URL.",
          "Paste the string below and tap Save.",
        ],
        connectedFn: (i) => ({
          connected: !!i?.tradingView?.hasAlertWebhookSecret,
        }),
        patch: (value) => ({ tradingView: { alertWebhookSecret: value } }),
      },
    ],
  },
];

export default function IntegrationsSection() {
  const [integrations, setIntegrations] = useState<any>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [loadError, setLoadError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [dialog, setDialog] = useState<{ provider: Provider; group: ProviderGroup } | null>(null);
  const [dialogValue, setDialogValue] = useState<string>("");
  const [dialogSecondary, setDialogSecondary] = useState<string>("");
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { status: string; detail?: string }>>({});
  const [customDialog, setCustomDialog] = useState<{
    group: ProviderGroup;
    label: string;
    value: string;
  } | null>(null);
  const [dbOffline, setDbOffline] = useState<boolean>(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings", { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = await res.json();
      setIntegrations(data.integrations || {});
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void load();
    // Connections are written through to the database so they survive
    // a redeploy — but only when one is actually attached. Surface
    // that here so a missing DATABASE_URL isn't a silent data-loss trap.
    void (async () => {
      try {
        const res = await fetch("/api/admin/system-status", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        setDbOffline(data?.database === "offline");
      } catch {
        // Non-critical: skip the banner rather than block the page.
      }
    })();
  }, [load]);

  const submit = useCallback(
    async (patch: any) => {
      setStatus("saving");
      setErrorMessage(undefined);
      try {
        const res = await fetch("/api/admin/settings/integrations", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `Save failed (${res.status})`);
        }
        await load();
        setStatus("saved");
        window.setTimeout(() => setStatus("idle"), 1500);
        return true;
      } catch (err: any) {
        setErrorMessage(err?.message);
        setStatus("error");
        return false;
      }
    },
    [load],
  );

  const disconnect = useCallback(
    async (row: Provider) => {
      if (!window.confirm(`Disconnect ${row.label}? Zed will stop using this account.`)) return;
      const clear = row.patch("");
      await submit(clear);
    },
    [submit],
  );

  const openDialog = useCallback((provider: Provider, group: ProviderGroup) => {
    setDialog({ provider, group });
    setDialogValue("");
    setDialogSecondary("");
  }, []);

  const runTest = useCallback(
    async (provider: Provider) => {
      if (!provider.testEndpoint) return;
      setTestingKey(provider.key);
      try {
        const res = await fetch(provider.testEndpoint, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const body = await res.json().catch(() => ({}));
        setTestResults((prev) => ({
          ...prev,
          [provider.key]: {
            status: res.ok ? body.status || "success" : "failed",
            detail: body.detail || body.error || `HTTP ${res.status}`,
          },
        }));
      } catch (err: any) {
        setTestResults((prev) => ({
          ...prev,
          [provider.key]: { status: "failed", detail: err?.message || "Test failed" },
        }));
      } finally {
        setTestingKey(null);
      }
    },
    [],
  );

  const header = useMemo(
    () => (
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
            Connections
          </h2>
          <p className="mt-1.5 text-[13.5px] text-white/50 max-w-full sm:max-w-[62ch] leading-snug">
            Sign in to the services you want Zed to reach. Tap Connect on any provider and Zed walks you through the exact steps to grab the one thing it needs.
          </p>
        </div>
        <SaveIndicator status={status} errorMessage={errorMessage} />
      </header>
    ),
    [status, errorMessage],
  );

  if (!integrations && !loadError) {
    return (
      <div>
        {header}
        <div className="text-[13.5px] text-white/50">Loading…</div>
      </div>
    );
  }

  return (
    <div>
      {header}
      {loadError && <LoadErrorBanner onRetry={() => void load()} />}
      {dbOffline && (
        <div className="mb-6 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3 text-[13px] text-amber-200/90 leading-snug">
          <span className="font-medium">No database connected.</span> Connections are saved to disk
          only right now, so a redeploy or container restart will wipe them out. Attach a database
          (set <code className="text-amber-100">DATABASE_URL</code>) so what you connect here stays
          connected.
        </div>
      )}

      {GROUPS.map((group, gi) => (
        <SettingGroup
          key={group.title}
          title={group.title}
          count={group.providers.length}
          collapsible
          defaultCollapsed={gi > 0}
        >
          {group.providers.map((provider) => {
            const state = provider.connectedFn(integrations);
            const isInfoOnly = provider.key.endsWith("-info") || !provider.fieldLabel;
            return (
              <SettingRow
                key={provider.key}
                label={
                  state.connected && state.account
                    ? `${provider.label} — ${state.account}`
                    : provider.label
                }
                description={group.description}
              >
                {state.connected ? (
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-2">
                      {provider.testEndpoint && (
                        <button
                          type="button"
                          onClick={() => void runTest(provider)}
                          disabled={testingKey === provider.key}
                          className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-white/70 hover:text-white/90 hover:border-cyan-400/40 transition-colors active:opacity-80 disabled:opacity-50"
                        >
                          {testingKey === provider.key ? "Sending…" : "Send test"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void disconnect(provider)}
                        className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/80 hover:text-red-300 hover:border-red-400/40 transition-colors active:opacity-80"
                      >
                        Disconnect
                      </button>
                    </div>
                    {testResults[provider.key] && (
                      <div
                        className={`text-[11.5px] max-w-[240px] text-right ${
                          testResults[provider.key].status === "success"
                            ? "text-emerald-300"
                            : "text-red-300"
                        }`}
                      >
                        {testResults[provider.key].status === "success"
                          ? "✓ Test sent"
                          : `✗ ${testResults[provider.key].detail || "Test failed"}`}
                      </div>
                    )}
                  </div>
                ) : isInfoOnly ? (
                  <button
                    type="button"
                    onClick={() => openDialog(provider, group)}
                    className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-white/50 hover:text-white/70 transition-colors"
                    title="This one can't be signed in from Zed today. Tap for the why."
                  >
                    Why not?
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openDialog(provider, group)}
                    className="inline-flex items-center rounded-lg bg-cyan-400 text-black font-medium px-3.5 py-1.5 text-[13px] hover:bg-cyan-300 transition-colors active:opacity-80"
                  >
                    Connect
                  </button>
                )}
              </SettingRow>
            );
          })}

          {group.supportsCustom && (
            <SettingRow
              label="Add another"
              description={`Not seeing your provider? Add a custom ${group.title.toLowerCase()} entry.`}
            >
              <button
                type="button"
                onClick={() => setCustomDialog({ group, label: "", value: "" })}
                className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/70 hover:text-white/90 transition-colors active:opacity-80"
              >
                + Add
              </button>
            </SettingRow>
          )}
        </SettingGroup>
      ))}

      {dialog && (
        <ConnectDialog
          provider={dialog.provider}
          value={dialogValue}
          onChange={setDialogValue}
          secondaryValue={dialogSecondary}
          onSecondaryChange={setDialogSecondary}
          onCancel={() => setDialog(null)}
          onSave={async () => {
            const trimmed = dialogValue.trim();
            const secondaryTrimmed = dialogSecondary.trim();
            if (!trimmed || !dialog.provider.fieldLabel) {
              setDialog(null);
              return;
            }
            if (dialog.provider.secondaryFieldLabel && !secondaryTrimmed) {
              return; // require the second field when it's declared
            }
            const ok = await submit(
              dialog.provider.patch(trimmed, secondaryTrimmed || undefined),
            );
            if (ok) setDialog(null);
          }}
        />
      )}

      {customDialog && (
        <CustomDialog
          groupTitle={customDialog.group.title}
          label={customDialog.label}
          value={customDialog.value}
          onLabelChange={(v) => setCustomDialog({ ...customDialog, label: v })}
          onValueChange={(v) => setCustomDialog({ ...customDialog, value: v })}
          onCancel={() => setCustomDialog(null)}
          onSave={async () => {
            if (!customDialog.label.trim() || !customDialog.value.trim()) return;
            const existing = integrations?.custom || [];
            const patch = {
              custom: [
                ...existing,
                {
                  id: `custom-${Date.now()}`,
                  label: customDialog.label.trim(),
                  description: `Custom ${customDialog.group.title} entry`,
                  enabled: true,
                  fields: [
                    { key: "value", value: customDialog.value.trim(), isSecret: true },
                  ],
                },
              ],
            };
            const ok = await submit(patch);
            if (ok) setCustomDialog(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Step-by-step Connect dialog. Renders the ordered steps as a
 * numbered list with a direct link to the provider page, then the
 * single field the user pastes into. Info-only providers (no
 * fieldLabel) render the steps but skip the input.
 */
function ConnectDialog({
  provider,
  value,
  onChange,
  secondaryValue,
  onSecondaryChange,
  onCancel,
  onSave,
}: {
  provider: Provider;
  value: string;
  onChange: (next: string) => void;
  secondaryValue: string;
  onSecondaryChange: (next: string) => void;
  onCancel: () => void;
  onSave: () => void | Promise<void>;
}) {
  const isInfoOnly = !provider.fieldLabel;
  const requiresSecondary = Boolean(provider.secondaryFieldLabel);
  const canSave =
    !isInfoOnly &&
    value.trim().length > 0 &&
    (!requiresSecondary || secondaryValue.trim().length > 0);
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-950 p-5 shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[16.5px] font-semibold text-white mb-3">
          {isInfoOnly ? provider.label : `Connect ${provider.label}`}
        </h3>

        <ol className="space-y-2 mb-5">
          {provider.steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-[13px] text-white/80 leading-snug">
              <span className="shrink-0 w-5 h-5 rounded-full bg-white/[0.08] text-white/60 flex items-center justify-center text-[11px] font-medium">
                {i + 1}
              </span>
              <span className="min-w-0">{step}</span>
            </li>
          ))}
        </ol>

        {provider.helpUrl && (
          <a
            href={provider.helpUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 px-3 py-1.5 text-[13px] text-cyan-300 hover:text-cyan-200 mb-5 transition-colors"
          >
            Open the provider page →
          </a>
        )}

        {!isInfoOnly && requiresSecondary && (
          <div className="mb-4">
            <label className="block text-[12.5px] font-medium text-white/70 mb-1">
              {provider.secondaryFieldLabel}
            </label>
            <input
              type="email"
              autoFocus
              value={secondaryValue}
              onChange={(e) => onSecondaryChange(e.target.value)}
              placeholder={provider.secondaryFieldPlaceholder || ""}
              className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 placeholder:text-white/30"
            />
          </div>
        )}

        {!isInfoOnly && (
          <div className="mb-5">
            <label className="block text-[12.5px] font-medium text-white/70 mb-1">
              {provider.fieldLabel}
            </label>
            <input
              type="password"
              autoFocus={!requiresSecondary}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Paste here"
              className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 placeholder:text-white/30"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/70 hover:text-white transition-colors"
          >
            {isInfoOnly ? "Close" : "Cancel"}
          </button>
          {!isInfoOnly && (
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={!canSave}
              className="inline-flex items-center rounded-lg bg-cyan-400 text-black font-medium px-3.5 py-1.5 text-[13px] hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:opacity-80"
            >
              Save
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CustomDialog({
  groupTitle,
  label,
  value,
  onLabelChange,
  onValueChange,
  onCancel,
  onSave,
}: {
  groupTitle: string;
  label: string;
  value: string;
  onLabelChange: (next: string) => void;
  onValueChange: (next: string) => void;
  onCancel: () => void;
  onSave: () => void | Promise<void>;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-950 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[16.5px] font-semibold text-white mb-1">
          Add a custom {groupTitle.toLowerCase()} entry
        </h3>
        <p className="mt-1 text-[12.5px] text-white/50 leading-snug mb-4">
          Give it a name and paste the credential from the provider. Zed will store it and use it for {groupTitle.toLowerCase()}.
        </p>

        <div className="mb-3">
          <label className="block text-[12.5px] font-medium text-white/70 mb-1">
            Name
          </label>
          <input
            type="text"
            autoFocus
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder="What are you connecting?"
            className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 placeholder:text-white/30"
          />
        </div>

        <div className="mb-5">
          <label className="block text-[12.5px] font-medium text-white/70 mb-1">
            The credential to paste
          </label>
          <input
            type="password"
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder="Paste here"
            className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 placeholder:text-white/30"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/70 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={!label.trim() || !value.trim()}
            className="inline-flex items-center rounded-lg bg-cyan-400 text-black font-medium px-3.5 py-1.5 text-[13px] hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:opacity-80"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
