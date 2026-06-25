import { useState } from "react";
import { useLocation } from "wouter";
import { Archive, ChevronLeft, FolderKanban, Settings } from "lucide-react";

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

import { useAppSettings } from "@/hooks/useAppSettings";
import { useAuth } from "@/components/auth/UseAuth";
import AdminSecuritySettings from "./AdminSecuritySettings";
import DataControlsSettings from "./DataControlsSettings";
import MyMemorySettings from "./MyMemorySettings";
import NotificationsSettings from "./NotificationsSettings";
import PersonalizationSettings from "./PersonalizationSettings";
import RulesSettings from "./RulesSettings";
import SettingsAppControls from "./SettingsAppControls";
import SettingsMainMenu from "./SettingsMainMenu";
import SettingsSuggestions from "./SettingsSuggestions";
import SettingsVoiceControls from "./SettingsVoiceControls";

const zLogoPath = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNhODU1Zjc7c3RvcC1vcGFjaXR5OjEiLz48c3RvcCBvZmZzZXQ9IjUwJSIgc3R5bGU9InN0b3AtY29sb3I6IzMwOGNmZjtzdG9wLW9wYWNpdHk6MSIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3R5bGU9InN0b3AtY29sb3I6I2ViNDg5OTtzdG9wLW9wYWNpdHk6MSIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcng9IjgiIGZpbGw9InVybCgjZykiLz48cGF0aCBkPSJNOCAxMmgyMGwtMTIgOGgyMHYzSDE0bDEyLThIOHYtM3oiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuOSIvPjwvc3ZnPg==";

interface SettingsUser {
  email?: string;
  isAdmin?: boolean;
  claims?: {
    isAdmin?: boolean;
  };
  personalization?: {
    compactMessages?: boolean;
    fontSize?: string;
  };
}

export default function SettingsModal() {
  const [, navigate] = useLocation();
  const { user } = useAuth() as { user?: SettingsUser };
  const [isOpen, setIsOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("main");
  const { appSettings, setAppSettings } = useAppSettings();
  const compact = !!user?.personalization?.compactMessages;
  const fontSize = (user?.personalization?.fontSize as "small" | "medium" | "large" | undefined) || "medium";
  const titleClass = fontSize === "small" ? "text-base" : fontSize === "large" ? "text-xl" : "text-lg";
  const descriptionClass = fontSize === "small" ? "text-xs" : fontSize === "large" ? "text-sm" : "text-sm";
  const isAdmin = !!user?.isAdmin || !!user?.claims?.isAdmin || user?.email === "admin@zed-ai.online";

  function handleMainMenuNavigate(section: string) {
    if (section === "admin") {
      setIsOpen(false);
      setActiveSection("main");
      navigate("/admin");
      return;
    }
    setActiveSection(section);
  }

  function BackButton() {
    return (
      <Button
        variant="ghost"
        onClick={() => setActiveSection("main")}
        className={`${compact ? "mb-3" : "mb-4"} text-muted-foreground hover:text-foreground`}
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
        <Button variant="ghost" size="sm" className={`w-full justify-start zed-button ${compact ? "py-2 text-xs" : ""}`}>
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </DialogTrigger>

      <DialogContent className={`zed-glass max-h-[90vh] max-w-2xl overflow-hidden border-white/10 flex flex-col ${compact ? "p-4" : ""}`}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className={`flex items-center gap-2 text-foreground ${titleClass}`}>
            <img src={zLogoPath} alt="Z" className="h-4 w-4" />
            <span>
              <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
                ZED
              </span>{" "}
              Settings
            </span>
          </DialogTitle>

          <DialogDescription className={`${descriptionClass} text-muted-foreground`}>
            Manage your preferences, rules, and security.
          </DialogDescription>
        </DialogHeader>

        <div className={`flex-1 overflow-y-auto pr-1 ${compact ? "space-y-3" : "space-y-4"}`}>
          {activeSection === "main" && (
            <div className={compact ? "space-y-4" : "space-y-6"}>
              <SettingsMainMenu isAdmin={isAdmin} onNavigate={handleMainMenuNavigate} />
            </div>
          )}

          {activeSection === "preferences" && (
            <div>
              <BackButton />
              <div className={compact ? "space-y-4" : "space-y-6"}>
                <PersonalizationSettings />
                <NotificationsSettings
                  appSettings={appSettings}
                  setAppSettings={setAppSettings}
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
            </div>
          )}

          {activeSection === "workspace" && (
            <div>
              <BackButton />
              <div className={compact ? "space-y-4" : "space-y-6"}>
                <RulesSettings />
                <DataControlsSettings />
                <Card className="zed-glass border-white/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FolderKanban className="h-5 w-5" />
                      Projects & Filing
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Projects now live in the chat sidebar so conversations can be filed and filtered there.
                    </p>
                  </CardContent>
                </Card>
                <Card className="zed-glass border-white/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Archive className="h-5 w-5" />
                      Archived Chats
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      No archived conversations yet. Conversations you archive will appear here.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeSection === "memory" && (
            <div>
              <BackButton />
              <MyMemorySettings />
            </div>
          )}

          {activeSection === "security" && (
            <div>
              <BackButton />
              <AdminSecuritySettings />
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
                  <p className="text-sm text-muted-foreground">
                    No archived conversations yet. Conversations you archive will appear here.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
