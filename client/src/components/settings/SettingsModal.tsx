import { useState } from "react";
import {
  Archive,
  Bell,
  ChevronLeft,
  Lock,
  Settings,
  Shield,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { UseAuth } from "@/components/auth/UseAuth";
import UserManagement from "@/components/UserManagement";
import AdminSecuritySettings from "./AdminSecuritySettings";
import SettingsMainMenu from "./SettingsMainMenu";
import SettingsAppControls from "./SettingsAppControls";
import SettingsVoiceControls from "./SettingsVoiceControls";
import SettingsSuggestions from "./SettingsSuggestions";

import zLogoPath from "@assets/IMG_2227_1753477194826.png";

interface AppSettings {
  notifications: boolean;
  hapticFeedback: boolean;
  autoSpellCorrect: boolean;
  autoSendDictation: boolean;
  backgroundConversations: boolean;
  autocomplete: boolean;
  trendingSearches: boolean;
  followUpSuggestions: boolean;
  colorScheme: "dark" | "light" | "auto";
  language: string;
  voiceType: string;
}

export default function SettingsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("main");
  const [appSettings, setAppSettings] = useState<AppSettings>({
    notifications: true,
    hapticFeedback: true,
    autoSpellCorrect: true,
    autoSendDictation: false,
    backgroundConversations: true,
    autocomplete: false,
    trendingSearches: true,
    followUpSuggestions: false,
    colorScheme: "dark",
    language: "English",
    voiceType: "Ember",
  });

  const { user } = UseAuth() as { user?: any };
  const isAdmin = user?.username === "Admin";

  function BackButton() {
    return (
      <Button
        variant="ghost"
        onClick={() => setActiveSection("main")}
        className="mb-4 text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        Back to Settings
      </Button>
    );
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          setActiveSection("main");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start zed-button"
        >
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </DialogTrigger>

      <DialogContent className="zed-glass max-h-[90vh] max-w-4xl overflow-y-auto border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <img src={zLogoPath} alt="Z" className="h-4 w-4" />
            <span>
              <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
                ZED
              </span>{" "}
              Settings
            </span>
          </DialogTitle>

          <DialogDescription className="text-muted-foreground">
            Manage your account, preferences, and controls.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto">
          {activeSection === "main" && (
            <div className="space-y-6">
              <SettingsMainMenu
                isAdmin={isAdmin}
                onNavigate={setActiveSection}
              />

              <SettingsAppControls
                appSettings={appSettings}
                setAppSettings={setAppSettings}
              />

              <SettingsVoiceControls
                appSettings={appSettings}
                setAppSettings={setAppSettings}
              />

              <SettingsSuggestions
                appSettings={appSettings}
                setAppSettings={setAppSettings}
              />
            </div>
          )}

          {activeSection === "admin" && isAdmin && (
            <div>
              <BackButton />
              <UserManagement />
            </div>
          )}

          {activeSection === "personalization" && (
            <div>
              <BackButton />
              <Card className="zed-glass border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Personalization
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Customize your ZED experience with personalized settings and
                    preferences.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {activeSection === "notifications" && (
            <div>
              <BackButton />
              <Card className="zed-glass border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-muted-foreground">
                    <p>Notification controls are being rebuilt into the new settings system.</p>
                    <p>Current default: notifications enabled.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeSection === "data" && (
            <div>
              <BackButton />
              <Card className="zed-glass border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Data Controls
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Manage your data privacy and control how your information is
                    used.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {activeSection === "archived" && (
            <div>
              <BackButton />
              <Card className="zed-glass border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Archive className="h-5 w-5" />
                    Archived Chats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    View and manage your archived conversations.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {activeSection === "security" && (
            <div>
              <BackButton />

              {isAdmin ? (
                <AdminSecuritySettings />
              ) : (
                <Card className="zed-glass border-white/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="h-5 w-5" />
                      Security
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>• Session expires after inactivity</p>
                      <p>• Enhanced security with device verification</p>
                      <p>• Multi-factor authentication enabled</p>
                      <p>
                        • Username:{" "}
                        <span className="font-medium text-foreground">
                          {user?.username || "user"}
                        </span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}