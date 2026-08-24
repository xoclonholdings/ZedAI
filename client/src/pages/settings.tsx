import { useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useAuth } from "@/components/auth/UseAuth";

import AccountSecuritySettings from "@/components/settings/AccountSecuritySettings";
import ArchivedChatsSettings from "@/components/settings/ArchivedChatsSettings";
import PersonalizationSettings from "@/components/settings/PersonalizationSettings";
import RulesSettings from "@/components/settings/RulesSettings";
import SettingsMainMenu from "@/components/settings/SettingsMainMenu";

interface SettingsUser {
  email?: string;
  isAdmin?: boolean;
  claims?: { isAdmin?: boolean };
  personalization?: { compactMessages?: boolean };
}

/**
 * The real Settings surface, reachable from Nexys's "Settings" domain.
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
  const isAdmin = !!user?.isAdmin || !!user?.claims?.isAdmin || user?.email === "admin@zar-ai.online";

  function handleNavigate(next: string) {
    if (next === "integrations") {
      navigate("/settings/integrations");
      return;
    }
    if (next === "admin") {
      navigate("/admin");
      return;
    }
    setSection(next);
  }

  return (
    <div className={`mx-auto max-w-2xl px-4 ${compact ? "py-4" : "py-6"}`}>
      {section !== "main" && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSection("main")}
          className="mb-4 rounded-xl text-muted-foreground hover:text-foreground zar-button"
        >
          <ChevronLeft size={16} className="mr-1" />
          Settings
        </Button>
      )}
      {section === "main" && <SettingsMainMenu isAdmin={isAdmin} onNavigate={handleNavigate} />}
      {section === "preferences" && (
        <PersonalizationSettings appSettings={appSettings} setAppSettings={setAppSettings} />
      )}
      {section === "workspace" && <RulesSettings />}
      {section === "security" && <AccountSecuritySettings />}
      {section === "archived" && <ArchivedChatsSettings />}
    </div>
  );
}
