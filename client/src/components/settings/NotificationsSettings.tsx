import { useEffect, useState } from "react";
import { Bell, BellRing, MessageSquare, Zap } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requestNotificationPermission, notificationPermission } from "@/lib/notify";
import type { AppSettings } from "@/hooks/useAppSettings";

interface NotificationsSettingsProps {
  appSettings: AppSettings;
  setAppSettings: React.Dispatch<React.SetStateAction<any>>;
}

export default function NotificationsSettings({
  appSettings,
  setAppSettings,
}: NotificationsSettingsProps) {
  const [permStatus, setPermStatus] = useState<string>(notificationPermission());

  useEffect(() => {
    setPermStatus(notificationPermission());
  }, []);

  async function handleMasterToggle(checked: boolean) {
    if (checked && permStatus !== "granted") {
      const granted = await requestNotificationPermission();
      setPermStatus(notificationPermission());
      if (!granted) {
        setAppSettings((prev: any) => ({ ...prev, notifications: false }));
        return;
      }
    }
    setAppSettings((prev: any) => ({ ...prev, notifications: checked }));
  }

  const items = [
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
      description: "Notify when ZED responds (background tab only)",
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

  const masterOn = appSettings.notifications !== false;

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
        {/* Permission status banner */}
        {permStatus === "denied" && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-300">
            Browser notifications are blocked. Enable them in your browser site settings, then toggle on here.
          </div>
        )}
        {permStatus === "unsupported" && (
          <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-3 py-2 text-xs text-yellow-300">
            Browser notifications are not supported in this environment.
          </div>
        )}

        {/* Master toggle */}
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-white/10">
          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 mt-0.5 flex-shrink-0 text-yellow-400" />
            <div>
              <p className="text-sm font-medium">All Notifications</p>
              <p className="text-xs text-muted-foreground">Enable or disable all notifications</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {permStatus === "granted" && masterOn && (
              <Badge className="text-[10px] bg-green-500/20 text-green-300 border-green-500/30">Active</Badge>
            )}
            <Switch
              checked={masterOn}
              onCheckedChange={handleMasterToggle}
              disabled={permStatus === "denied" || permStatus === "unsupported"}
            />
          </div>
        </div>

        {/* Individual toggles */}
        {items.map(({ key, label, description, icon: Icon, color }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${color}`} />
              <div>
                <p className={`text-sm font-medium ${!masterOn ? "text-muted-foreground" : ""}`}>{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </div>
            <Switch
              checked={masterOn && ((appSettings as any)[key] !== false)}
              onCheckedChange={(checked) =>
                setAppSettings((prev: any) => ({ ...prev, [key]: checked }))
              }
              disabled={!masterOn || permStatus === "denied" || permStatus === "unsupported"}
            />
          </div>
        ))}

        {permStatus === "default" && (
          <Button
            size="sm"
            variant="outline"
            className="w-full border-white/10 text-muted-foreground"
            onClick={async () => {
              await requestNotificationPermission();
              setPermStatus(notificationPermission());
            }}
          >
            Request Notification Permission
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
