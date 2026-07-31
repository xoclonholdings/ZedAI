import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import {
  LoadErrorBanner,
  SaveIndicator,
  SettingGroup,
  SettingRow,
} from "./settings/atoms";

/**
 * Plain-language Security surface.
 *
 * Merges what used to be three separate cards (AdminSecuritySettings,
 * managed users, security log) into the SettingRow / SettingGroup
 * pattern so it matches the rest of the admin panel and reads on
 * mobile.
 *
 * Behind the scenes it still hits the same endpoints:
 *   GET/PUT   /api/admin/settings/security
 *   GET/POST  /api/admin/users
 *   GET       /api/admin/security-log
 * Nothing functional was removed — only the visual language changed.
 */

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface ManagedUser {
  id: string;
  username: string;
  isAdmin?: boolean;
  isActive?: boolean;
  email?: string;
}

interface SecurityEvent {
  type: string;
  timestamp: string;
  detail?: string;
  userId?: string;
}

interface SecuritySettings {
  adminUsername: string;
  sessionTimeoutMinutes: number;
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
  requireSecureCookies: boolean;
}

const DEFAULTS: SecuritySettings = {
  adminUsername: "Admin",
  sessionTimeoutMinutes: 45,
  maxFailedAttempts: 10,
  lockoutDurationMinutes: 1,
  requireSecureCookies: false,
};

function friendlyEventType(t: string): string {
  const map: Record<string, string> = {
    "auth.login.success": "Someone signed in",
    "auth.login.fail": "Failed sign-in attempt",
    "auth.session_expired": "Session expired",
    "auth.lockout": "Account temporarily locked",
    "auth.logout": "Someone signed out",
    "tier.violation": "Permission tier violation",
    "tier.block": "Permission tier blocked an action",
    "policy.external_api.denied": "Policy blocked an outbound call",
  };
  return map[t] || t.replace(/[._]/g, " ");
}

function friendlyTime(t: string): string {
  try {
    const d = new Date(t);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const min = Math.round(diffMs / 60000);
    if (min < 1) return "just now";
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return d.toLocaleString();
  } catch {
    return t;
  }
}

