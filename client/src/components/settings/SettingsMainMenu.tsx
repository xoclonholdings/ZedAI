import {
  Archive,
  ChevronRight,
  Lock,
  SlidersHorizontal,
  User,
  Users,
} from "lucide-react";

import { useAuth } from "@/components/auth/UseAuth";

/**
 * Plain-language main menu for the user Settings modal.
 *
 * This surface reads on mobile, mirrors the row style used across
 * the /admin panel (label + one-line description + chevron), and
 * uses friendlier copy than the previous jargon list. Nothing about
 * what each row leads to has changed — same section keys, same
 * downstream components — just what the user reads.
 */

interface SettingsMainMenuProps {
  isAdmin?: boolean;
  onNavigate: (section: string) => void;
}

interface MenuItem {
  key: string;
  label: string;
  description: string;
  icon: typeof User;
  color: string;
}

const menuItems: MenuItem[] = [
  {
    key: "preferences",
    label: "Preferences",
    description: "Your name, how the app looks, and how ZAR talks back.",
    icon: User,
    color: "text-cyan-400",
  },
  {
    key: "workspace",
    label: "Projects & workspaces",
    description: "Organize what ZAR's working on. Set project scope and privacy.",
    icon: SlidersHorizontal,
    color: "text-purple-400",
  },
  {
    key: "security",
    label: "Sign-in & session",
    description: "How long you stay signed in. Sign out of this device.",
    icon: Lock,
    color: "text-red-400",
  },
  {
    key: "archived",
    label: "Archived chats",
    description: "Chats you've hidden. Restore them or delete for good.",
    icon: Archive,
    color: "text-orange-400",
  },
];

export default function SettingsMainMenu({
  isAdmin = false,
  onNavigate,
}: SettingsMainMenuProps) {
  const { user } = useAuth();
  const compact = !!user?.personalization?.compactMessages;
  const padding = compact ? "py-3" : "py-3.5";

  return (
    <div>
      {menuItems.map(({ key, label, description, icon: Icon, color }) => (
        <button
          key={key}
          type="button"
          onClick={() => onNavigate(key)}
          className={`w-full ${padding} border-t border-white/[0.06] first:border-t-0 flex items-center gap-4 text-left transition-colors active:opacity-70`}
        >
          <Icon className={`h-5 w-5 shrink-0 ${color}`} />
          <div className="min-w-0 flex-1">
            <div className="text-[14.5px] font-medium text-white/90">{label}</div>
            <div className="mt-0.5 text-[12.5px] text-white/50 leading-snug">
              {description}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />
        </button>
      ))}

      {isAdmin && (
        <button
          type="button"
          onClick={() => onNavigate("admin")}
          className={`w-full ${padding} border-t border-white/[0.06] flex items-center gap-4 text-left transition-colors active:opacity-70`}
        >
          <Users className="h-5 w-5 shrink-0 text-green-400" />
          <div className="min-w-0 flex-1">
            <div className="text-[14.5px] font-medium text-white/90">Admin Panel</div>
            <div className="mt-0.5 text-[12.5px] text-white/50 leading-snug">
              Connections, approvals, activity, security — the full admin surface.
            </div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />
        </button>
      )}
    </div>
  );
}
