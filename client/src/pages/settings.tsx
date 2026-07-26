import { useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Settings as SettingsIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useAuth } from "@/components/auth/UseAuth";

import AccountSecuritySettings from "@/components/settings/AccountSecuritySettings";
import ArchivedChatsSettings from "@/components/settings/ArchivedChatsSettings";
import MyMemorySettings from "@/components/settings/MyMemorySettings";
import PersonalizationSettings from "@/components/settings/PersonalizationSettings";
import RulesSettings from "@/components/settings/RulesSettings";
import SettingsMainMenu from "@/components/settings/SettingsMainMenu";

interface SettingsUser {
  email?: string;
  isAdmin?: boolean;
  claims?: { isAdmin?: boolean };
  personalization?: { compactMessages?: boolean };
}

const SECTION_TITLE: Record<string, string> = {
  preferences: "Preferences",
  workspace: "Projects & workspaces",
  memory: "About you",
  security: "Sign-in & session",
  archived: "Archived chats",
};

/**
 * The real Settings surface, reachable from Nexus's "Settings" domain.
 *
 * Reuses the same section components SettingsModal already wires to
 * production APIs (personalization, memory, archived chats, sign-in) -
 * as a full page instead of a dialog, since this is now the Settings
 * domain's dedicated workspace rather than a quick popup.
 */
export default function SettingsPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth() as { user?: SettingsUser };
  const [section, setSection] = useState("main");
  const { appSettings, setAppSettings } = useAppSettings();
  const compact = !!user?.personalization?.compactMessages;
  const isAdmin = !!user?.isAdmin || !!user?.claims?.isAdmin || user?.email === "admin@zed-ai.online";

  function handleNavigate(next: string) {
    if (next === "admin") {
      navigate("/admin");
      return;
    }
    setSection(next);
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 px-4 pb-3 pt-safe-sm zed-glass">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (section === "main" ? navigate("/nexus") : setSection("main"))}
          className="rounded-xl text-muted-foreground hover:text-foreground zed-button"
        >
          <ChevronLeft size={16} className="mr-1" />
          {section === "main" ? "Nexus" : "Settings"}
        </Button>
        <div className="flex items-center gap-2">
          <SettingsIcon size={16} className="text-cyan-300" />
          <span className="font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
            {section === "main" ? "Settings" : SECTION_TITLE[section] ?? "Settings"}
          </span>
        </div>
        <div className="h-9 w-9" aria-hidden="true" />
      </div>

      <div className={`mx-auto max-w-2xl px-4 ${compact ? "py-4" : "py-6"}`}>
        {section === "main" && <SettingsMainMenu isAdmin={isAdmin} onNavigate={handleNavigate} />}
        {section === "preferences" && (
          <PersonalizationSettings appSettings={appSettings} setAppSettings={setAppSettings} />
        )}
        {section === "workspace" && <RulesSettings />}
        {section === "memory" && <MyMemorySettings />}
        {section === "security" && <AccountSecuritySettings />}
        {section === "archived" && <ArchivedChatsSettings />}
      </div>
    </div>
  );
}
