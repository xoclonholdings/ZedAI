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

export interface PersonalizationSettings {
  displayName: string;
  preferredLanguage: string;
  colorScheme: string;
  compactMessages: boolean;
  showTimestamps: boolean;
  fontSize: string;
}

export const defaultAppSettings: AppSettings = {
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

export const defaultPersonalizationSettings: PersonalizationSettings = {
  displayName: "Admin",
  preferredLanguage: "English",
  colorScheme: "dark",
  compactMessages: false,
  showTimestamps: true,
  fontSize: "medium",
};