export default function SecuritySection() {
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULTS);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [loadError, setLoadError] = useState<boolean>(false);
  const [addUserOpen, setAddUserOpen] = useState<boolean>(false);
  const [newUser, setNewUser] = useState({ username: "", password: "" });

  const load = useCallback(async () => {
    try {
      const [settingsRes, usersRes, logRes] = await Promise.all([
        fetch("/api/admin/settings", { credentials: "include" }),
        fetch("/api/admin/users", { credentials: "include" }),
        fetch("/api/admin/security-log", { credentials: "include" }),
      ]);
      if (!settingsRes.ok || !usersRes.ok) throw new Error("load_failed");
      const settingsData = await settingsRes.json();
      const usersData = await usersRes.json();
      const logData = logRes.ok ? await logRes.json() : { events: [] };

      const auth = settingsData?.auth || {};
      setSettings({
        adminUsername: auth.adminUsername || "Admin",
        sessionTimeoutMinutes: auth.sessionTimeoutMinutes ?? 45,
        maxFailedAttempts: auth.maxFailedAttempts ?? 10,
        lockoutDurationMinutes: auth.lockoutDurationMinutes ?? 1,
        requireSecureCookies: Boolean(auth.requireSecureCookies),
      });
      setUsers(usersData.users || []);
      setEvents((logData.events || []).slice(-20).reverse());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateSetting = useCallback(
    async (patch: Partial<SecuritySettings>) => {
      setSettings((prev) => ({ ...prev, ...patch }));
      setStatus("saving");
      setErrorMessage(undefined);
      try {
        const res = await fetch("/api/admin/settings/security", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `Save failed (${res.status})`);
        }
        setStatus("saved");
        window.setTimeout(() => setStatus("idle"), 1500);
      } catch (err: any) {
        setErrorMessage(err?.message);
        setStatus("error");
      }
    },
    [],
  );

  const addUser = useCallback(async () => {
    if (!newUser.username.trim() || newUser.password.length < 8) return;
    setStatus("saving");
    setErrorMessage(undefined);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Add user failed (${res.status})`);
      }
      setNewUser({ username: "", password: "" });
      setAddUserOpen(false);
      await load();
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 1500);
    } catch (err: any) {
      setErrorMessage(err?.message);
      setStatus("error");
    }
  }, [newUser, load]);

  const header = useMemo(
    () => (
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
            Security
          </h2>
          <p className="mt-1.5 text-[13.5px] text-white/50 max-w-full sm:max-w-[62ch] leading-snug">
            Who can sign in, how long a session lasts, and what tripped ZAR's
            safety checks. If you're the only user right now, most of this is
            just here for later.
          </p>
        </div>
        <SaveIndicator status={status} errorMessage={errorMessage} />
      </header>
    ),
    [status, errorMessage],
  );

  return (
    <div>
      {header}
      {loadError && <LoadErrorBanner onRetry={() => void load()} />}

      <SettingGroup title="Sign-in safety">
        <SettingRow
          label="Session times out after"
          description="How long ZAR keeps you signed in without activity."
        >
          <select
            value={String(settings.sessionTimeoutMinutes)}
            onChange={(e) =>
              void updateSetting({ sessionTimeoutMinutes: Number(e.target.value) })
            }
            className="appearance-none bg-white/[0.04] border border-white/10 rounded-lg text-[13.5px] text-white px-3 py-2 pr-8 cursor-pointer hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
          >
            <option value="15" className="bg-neutral-900">15 minutes</option>
            <option value="30" className="bg-neutral-900">30 minutes</option>
            <option value="45" className="bg-neutral-900">45 minutes</option>
            <option value="60" className="bg-neutral-900">1 hour</option>
            <option value="120" className="bg-neutral-900">2 hours</option>
            <option value="480" className="bg-neutral-900">8 hours</option>
          </select>
        </SettingRow>

        <SettingRow
          label="Lock after failed sign-ins"
          description="ZAR locks the account for a while after this many wrong tries."
        >
          <select
            value={String(settings.maxFailedAttempts)}
            onChange={(e) =>
              void updateSetting({ maxFailedAttempts: Number(e.target.value) })
            }
            className="appearance-none bg-white/[0.04] border border-white/10 rounded-lg text-[13.5px] text-white px-3 py-2 pr-8 cursor-pointer hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
          >
            <option value="3" className="bg-neutral-900">3 tries</option>
            <option value="5" className="bg-neutral-900">5 tries</option>
            <option value="10" className="bg-neutral-900">10 tries</option>
          </select>
        </SettingRow>

        <SettingRow
          label="Lockout lasts"
          description="How long the account stays locked after too many failed sign-ins."
        >
          <select
            value={String(settings.lockoutDurationMinutes)}
            onChange={(e) =>
              void updateSetting({ lockoutDurationMinutes: Number(e.target.value) })
            }
            className="appearance-none bg-white/[0.04] border border-white/10 rounded-lg text-[13.5px] text-white px-3 py-2 pr-8 cursor-pointer hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
          >
            <option value="5" className="bg-neutral-900">5 minutes</option>
            <option value="15" className="bg-neutral-900">15 minutes</option>
            <option value="60" className="bg-neutral-900">1 hour</option>
            <option value="1440" className="bg-neutral-900">24 hours</option>
          </select>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Who can sign in" count={users.length} collapsible>
        {users.map((user) => (
          <SettingRow
            key={user.id}
            label={user.username}
            description={user.isAdmin ? "Admin — can change anything" : "Regular user"}
          >
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-[0.06em] ${
                user.isActive !== false
                  ? "bg-emerald-400/15 text-emerald-300"
                  : "bg-white/10 text-white/40"
              }`}
            >
              {user.isActive !== false ? "active" : "inactive"}
            </span>
          </SettingRow>
        ))}
        {addUserOpen ? (
          <SettingRow
            label="Add another user"
            description="Give them a username and a starting password. They can change it later."
            stack
          >
            <div className="flex flex-col gap-2 w-full">
              <input
                type="text"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                placeholder="Username"
                className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
              />
              <input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="Starting password (at least 8 characters)"
                className="w-full text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void addUser()}
                  className="rounded-lg bg-cyan-400 text-black font-medium px-3.5 py-1.5 text-[13px] hover:bg-cyan-300 transition-colors"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddUserOpen(false);
                    setNewUser({ username: "", password: "" });
                  }}
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/70 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          </SettingRow>
        ) : (
          <SettingRow label="Add another user" description="You can also let someone else sign in.">
            <button
              type="button"
              onClick={() => setAddUserOpen(true)}
              className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/70 hover:text-white/90 transition-colors active:opacity-80"
            >
              + Add user
            </button>
          </SettingRow>
        )}
      </SettingGroup>

      <SettingGroup
        title="Recent safety events"
        count={events.length}
        collapsible
        defaultCollapsed
      >
        {events.length === 0 ? (
          <SettingRow
            label="Nothing to see"
            description="No security events in the recent log. This is the good outcome."
          >
            <span className="text-[12.5px] text-white/40">clean</span>
          </SettingRow>
        ) : (
          events.map((evt, i) => (
            <SettingRow
              key={`${evt.timestamp}-${i}`}
              label={friendlyEventType(evt.type)}
              description={`${friendlyTime(evt.timestamp)}${evt.detail ? ` · ${evt.detail}` : ""}`}
            >
              <span className="text-[11.5px] text-white/40">{evt.userId || "system"}</span>
            </SettingRow>
          ))
        )}
      </SettingGroup>

      <div className="flex justify-end pt-5 mt-8 border-t border-white/[0.06]">
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12.5px] text-white/60 hover:text-white/90 hover:bg-white/[0.08] transition-colors"
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>
    </div>
  );
}
