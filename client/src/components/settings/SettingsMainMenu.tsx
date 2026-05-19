import {
  Archive,
  ChevronRight,
  Brain,
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
    icon: User,
    color: "text-cyan-400",
  },
  {
    key: "memory",
    label: "My Memory",
    icon: Brain,
    color: "text-blue-400",
  },
  {
    key: "workspace",
    label: "Workspace",
    icon: SlidersHorizontal,
    color: "text-purple-400",
  },
  {
    key: "security",
    label: "Security",
    icon: Lock,
    color: "text-red-400",
  },
  {
    key: "archived",
    label: "Archived Chats",
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
    <div className="space-y-1">
      {menuItems.map(({ key, label, icon: Icon, color }) => (
        <Button
          key={key}
          variant="ghost"
          onClick={() => onNavigate(key)}
          className={`w-full justify-between text-left zed-glass rounded-xl ${rowClass}`}
        >
          <div className="flex items-center space-x-3">
            <Icon className={`h-5 w-5 ${color}`} />
            <span className={labelClass}>{label}</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Button>
      ))}

      {isAdmin && (
        <Button
          variant="ghost"
          onClick={() => onNavigate("admin")}
          className={`w-full justify-between text-left zed-glass rounded-xl ${rowClass}`}
        >
          <div className="flex items-center space-x-3">
            <Users className="h-5 w-5 text-green-400" />
            <span className={labelClass}>Admin</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Button>
      )}
    </div>
  );
}
