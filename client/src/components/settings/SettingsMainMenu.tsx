import {
  Archive,
  Bell,
  ChevronRight,
  Lock,
  Shield,
  User,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";

interface SettingsMainMenuProps {
  isAdmin?: boolean;
  onNavigate: (section: string) => void;
}

export default function SettingsMainMenu({
  isAdmin = false,
  onNavigate,
}: SettingsMainMenuProps) {
  return (
    <div className="space-y-2">
      <Button
        variant="ghost"
        onClick={() => onNavigate("personalization")}
        className="w-full justify-between p-4 text-left zed-glass"
      >
        <div className="flex items-center space-x-3">
          <User className="h-5 w-5 text-purple-400" />
          <span>Personalization</span>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Button>

      <Button
        variant="ghost"
        onClick={() => onNavigate("notifications")}
        className="w-full justify-between p-4 text-left zed-glass"
      >
        <div className="flex items-center space-x-3">
          <Bell className="h-5 w-5 text-cyan-400" />
          <span>Notifications</span>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Button>

      <Button
        variant="ghost"
        onClick={() => onNavigate("data")}
        className="w-full justify-between p-4 text-left zed-glass"
      >
        <div className="flex items-center space-x-3">
          <Shield className="h-5 w-5 text-pink-400" />
          <span>Data Controls</span>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Button>

      <Button
        variant="ghost"
        onClick={() => onNavigate("archived")}
        className="w-full justify-between p-4 text-left zed-glass"
      >
        <div className="flex items-center space-x-3">
          <Archive className="h-5 w-5 text-yellow-400" />
          <span>Archived Chats</span>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Button>

      <Button
        variant="ghost"
        onClick={() => onNavigate("security")}
        className="w-full justify-between p-4 text-left zed-glass"
      >
        <div className="flex items-center space-x-3">
          <Lock className="h-5 w-5 text-red-400" />
          <span>Security</span>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Button>

      {isAdmin && (
        <Button
          variant="ghost"
          onClick={() => onNavigate("admin")}
          className="w-full justify-between p-4 text-left zed-glass"
        >
          <div className="flex items-center space-x-3">
            <Users className="h-5 w-5 text-orange-400" />
            <span>Admin</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Button>
      )}
    </div>
  );
}