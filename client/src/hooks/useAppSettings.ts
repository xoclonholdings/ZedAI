import { useState, useEffect } from "react";

export interface AppSettings {
  notifications: boolean;
  agentAlerts: boolean;
  messageNotifications: boolean;
  systemAlerts: boolean;
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

const STORAGE_KEY = "zed_app_settings";

const DEFAULTS: AppSettings = {
  notifications: true,
  agentAlerts: true,
  messageNotifications: true,
  systemAlerts: true,
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
};

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(settings: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

export function useAppSettings() {
  const [appSettings, setAppSettingsState] = useState<AppSettings>(load);

  const setAppSettings: React.Dispatch<React.SetStateAction<AppSettings>> = (update) => {
    setAppSettingsState((prev) => {
      const next = typeof update === "function" ? (update as any)(prev) : update;
      save(next);
      return next;
    });
  };

  return { appSettings, setAppSettings };
}

export function clearAppSettings() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
