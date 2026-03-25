import { Bell } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  return (
    <Card className="zed-glass border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notifications
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-foreground">Enable Notifications</span>

          <Switch
            checked={appSettings.notifications}
            onCheckedChange={(checked) =>
              setAppSettings((prev: any) => ({
                ...prev,
                notifications: checked,
              }))
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}