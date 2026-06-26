import {
  Archive,
  Brain,
  ChevronRight,
  Lock,
  SlidersHorizontal,
  User,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/UseAuth";

interface SettingsMainMenuProps {
  isAdmin?: boolean;
  onNavigate: (section: string) => void;
}

const menuItems = [
  {
    key: "preferences",
    label: "Preferences",
    description: "Profile, display, voice, notifications",
    icon: User,
    color: "text-cyan-400",
  },
  {
    key: "memory",
    label: "My Memory",
    description: "Personal context ZED should remember",
    icon: Brain,
    color: "text-blue-400",
  },
  {
    key: "workspace",
    label: "Workspace",
    description: "Projects, workspaces, rules, data controls",
    icon: SlidersHorizontal,
    color: "text-purple-400",
  },
  {
    key: "security",
    label: "Security",
    description: "Account session, logout, admin policy",
    icon: Lock,
    color: "text-red-400",
  },
  {
    key: "archived",
    label: "Archived Chats",
    description: "Restore or permanently delete archived chats",
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
  const fontSize = (user?.personalization?.fontSize as "small" | "medium" | "large" | undefined) || "medium";
  const rowClass = compact ? "p-3" : "p-4";
  const labelClass = fontSize === "small" ? "text-sm" : fontSize === "large" ? "text-base" : "text-sm";

  return (
    <div className="space-y-2">
      {menuItems.map(({ key, label, description, icon: Icon, color }) => (
        <Button
          key={key}
          variant="ghost"
          onClick={() => onNavigate(key)}
          className={`h-auto w-full justify-between text-left zed-glass rounded-xl ${rowClass}`}
        >
          <div className="flex min-w-0 items-start gap-3">
            <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} />
            <span className="min-w-0">
              <span className={`block ${labelClass}`}>{label}</span>
              <span className="mt-0.5 block truncate text-[11px] leading-4 text-muted-foreground">
                {description}
              </span>
            </span>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      ))}

      {isAdmin && (
        <Button
          variant="ghost"
          onClick={() => onNavigate("admin")}
          className={`h-auto w-full justify-between text-left zed-glass rounded-xl ${rowClass}`}
        >
          <div className="flex min-w-0 items-start gap-3">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
            <span className="min-w-0">
              <span className={`block ${labelClass}`}>Admin Panel</span>
              <span className="mt-0.5 block truncate text-[11px] leading-4 text-muted-foreground">
                Providers, ruleset, approvals, logs
              </span>
            </span>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      )}
    </div>
  );
}
