import { LogOut } from "lucide-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/components/auth/UseAuth";

/**
 * A persistent, always-visible sign-out control - present in the console
 * header on every screen (home and every workspace), not just buried under
 * Settings > Sign-in & session.
 */
export function ConsoleLogoutButton() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { logout } = useAuth() as { logout: () => Promise<void> };

  async function handleLogout() {
    await logout();
    queryClient.clear();
    navigate("/");
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      aria-label="Sign out"
      title="Sign out"
      className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white/50 backdrop-blur transition hover:border-red-300/40 hover:text-red-200 focus:outline-none focus:ring-2 focus:ring-cyan-200/50"
    >
      <LogOut size={14} />
    </button>
  );
}
