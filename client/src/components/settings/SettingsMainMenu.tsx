import {
  Archive,
  Bell,
  Briefcase,
  ChevronRight,
  Lock,
  Shield,
  SlidersHorizontal,
  User,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";

interface SettingsMainMenuProps {
  isAdmin?: boolean;
  onNavigate: (section: string) => void;
}

const menuItems = [
  {
    key: "rules",
    label: "Rules & Parameters",
    icon: SlidersHorizontal,
    color: "text-purple-400",
  },
  {
    key: "personalization",
    label: "Personalization",
    icon: User,
    color: "text-cyan-400",
  },
  {
    key: "notifications",
    label: "Notifications",
    icon: Bell,
    color: "text-yellow-400",
  },
  {
    key: "data",
    label: "Data Controls",
    icon: Shield,
    color: "text-pink-400",
  },
  {
    key: "archived",
    label: "Archived Chats",
    icon: Archive,
    color: "text-orange-400",
  },
  {
    key: "security",
    label: "Security",
    icon: Lock,
    color: "text-red-400",
  },
  {
    key: "integrations",
    label: "Integrations",
    icon: Briefcase,
    color: "text-emerald-400",
  },
];

export default function SettingsMainMenu({
  isAdmin = false,
  onNavigate,
}: SettingsMainMenuProps) {
  return (
    <div className="space-y-1">
      {menuItems.map(({ key, label, icon: Icon, color }) => (
        <Button
          key={key}
          variant="ghost"
          onClick={() => onNavigate(key)}
          className="w-full justify-between p-4 text-left zed-glass rounded-xl"
        >
          <div className="flex items-center space-x-3">
            <Icon className={`h-5 w-5 ${color}`} />
            <span>{label}</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Button>
      ))}

      {isAdmin && (
        <Button
          variant="ghost"
          onClick={() => onNavigate("admin")}
          className="w-full justify-between p-4 text-left zed-glass rounded-xl"
        >
          <div className="flex items-center space-x-3">
            <Users className="h-5 w-5 text-green-400" />
            <span>Admin</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Button>
      )}
    </div>
  );
}
