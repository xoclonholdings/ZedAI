import { LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/components/auth/UseAuth";

import {
  SettingGroup,
  SettingRow,
} from "@/components/admin/sections/settings/atoms";

/**
 * Plain-language Sign-in & session surface.
 *
 * Shows the current Privy/admin account, access level, and a Sign out
 * button. Username/password credentials are not part of ZAR sign-in.
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
    user?.email === "admin@zar-ai.online";

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
            {user?.displayName || user?.username || "Current user"}
          </span>
        </SettingRow>

        <SettingRow label="Sign-in" description="How this account is verified.">
          <span className="text-[13px] text-white/80 truncate max-w-[220px]">
            {isAdmin ? "Admin secure phrase" : "Privy email code"}
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
