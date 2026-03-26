import { MessageSquare, Volume2 } from "lucide-react";

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

interface SettingsVoiceControlsProps {
  appSettings: AppSettings;
  setAppSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
}

export default function SettingsVoiceControls({
  appSettings,
  setAppSettings,
}: SettingsVoiceControlsProps) {
  return (
    <div className="border-t border-white/10 pt-6">
      <h3 className="mb-4 text-xs uppercase tracking-wider text-muted-foreground">
        VOICE MODE
      </h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Volume2 className="h-5 w-5 text-pink-400" />
            <span className="text-foreground">Voice</span>
          </div>

          <Select
            value={appSettings.voiceType}
            onValueChange={(value) =>
              setAppSettings((prev) => ({ ...prev, voiceType: value }))
            }
          >
            <SelectTrigger className="h-8 w-24 border-white/10 zed-glass">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/10 zed-glass">
              <SelectItem value="Ember">Ember</SelectItem>
              <SelectItem value="Nova">Nova</SelectItem>
              <SelectItem value="Breeze">Breeze</SelectItem>
              <SelectItem value="Juniper">Juniper</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <MessageSquare className="h-5 w-5 text-blue-400" />
              <span className="text-foreground">Background Conversations</span>
            </div>

            <Switch
              checked={appSettings.backgroundConversations}
              onCheckedChange={(checked) =>
                setAppSettings((prev) => ({
                  ...prev,
                  backgroundConversations: checked,
                }))
              }
            />
          </div>

          <p className="ml-8 text-xs text-muted-foreground">
            Background conversations keep the conversation going in other apps
            or while your screen is off.
          </p>
        </div>
      </div>
    </div>
  );
}
