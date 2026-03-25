import { MessageSquare, TrendingUp, Type } from "lucide-react";

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

interface SettingsSuggestionsProps {
  appSettings: AppSettings;
  setAppSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
}

export default function SettingsSuggestions({
  appSettings,
  setAppSettings,
}: SettingsSuggestionsProps) {
  return (
    <div className="border-t border-white/10 pt-6">
      <h3 className="mb-4 text-xs uppercase tracking-wider text-muted-foreground">
        SUGGESTIONS
      </h3>

      <div className="space-y-4">
        {/* Autocomplete */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Type className="h-5 w-5 text-green-400" />
            <span className="text-foreground">Autocomplete</span>
          </div>

          <Switch
            checked={appSettings.autocomplete}
            onCheckedChange={(checked) =>
              setAppSettings((prev) => ({
                ...prev,
                autocomplete: checked,
              }))
            }
          />
        </div>

        {/* Trending Searches */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <TrendingUp className="h-5 w-5 text-yellow-400" />
            <span className="text-foreground">Trending Searches</span>
          </div>

          <Switch
            checked={appSettings.trendingSearches}
            onCheckedChange={(checked) =>
              setAppSettings((prev) => ({
                ...prev,
                trendingSearches: checked,
              }))
            }
          />
        </div>

        {/* Follow-up Suggestions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <MessageSquare className="h-5 w-5 text-purple-400" />
            <span className="text-foreground">Follow-up Suggestions</span>
          </div>

          <Switch
            checked={appSettings.followUpSuggestions}
            onCheckedChange={(checked) =>
              setAppSettings((prev) => ({
                ...prev,
                followUpSuggestions: checked,
              }))
            }
          />
        </div>
      </div>
    </div>
  );
}