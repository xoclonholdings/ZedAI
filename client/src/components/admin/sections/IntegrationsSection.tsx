import { useCallback, useEffect, useMemo, useState } from "react";

import {
  LoadErrorBanner,
  SaveIndicator,
  SettingGroup,
  SettingRow,
} from "./settings/atoms";

/**
 * Plain-language Integrations surface.
 *
 * Replaces the previous token / client-ID / refresh-token forms
 * with "Connect [Service]" cards. Each row shows honest connection
 * status. Behind each Connect button:
 *   - If Zed's backend has an OAuth flow wired for the service,
 *     tapping Connect starts the redirect.
 *   - If not yet wired, the row is disabled with a plain-language
 *     "Sign-in isn't set up yet" note. No jargon leaks.
 *
 * The nested account panels (SimpleIntegrationPanel, MultiAccount
 * Panel, account-forms) still live under ./integrations/ and are
 * reachable from a separate Advanced surface for engineers who
 * need to paste raw credentials — that's a follow-up.
 */

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface IntegrationRow {
  key: string;
  label: string;
  description: string;
  oauthReady: boolean;
  connectedFn: (integrations: any) => { connected: boolean; account?: string };
}

const GROUPS: Array<{ title: string; items: IntegrationRow[] }> = [
  {
    title: "Communication",
    items: [
      {
        key: "google",
        label: "Google (Gmail, Calendar, Drive)",
        description: "Sign in to Google so Zed can read and send Gmail, view your calendar, and open files in Drive.",
        oauthReady: false,
        connectedFn: (i) => {
          const acc = (i?.google?.accounts || [])[0];
          return {
            connected: Boolean(acc?.hasCredentials),
            account: acc?.label,
          };
        },
      },
      {
        key: "email",
        label: "Email (other providers)",
        description: "Connect a non-Google email account so Zed can send outbound mail on your behalf.",
        oauthReady: false,
        connectedFn: (i) => {
          const acc = (i?.email?.accounts || [])[0];
          return {
            connected: Boolean(acc?.hasPassword),
            account: acc?.fromAddress || acc?.label,
          };
        },
      },
      {
        key: "telephony",
        label: "Phone & voicemail",
        description: "Give Zed a phone number for calls, voicemail, and text messages.",
        oauthReady: false,
        connectedFn: (i) => ({
          connected: Boolean(i?.telephony?.hasApiKey),
          account: i?.telephony?.phoneNumber,
        }),
      },
    ],
  },
  {
    title: "Work",
    items: [
      {
        key: "github",
        label: "GitHub",
        description: "Sign in to GitHub so Zed can read repos, open issues, and post pull requests when you approve.",
        oauthReady: false,
        connectedFn: (i) => {
          const acc = (i?.github?.accounts || [])[0];
          return {
            connected: Boolean(acc?.hasToken),
            account: acc?.owner ? `${acc.owner}/${acc.repo || ""}` : acc?.label,
          };
        },
      },
      {
        key: "deployment",
        label: "Deployment",
        description: "Connect your host so Zed can trigger deploys when you approve.",
        oauthReady: false,
        connectedFn: (i) => ({
          connected: Boolean(i?.deployment?.hasAccessToken),
          account: i?.deployment?.provider,
        }),
      },
      {
        key: "cloudStorage",
        label: "Cloud files",
        description: "Sign in to Drive, Dropbox, or OneDrive so Zed can pull in documents.",
        oauthReady: false,
        connectedFn: (i) => ({
          connected: Boolean(i?.cloudStorage?.hasAccessToken),
          account: i?.cloudStorage?.provider,
        }),
      },
    ],
  },
  {
    title: "Money",
    items: [
      {
        key: "payments",
        label: "Payments",
        description: "Sign in to Stripe, PayPal, or Square so Zed can send invoices and see revenue.",
        oauthReady: false,
        connectedFn: (i) => ({
          connected: Boolean(i?.payments?.hasSecretKey),
          account: i?.payments?.provider,
        }),
      },
      {
        key: "accounting",
        label: "Accounting",
        description: "Connect QuickBooks, Xero, or Wave so Zed can pull cashflow and reporting.",
        oauthReady: false,
        connectedFn: (i) => ({
          connected: Boolean(i?.accounting?.hasCredentials),
          account: i?.accounting?.provider,
        }),
      },
    ],
  },
  {
    title: "Content & audience",
    items: [
      {
        key: "socialPublishing",
        label: "Social publishing",
        description: "Sign in to your social accounts so Zed can draft and publish (with approval).",
        oauthReady: false,
        connectedFn: (i) => ({
          connected: Boolean(i?.socialPublishing?.hasAccessToken),
          account: i?.socialPublishing?.provider,
        }),
      },
      {
        key: "crm",
        label: "CRM",
        description: "Connect your CRM so Zed can see and update contacts and deals.",
        oauthReady: false,
        connectedFn: (i) => ({
          connected: Boolean(i?.crm?.hasApiKey),
          account: i?.crm?.provider,
        }),
      },
    ],
  },
  {
    title: "Research & trading",
    items: [
      {
        key: "marketData",
        label: "Market data",
        description: "Connect a market data provider so Zed can pull price and fundamentals.",
        oauthReady: false,
        connectedFn: (i) => ({
          connected: Boolean(i?.marketData?.hasApiKey),
          account: i?.marketData?.provider,
        }),
      },
      {
        key: "tradingView",
        label: "TradingView",
        description: "Send TradingView chart snapshots and alerts to Zed's trading journal.",
        oauthReady: false,
        connectedFn: (i) => ({
          connected: Boolean(i?.tradingView?.hasAlertWebhookSecret),
        }),
      },
    ],
  },
];

