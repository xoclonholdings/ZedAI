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
 * Each service that Zed can connect to is its own row. Tap Connect
 * to open a small dialog that asks for the ONE thing needed to
 * sign in (an app password, a personal access token, a webhook URL —
 * whatever the provider actually issues to a normal user). No
 * client-ID/secret/refresh-token soup.
 *
 * Providers that need Zed to be registered with them first (real
 * OAuth apps for Gmail, Twitter, etc.) show "Sign-in not set up yet"
 * — honest, no false Connect. As each OAuth backend lands, the
 * provider's row flips to Connect automatically.
 *
 * Each group also has an "+ Add custom" row so a user can enter a
 * provider that isn't listed. That writes into integrations.custom
 * on the server side (already supported).
 */

type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * A single provider entry. `patch` returns the JSON patch that gets
 * PUT'd to /api/admin/settings/integrations when the user submits
 * the dialog's single field. `connectedFn` inspects the loaded
 * integrations state to decide whether the row shows Connect or
 * Disconnect.
 */
interface Provider {
  key: string;
  label: string;
  fieldLabel: string;
  fieldHelp: string;
  oauthReady?: boolean;
  connectedFn: (integrations: any) => { connected: boolean; account?: string };
  patch: (value: string) => any;
  disconnectPatch?: any;
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
        fieldLabel: "Gmail app password",
        fieldHelp:
          "In your Google account → Security → 2-Step Verification → App passwords, generate one for Zed. Paste it here.",
        connectedFn: (i) => {
          const acc = (i?.email?.accounts || []).find((a: any) => a.provider === "gmail");
          return { connected: Boolean(acc?.hasPassword), account: acc?.fromAddress };
        },
        patch: (value) => ({
          email: {
            accounts: [
              {
                id: "email-gmail",
                label: "Gmail",
                provider: "gmail",
                fromName: "ZED",
                fromAddress: "",
                smtpHost: "smtp.gmail.com",
                smtpPort: 587,
                username: "",
                password: value,
              },
            ],
          },
        }),
      },
      {
        key: "outlook",
        label: "Outlook / Microsoft 365",
        fieldLabel: "Outlook app password",
        fieldHelp:
          "In your Microsoft account → Security → Advanced security options → App passwords, create one for Zed.",
        connectedFn: (i) => {
          const acc = (i?.email?.accounts || []).find((a: any) => a.provider === "outlook");
          return { connected: Boolean(acc?.hasPassword), account: acc?.fromAddress };
        },
        patch: (value) => ({
          email: {
            accounts: [
              {
                id: "email-outlook",
                label: "Outlook",
                provider: "outlook",
                fromName: "ZED",
                fromAddress: "",
                smtpHost: "smtp.office365.com",
                smtpPort: 587,
                username: "",
                password: value,
              },
            ],
          },
        }),
      },
      {
        key: "icloud",
        label: "iCloud Mail",
        fieldLabel: "iCloud app-specific password",
        fieldHelp:
          "At appleid.apple.com → Sign-In and Security → App-Specific Passwords, generate one for Zed.",
        connectedFn: (i) => {
          const acc = (i?.email?.accounts || []).find((a: any) => a.provider === "icloud");
          return { connected: Boolean(acc?.hasPassword), account: acc?.fromAddress };
        },
        patch: (value) => ({
          email: {
            accounts: [
              {
                id: "email-icloud",
                label: "iCloud",
                provider: "icloud",
                fromName: "ZED",
                fromAddress: "",
                smtpHost: "smtp.mail.me.com",
                smtpPort: 587,
                username: "",
                password: value,
              },
            ],
          },
        }),
      },
    ],
  },
  {
    title: "Google (Gmail read, Calendar, Drive)",
    description: "For reading Gmail, seeing your calendar, and opening Drive files.",
    supportsCustom: false,
    providers: [
      {
        key: "google-oauth",
        label: "Google account",
        fieldLabel: "",
        fieldHelp: "",
        oauthReady: false,
        connectedFn: (i) => {
          const acc = (i?.google?.accounts || [])[0];
          return { connected: Boolean(acc?.hasCredentials), account: acc?.label };
        },
        patch: () => ({}),
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
        fieldLabel: "Personal access token",
        fieldHelp:
          "At github.com/settings/tokens, create a fine-grained token for Zed. Give it repo read + issues write scopes.",
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
        fieldHelp: "In your Render dashboard → Account Settings → API Keys, create one for Zed.",
        connectedFn: (i) => ({
          connected: i?.deployment?.provider === "render" && !!i?.deployment?.hasAccessToken,
        }),
        patch: (value) => ({ deployment: { provider: "render", accessToken: value } }),
      },
      {
        key: "netlify",
        label: "Netlify",
        fieldLabel: "Netlify personal access token",
        fieldHelp: "In Netlify → User settings → Applications → Personal access tokens, create one.",
        connectedFn: (i) => ({
          connected: i?.deployment?.provider === "netlify" && !!i?.deployment?.hasAccessToken,
        }),
        patch: (value) => ({ deployment: { provider: "netlify", accessToken: value } }),
      },
      {
        key: "vercel",
        label: "Vercel",
        fieldLabel: "Vercel access token",
        fieldHelp: "In Vercel → Settings → Tokens, create one for Zed.",
        connectedFn: (i) => ({
          connected: i?.deployment?.provider === "vercel" && !!i?.deployment?.hasAccessToken,
        }),
        patch: (value) => ({ deployment: { provider: "vercel", accessToken: value } }),
      },
      {
        key: "railway",
        label: "Railway",
        fieldLabel: "Railway API token",
        fieldHelp: "In Railway → Account Settings → Tokens, create one.",
        connectedFn: (i) => ({
          connected: i?.deployment?.provider === "railway" && !!i?.deployment?.hasAccessToken,
        }),
        patch: (value) => ({ deployment: { provider: "railway", accessToken: value } }),
      },
    ],
  },
  {
    title: "Cloud files",
    description: "Where Zed reads and writes documents.",
    supportsCustom: true,
    providers: [
      {
        key: "gdrive",
        label: "Google Drive",
        fieldLabel: "",
        fieldHelp: "",
        oauthReady: false,
        connectedFn: (i) => ({
          connected: i?.cloudStorage?.provider === "gdrive" && !!i?.cloudStorage?.hasAccessToken,
        }),
        patch: () => ({}),
      },
      {
        key: "dropbox",
        label: "Dropbox",
        fieldLabel: "Dropbox access token",
        fieldHelp: "At dropbox.com/developers/apps, create an app and generate an access token.",
        connectedFn: (i) => ({
          connected: i?.cloudStorage?.provider === "dropbox" && !!i?.cloudStorage?.hasAccessToken,
        }),
        patch: (value) => ({ cloudStorage: { provider: "dropbox", accessToken: value } }),
      },
      {
        key: "onedrive",
        label: "OneDrive",
        fieldLabel: "",
        fieldHelp: "",
        oauthReady: false,
        connectedFn: (i) => ({
          connected: i?.cloudStorage?.provider === "onedrive" && !!i?.cloudStorage?.hasAccessToken,
        }),
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
        fieldLabel: "Stripe secret key",
        fieldHelp:
          "In Stripe → Developers → API keys, use the secret key. Use a restricted key if you can.",
        connectedFn: (i) => ({
          connected: i?.payments?.provider === "stripe" && !!i?.payments?.hasSecretKey,
        }),
        patch: (value) => ({ payments: { provider: "stripe", secretKey: value } }),
      },
      {
        key: "paypal",
        label: "PayPal",
        fieldLabel: "",
        fieldHelp: "",
        oauthReady: false,
        connectedFn: (i) => ({
          connected: i?.payments?.provider === "paypal" && !!i?.payments?.hasSecretKey,
        }),
        patch: () => ({}),
      },
      {
        key: "square",
        label: "Square",
        fieldLabel: "Square access token",
        fieldHelp: "In your Square developer dashboard → Applications → Credentials.",
        connectedFn: (i) => ({
          connected: i?.payments?.provider === "square" && !!i?.payments?.hasSecretKey,
        }),
        patch: (value) => ({ payments: { provider: "square", secretKey: value } }),
      },
    ],
  },
  {
    title: "Accounting",
    description: "Cashflow and reporting.",
    supportsCustom: true,
    providers: [
      {
        key: "quickbooks",
        label: "QuickBooks",
        fieldLabel: "",
        fieldHelp: "",
        oauthReady: false,
        connectedFn: (i) => ({
          connected: i?.accounting?.provider === "quickbooks" && !!i?.accounting?.hasCredentials,
        }),
        patch: () => ({}),
      },
      {
        key: "xero",
        label: "Xero",
        fieldLabel: "",
        fieldHelp: "",
        oauthReady: false,
        connectedFn: (i) => ({
          connected: i?.accounting?.provider === "xero" && !!i?.accounting?.hasCredentials,
        }),
        patch: () => ({}),
      },
      {
        key: "wave",
        label: "Wave",
        fieldLabel: "Wave full-access token",
        fieldHelp: "In your Wave account, generate a full-access token for API use.",
        connectedFn: (i) => ({
          connected: i?.accounting?.provider === "wave" && !!i?.accounting?.hasCredentials,
        }),
        patch: (value) => ({ accounting: { provider: "wave", refreshToken: value, clientId: "wave", clientSecret: "" } }),
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
        fieldHelp:
          "At developer.twitter.com, create an app and copy the bearer token from the Keys and Tokens tab.",
        connectedFn: (i) => ({
          connected: i?.socialPublishing?.provider === "twitter" && !!i?.socialPublishing?.hasAccessToken,
        }),
        patch: (value) => ({ socialPublishing: { provider: "twitter", accessToken: value } }),
      },
      {
        key: "tiktok",
        label: "TikTok",
        fieldLabel: "",
        fieldHelp: "",
        oauthReady: false,
        connectedFn: (i) => ({
          connected: i?.socialPublishing?.provider === "tiktok" && !!i?.socialPublishing?.hasAccessToken,
        }),
        patch: () => ({}),
      },
      {
        key: "instagram",
        label: "Instagram",
        fieldLabel: "",
        fieldHelp: "",
        oauthReady: false,
        connectedFn: (i) => ({
          connected: i?.socialPublishing?.provider === "instagram" && !!i?.socialPublishing?.hasAccessToken,
        }),
        patch: () => ({}),
      },
      {
        key: "facebook",
        label: "Facebook",
        fieldLabel: "",
        fieldHelp: "",
        oauthReady: false,
        connectedFn: (i) => ({
          connected: i?.socialPublishing?.provider === "facebook" && !!i?.socialPublishing?.hasAccessToken,
        }),
        patch: () => ({}),
      },
      {
        key: "linkedin",
        label: "LinkedIn",
        fieldLabel: "",
        fieldHelp: "",
        oauthReady: false,
        connectedFn: (i) => ({
          connected: i?.socialPublishing?.provider === "linkedin" && !!i?.socialPublishing?.hasAccessToken,
        }),
        patch: () => ({}),
      },
      {
        key: "youtube",
        label: "YouTube",
        fieldLabel: "",
        fieldHelp: "",
        oauthReady: false,
        connectedFn: (i) => ({
          connected: i?.socialPublishing?.provider === "youtube" && !!i?.socialPublishing?.hasAccessToken,
        }),
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
        fieldHelp: "At app.hubspot.com → Settings → Integrations → Private apps, create one.",
        connectedFn: (i) => ({
          connected: i?.crm?.provider === "hubspot" && !!i?.crm?.hasApiKey,
        }),
        patch: (value) => ({ crm: { provider: "hubspot", apiKey: value } }),
      },
      {
        key: "salesforce",
        label: "Salesforce",
        fieldLabel: "",
        fieldHelp: "",
        oauthReady: false,
        connectedFn: (i) => ({
          connected: i?.crm?.provider === "salesforce" && !!i?.crm?.hasApiKey,
        }),
        patch: () => ({}),
      },
      {
        key: "pipedrive",
        label: "Pipedrive",
        fieldLabel: "Pipedrive API token",
        fieldHelp: "In Pipedrive → Personal preferences → API, copy your token.",
        connectedFn: (i) => ({
          connected: i?.crm?.provider === "pipedrive" && !!i?.crm?.hasApiKey,
        }),
        patch: (value) => ({ crm: { provider: "pipedrive", apiKey: value } }),
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
        fieldHelp: "In Twilio Console → Account Info, copy your Auth Token.",
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
        fieldHelp: "At polygon.io/dashboard/api-keys, copy your key.",
        connectedFn: (i) => ({
          connected: i?.marketData?.provider === "polygon" && !!i?.marketData?.hasApiKey,
        }),
        patch: (value) => ({ marketData: { provider: "polygon", apiKey: value } }),
      },
      {
        key: "alphavantage",
        label: "Alpha Vantage",
        fieldLabel: "Alpha Vantage API key",
        fieldHelp: "At alphavantage.co/support/#api-key, request a free key.",
        connectedFn: (i) => ({
          connected: i?.marketData?.provider === "alphavantage" && !!i?.marketData?.hasApiKey,
        }),
        patch: (value) => ({ marketData: { provider: "alphavantage", apiKey: value } }),
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
        fieldLabel: "Webhook secret",
        fieldHelp:
          "Pick any string. Add it as ?secret=... to your TradingView alert webhook URL. Zed uses it to verify inbound alerts.",
        connectedFn: (i) => ({
          connected: !!i?.tradingView?.hasAlertWebhookSecret,
        }),
        patch: (value) => ({ tradingView: { alertWebhookSecret: value } }),
      },
    ],
  },
];

