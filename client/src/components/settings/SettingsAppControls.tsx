import { Globe, Mic, Palette, Smartphone, Type } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

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

interface SettingsAppControlsProps {
  appSettings: AppSettings;
  setAppSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
}

export default function SettingsAppControls({
  appSettings,
  setAppSettings,
}: SettingsAppControlsProps) {
  return (
    <div className="border-t border-white/10 pt-6">
      <h3 className="mb-4 text-xs uppercase tracking-wider text-muted-foreground">
        APP
      </h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Globe className="h-5 w-5 text-blue-400" />
            <span className="text-foreground">App Language</span>
          </div>

          <Select
            value={appSettings.language}
            onValueChange={(value) =>
              setAppSettings((prev) => ({ ...prev, language: value }))
            }
          >
            <SelectTrigger className="h-8 w-24 border-white/10 zed-glass">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/10 zed-glass">
              <SelectItem value="English">English</SelectItem>
              <SelectItem value="Spanish">Spanish</SelectItem>
              <SelectItem value="French">French</SelectItem>
              <SelectItem value="German">German</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Mic className="h-5 w-5 text-green-400" />
            <span className="text-foreground">Auto Send with Dictation</span>
          </div>

          <Switch
            checked={appSettings.autoSendDictation}
            onCheckedChange={(checked) =>
              setAppSettings((prev) => ({
                ...prev,
                autoSendDictation: checked,
              }))
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Palette className="h-5 w-5 text-purple-400" />
            <span className="text-foreground">Color Scheme</span>
          </div>

          <Select
            value={appSettings.colorScheme}
            onValueChange={(value: "dark" | "light" | "auto") =>
              setAppSettings((prev) => ({ ...prev, colorScheme: value }))
            }
          >
            <SelectTrigger className="h-8 w-20 border-white/10 zed-glass">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/10 zed-glass">
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="auto">Auto</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Smartphone className="h-5 w-5 text-cyan-400" />
            <span className="text-foreground">Haptic Feedback</span>
          </div>

          <Switch
            checked={appSettings.hapticFeedback}
            onCheckedChange={(checked) =>
              setAppSettings((prev) => ({
                ...prev,
                hapticFeedback: checked,
              }))
            }
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Type className="h-5 w-5 text-orange-400" />
            <span className="text-foreground">Correct Spelling Automatically</span>
          </div>

          <Switch
            checked={appSettings.autoSpellCorrect}
            onCheckedChange={(checked) =>
              setAppSettings((prev) => ({
                ...prev,
                autoSpellCorrect: checked,
              }))
            }
          />
        </div>
      </div>
    </div>
  );
}