export default function IntegrationsSection() {
  const [integrations, setIntegrations] = useState<any>(null);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [loadError, setLoadError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

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

  const disconnect = useCallback(
    async (row: IntegrationRow) => {
      const label = row.label.replace(/\s*\(.*\)/, "");
      if (!window.confirm(`Disconnect ${label}? Zed will stop using this account.`)) return;
      setStatus("saving");
      setErrorMessage(undefined);
      try {
        const res = await fetch(`/api/admin/integrations/${row.key}/disconnect`, {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `Disconnect failed (${res.status})`);
        }
        await load();
        setStatus("saved");
        window.setTimeout(() => setStatus("idle"), 1500);
      } catch (err: any) {
        setErrorMessage(err?.message);
        setStatus("error");
      }
    },
    [load],
  );

  const connect = useCallback((row: IntegrationRow) => {
    if (!row.oauthReady) return;
    // Real OAuth wiring lands in a follow-up PR. The endpoint below
    // is the future entry point — right now it 404s, which is fine
    // because oauthReady=false gates the button from being clickable.
    window.location.href = `/api/admin/integrations/${row.key}/connect/start`;
  }, []);

  const header = useMemo(
    () => (
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
            Connections
          </h2>
          <p className="mt-1.5 text-[13.5px] text-white/50 max-w-[62ch] leading-snug">
            Sign in to the services you want Zed to reach — email, calendar, files, deploy, and so on. Zed handles the technical bits behind the scenes. No tokens or keys to paste.
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

      {GROUPS.map((group, groupIndex) => (
        <SettingGroup
          key={group.title}
          title={group.title}
          count={group.items.length}
          collapsible
          defaultCollapsed={groupIndex > 0}
        >
          {group.items.map((row) => {
            const state = integrations ? row.connectedFn(integrations) : { connected: false };
            return (
              <SettingRow
                key={row.key}
                label={
                  state.connected && state.account
                    ? `${row.label} — ${state.account}`
                    : row.label
                }
                description={row.description}
              >
                {state.connected ? (
                  <button
                    type="button"
                    onClick={() => void disconnect(row)}
                    className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/80 hover:text-red-300 hover:border-red-400/40 transition-colors active:opacity-80"
                  >
                    Disconnect
                  </button>
                ) : row.oauthReady ? (
                  <button
                    type="button"
                    onClick={() => connect(row)}
                    className="inline-flex items-center rounded-lg bg-cyan-400 text-black font-medium px-3.5 py-1.5 text-[13px] hover:bg-cyan-300 transition-colors active:opacity-80"
                  >
                    Connect
                  </button>
                ) : (
                  <span
                    className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[12.5px] text-white/40"
                    title="Sign-in for this service isn't set up on Zed yet."
                  >
                    Sign-in not set up yet
                  </span>
                )}
              </SettingRow>
            );
          })}
        </SettingGroup>
      ))}

      <p className="mt-8 pt-5 border-t border-white/[0.06] text-[12.5px] text-white/40 leading-snug max-w-[62ch]">
        Some services still need Zed to be registered with them before you can sign in — that's what "Sign-in not set up yet" means. As each one is registered, its Connect button turns on automatically.
      </p>
    </div>
  );
}
