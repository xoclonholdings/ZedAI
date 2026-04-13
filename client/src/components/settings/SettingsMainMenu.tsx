import {
  Bell,
  Briefcase,
  ChevronRight,
  Lock,
  FolderKanban,
} from "lucide-react";

import { Button } from "@/components/ui/button";

interface SettingsMainMenuProps {
  onNavigate: (section: string) => void;
}

const menuItems = [
  {
    key: "preferences",
    label: "Preferences",
    icon: Bell,
    color: "text-yellow-400",
  },
  {
    key: "workspace",
    label: "Workspace",
    icon: FolderKanban,
    color: "text-purple-400",
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
    </div>
  );
}