function friendlyGroupTitle(t: string): string {
  return t;
}

export default function IntegrationsSection() {
  const [integrations, setIntegrations] = useState<any>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [loadError, setLoadError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [dialog, setDialog] = useState<{ provider: Provider; group: ProviderGroup } | null>(null);
  const [dialogValue, setDialogValue] = useState<string>("");
  const [customDialog, setCustomDialog] = useState<{
    group: ProviderGroup;
    label: string;
    value: string;
  } | null>(null);

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
      // Best-effort: send an empty patch for the provider category.
      // Server preserves values not present in the patch, so we send
      // an explicit blank credential to clear it.
      const clear = row.patch("");
      await submit(clear);
    },
    [submit],
  );

  const header = useMemo(
    () => (
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
            Connections
          </h2>
          <p className="mt-1.5 text-[13.5px] text-white/50 max-w-full sm:max-w-[62ch] leading-snug">
            Sign in to the services you want Zed to reach — each provider is listed separately. Tap Connect and Zed will ask for the one thing it needs.
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

      {GROUPS.map((group, gi) => (
        <SettingGroup
          key={group.title}
          title={friendlyGroupTitle(group.title)}
          count={group.providers.length}
          collapsible
          defaultCollapsed={gi > 0}
        >
          {group.providers.map((provider) => {
            const state = provider.connectedFn(integrations);
            return (
              <SettingRow
                key={provider.key}
                label={state.connected && state.account ? `${provider.label} — ${state.account}` : provider.label}
                description={group.description}
              >
                {state.connected ? (
                  <button
                    type="button"
                    onClick={() => void disconnect(provider)}
                    className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/80 hover:text-red-300 hover:border-red-400/40 transition-colors active:opacity-80"
                  >
                    Disconnect
                  </button>
                ) : provider.oauthReady === false && !provider.fieldLabel ? (
                  <span
                    className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-white/40"
                    title="This one needs Zed to be registered with the provider first."
                  >
                    Sign-in not set up yet
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setDialog({ provider, group });
                      setDialogValue("");
                    }}
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
                onClick={() =>
                  setCustomDialog({ group, label: "", value: "" })
                }
                className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/70 hover:text-white/90 transition-colors active:opacity-80"
              >
                + Add
              </button>
            </SettingRow>
          )}
        </SettingGroup>
      ))}

      {dialog && (
        <SignInDialog
          title={`Sign in to ${dialog.provider.label}`}
          fieldLabel={dialog.provider.fieldLabel}
          fieldHelp={dialog.provider.fieldHelp}
          value={dialogValue}
          onChange={setDialogValue}
          onCancel={() => setDialog(null)}
          onSave={async () => {
            const trimmed = dialogValue.trim();
            if (!trimmed) return;
            const ok = await submit(dialog.provider.patch(trimmed));
            if (ok) setDialog(null);
          }}
        />
      )}

      {customDialog && (
        <SignInDialog
          title={`Add custom ${customDialog.group.title.toLowerCase()} entry`}
          fieldLabel="Value"
          fieldHelp={`Give it a name and paste the credential. Stored under integrations.custom on the server.`}
          extraLabelValue={customDialog.label}
          onExtraLabelChange={(v) => setCustomDialog({ ...customDialog, label: v })}
          value={customDialog.value}
          onChange={(v) => setCustomDialog({ ...customDialog, value: v })}
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
 * Small in-page dialog used for both "sign in to X" and "add custom".
 * One text field (or two for custom — a name + a value). No modal
 * library dependency; renders a fixed overlay.
 */
function SignInDialog({
  title,
  fieldLabel,
  fieldHelp,
  value,
  onChange,
  onCancel,
  onSave,
  extraLabelValue,
  onExtraLabelChange,
}: {
  title: string;
  fieldLabel: string;
  fieldHelp: string;
  value: string;
  onChange: (next: string) => void;
  onCancel: () => void;
  onSave: () => void | Promise<void>;
  extraLabelValue?: string;
  onExtraLabelChange?: (next: string) => void;
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
        <h3 className="text-[16.5px] font-semibold text-white mb-1">{title}</h3>
        {fieldHelp && (
          <p className="mt-1 text-[12.5px] text-white/50 leading-snug">{fieldHelp}</p>
        )}

        {onExtraLabelChange && (
          <div className="mt-4">
            <label className="block text-[12.5px] font-medium text-white/70 mb-1">
              Name
            </label>
            <input
              type="text"
              autoFocus
              value={extraLabelValue}
              onChange={(e) => onExtraLabelChange(e.target.value)}
              placeholder="e.g. Vercel prod, Stripe test"
              className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 placeholder:text-white/30"
            />
          </div>
        )}

        <div className="mt-4">
          <label className="block text-[12.5px] font-medium text-white/70 mb-1">
            {fieldLabel}
          </label>
          <input
            type="password"
            autoFocus={!onExtraLabelChange}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Paste here"
            className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 placeholder:text-white/30"
          />
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
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
            className="inline-flex items-center rounded-lg bg-cyan-400 text-black font-medium px-3.5 py-1.5 text-[13px] hover:bg-cyan-300 transition-colors active:opacity-80"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
