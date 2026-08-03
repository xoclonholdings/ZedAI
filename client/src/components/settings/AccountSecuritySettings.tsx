import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/components/auth/UseAuth";

import {
  SaveIndicator,
  SettingGroup,
  SettingRow,
} from "@/components/admin/sections/settings/atoms";

/**
 * Plain-language Sign-in & session surface.
 *
 * Shows the current account, access level, a real username/password
 * change form (POST /api/auth/update-credentials - the same route the
 * server docs itself as "logged-in user changes their own username/
 * password"), and a Sign out button.
 */

type SettingsUser = {
  username?: string;
  displayName?: string;
  email?: string;
  isAdmin?: boolean;
  claims?: { isAdmin?: boolean };
};

export default function AccountSecuritySettings() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { user, logout } = useAuth() as {
    user?: SettingsUser | null;
    logout: () => Promise<void>;
  };
  const isAdmin =
    !!user?.isAdmin ||
    !!user?.claims?.isAdmin ||
    user?.email === "admin@zed-ai.online";

  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/current-credentials", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.username) setCurrentUsername(data.username);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleUpdateCredentials() {
    if (!newUsername.trim() && !newPassword) return;
    if (newPassword && newPassword !== confirmPassword) {
      setStatus("error");
      setErrorMessage("Passwords don't match");
      return;
    }

    setStatus("saving");
    setErrorMessage(undefined);
    try {
      const res = await fetch("/api/auth/update-credentials", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newUsername: newUsername.trim() || undefined,
          newPassword: newPassword || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);

      if (body?.user?.username) setCurrentUsername(body.user.username);
      setNewUsername("");
      setNewPassword("");
      setConfirmPassword("");
      setStatus("saved");
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err?.message || "Failed to update credentials");
    }
  }

  async function handleLogout() {
    await logout();
    queryClient.clear();
    navigate("/");
  }

  return (
    <div>
      <header className="mb-6">
        <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
          Sign-in & session
        </h2>
        <p className="mt-1.5 text-[13.5px] text-white/50 max-w-full sm:max-w-[62ch] leading-snug">
          The account you're currently signed in with. Sign out to clear this device.
        </p>
      </header>

      <SettingGroup title="Signed in as">
        <SettingRow label="Name" description="Whoever you told ZAR you are.">
          <span className="text-[13px] text-white/80 truncate max-w-[200px]">
            {user?.displayName || currentUsername || user?.username || "Current user"}
          </span>
        </SettingRow>

        <SettingRow label="Username" description="What you sign in with.">
          <span className="text-[13px] text-white/80 truncate max-w-[220px]">
            {currentUsername || user?.username || "Not available"}
          </span>
        </SettingRow>

        <SettingRow label="Email" description="Where notifications and sign-in links go.">
          <span className="text-[13px] text-white/80 truncate max-w-[220px]">
            {user?.email || "Not provided"}
          </span>
        </SettingRow>

        <SettingRow
          label="Access level"
          description={
            isAdmin
              ? "You can change anything about ZAR's setup."
              : "You can chat and use ZAR, but not change setup."
          }
        >
          <span
            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-[0.06em] ${
              isAdmin
                ? "bg-emerald-400/15 text-emerald-300"
                : "bg-white/10 text-white/60"
            }`}
          >
            {isAdmin ? "admin" : "user"}
          </span>
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Change username & password">
        <SettingRow
          label="New username"
          description="Leave blank to keep your current username."
          stack
        >
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder={currentUsername || "New username"}
            autoComplete="username"
            className="w-full min-w-0 max-w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13.5px] text-white placeholder:text-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
          />
        </SettingRow>

        <SettingRow
          label="New password"
          description="Leave blank to keep your current password."
          stack
        >
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              autoComplete="new-password"
              className="w-full min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13.5px] text-white placeholder:text-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
              className="w-full min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13.5px] text-white placeholder:text-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40"
            />
          </div>
        </SettingRow>

        <div className="mt-1 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3.5">
          <SaveIndicator
            status={status === "idle" ? "idle" : status}
            errorMessage={errorMessage}
          />
          <button
            type="button"
            onClick={() => void handleUpdateCredentials()}
            disabled={status === "saving" || (!newUsername.trim() && !newPassword)}
            className="shrink-0 rounded-lg bg-cyan-400 px-3.5 py-1.5 text-[13px] font-medium text-black transition-colors hover:bg-cyan-300 disabled:opacity-40"
          >
            {status === "saving" ? "Saving…" : "Save changes"}
          </button>
        </div>
      </SettingGroup>

      <SettingGroup title="This device">
        <SettingRow
          label="Sign out"
          description="Clears your session here. You'll be asked to sign in again."
        >
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/80 hover:text-red-300 hover:border-red-400/40 transition-colors active:opacity-80"
          >
            <LogOut size={13} />
            Sign out
          </button>
        </SettingRow>
      </SettingGroup>

      <p className="mt-8 pt-5 border-t border-white/[0.06] text-[12.5px] text-white/40 leading-snug max-w-full sm:max-w-[62ch]">
        Session-timeout and lockout policy live in the Admin panel under Security.
      </p>
    </div>
  );
}
