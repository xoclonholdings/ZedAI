import { Bell, BellRing, MessageSquare, Zap } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

interface AppSettings {
  notifications: boolean;
}

interface NotificationsSettingsProps {
  appSettings: AppSettings;
  setAppSettings: React.Dispatch<React.SetStateAction<any>>;
}

export default function NotificationsSettings({
  appSettings,
  setAppSettings,
}: NotificationsSettingsProps) {
  const items = [
    {
      key: "notifications",
      label: "All Notifications",
      description: "Enable or disable all notifications",
      icon: Bell,
      color: "text-yellow-400",
    },
    {
      key: "agentAlerts",
      label: "Agent Task Alerts",
      description: "Notify when an agent completes or fails a task",
      icon: Zap,
      color: "text-purple-400",
    },
    {
      key: "messageNotifications",
      label: "New Message Alerts",
      description: "Notify when ZED responds to your message",
      icon: MessageSquare,
      color: "text-cyan-400",
    },
    {
      key: "systemAlerts",
      label: "System Alerts",
      description: "Critical updates, errors, and security events",
      icon: BellRing,
      color: "text-red-400",
    },
  ];

  return (
    <Card className="zed-glass border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-yellow-400" />
          Notifications
        </CardTitle>
        <CardDescription>
          Control which alerts and notifications you receive.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {items.map(({ key, label, description, icon: Icon, color }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${color}`} />
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </div>
            <Switch
              checked={(appSettings as any)[key] ?? true}
              onCheckedChange={(checked) =>
                setAppSettings((prev: any) => ({ ...prev, [key]: checked }))
              }
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
