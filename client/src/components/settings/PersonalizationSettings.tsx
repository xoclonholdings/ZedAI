import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AppSettings,
  PersonalizationSettings as PersonalizationData,
} from "@shared/adminSettings";
import { defaultPersonalizationSettings } from "@shared/adminSettings";
import { useAuth } from "@/components/auth/UseAuth";

import {
  LabeledSelect,
  LoadErrorBanner,
  SaveIndicator,
  SettingGroup,
  SettingRow,
  Toggle,
} from "@/components/admin/sections/settings/atoms";

/**
 * The full plain-language Preferences page.
 *
 * Consolidates what used to be five stacked cards
 * (Personalization + Notifications + AppControls + VoiceControls +
 * Suggestions) into one clean surface grouped by user intent:
 *
 *   You (name, language)
 *   Look and feel (theme, font size, spacing, timestamps)
 *   Voice (voice type)
 *   Notifications (master + granular)
 *   Behavior (haptics, spell correct, dictation, background)
 *   Suggestions (autocomplete, trending, follow-ups)
 *
 * PersonalizationData persists via /api/settings/personalization.
 * AppSettings persists via the useAppSettings hook (the outer
 * SettingsModal passes it in as a prop pair).
 */

type SaveStatus = "idle" | "saving" | "saved" | "error";

const LANGUAGE_OPTIONS = [
  { value: "English", label: "English" },
  { value: "Spanish", label: "Spanish" },
  { value: "French", label: "French" },
  { value: "German", label: "German" },
  { value: "Japanese", label: "Japanese" },
  { value: "Mandarin", label: "Mandarin" },
];

const THEME_OPTIONS = [
  { value: "dark", label: "Dark" },
  { value: "midnight", label: "Midnight blue" },
  { value: "nebula", label: "Nebula purple" },
];

const FONT_OPTIONS = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
];

const VOICE_TYPE_OPTIONS = [
  { value: "warm", label: "Warm" },
  { value: "balanced", label: "Balanced" },
  { value: "direct", label: "Direct" },
  { value: "playful", label: "Playful" },
];

interface PreferencesProps {
  appSettings?: AppSettings;
  setAppSettings?: React.Dispatch<React.SetStateAction<AppSettings>>;
}

export default function PersonalizationSettings({
  appSettings,
  setAppSettings,
}: PreferencesProps = {}) {
  const { refresh } = useAuth();
  const [data, setData] = useState<PersonalizationData>(defaultPersonalizationSettings);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [loadError, setLoadError] = useState<boolean>(false);
  const savedTimer = useRef<number | null>(null);
  const nameDebounce = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/personalization", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const payload = await res.json();
      setData({ ...defaultPersonalizationSettings, ...(payload || {}) });
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (next: PersonalizationData) => {
      setStatus("saving");
      setErrorMessage(undefined);
      try {
        const res = await fetch("/api/settings/personalization", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(next),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `Save failed (${res.status})`);
        }
        const merged = await res.json();
        setData({ ...defaultPersonalizationSettings, ...merged });
        void refresh();
        setStatus("saved");
        if (savedTimer.current) window.clearTimeout(savedTimer.current);
        savedTimer.current = window.setTimeout(() => setStatus("idle"), 1500);
      } catch (err: any) {
        setErrorMessage(err?.message);
        setStatus("error");
      }
    },
    [refresh],
  );

  const update = useCallback(
    <K extends keyof PersonalizationData>(key: K, value: PersonalizationData[K]) => {
      setData((prev) => {
        const next = { ...prev, [key]: value };
        void save(next);
        return next;
      });
    },
    [save],
  );

  const updateNameDebounced = useCallback(
    (value: string) => {
      setData((prev) => ({ ...prev, displayName: value }));
      if (nameDebounce.current) window.clearTimeout(nameDebounce.current);
      nameDebounce.current = window.setTimeout(() => {
        setData((prev) => {
          void save(prev);
          return prev;
        });
      }, 500);
    },
    [save],
  );

  /** Update AppSettings (whatever the useAppSettings hook persists). */
  const updateApp = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      if (!setAppSettings) return;
      setAppSettings((prev) => ({ ...prev, [key]: value }));
    },
    [setAppSettings],
  );

  const header = useMemo(
    () => (
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
            Preferences
          </h2>
          <p className="mt-1.5 text-[13.5px] text-white/50 max-w-full sm:max-w-[62ch] leading-snug">
            Your name, the language Zed answers in, and how the app looks,
            sounds, and reads on your screen.
          </p>
        </div>
        <SaveIndicator status={status} errorMessage={errorMessage} />
      </header>
    ),
    [status, errorMessage],
  );

  const app = appSettings; // convenience alias

  return (
    <div className="min-w-0">
      {header}
      {loadError && <LoadErrorBanner onRetry={() => void load()} />}

      <SettingGroup title="You">
        <SettingRow label="Your name" description="How Zed addresses you.">
          <input
            type="text"
            value={data.displayName || ""}
            onChange={(e) => updateNameDebounced(e.target.value)}
            placeholder="Your name"
            className="w-full max-w-[200px] text-[13.5px] text-white bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 placeholder:text-white/30"
          />
        </SettingRow>
        <SettingRow label="Language" description="What language Zed replies in.">
          <LabeledSelect
            value={data.preferredLanguage}
            onChange={(v) => update("preferredLanguage", v)}
            options={LANGUAGE_OPTIONS}
            minWidth={160}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Look and feel">
        <SettingRow label="Color theme" description="Pick a background palette.">
          <LabeledSelect
            value={data.colorScheme}
            onChange={(v) => update("colorScheme", v)}
            options={THEME_OPTIONS}
            minWidth={180}
          />
        </SettingRow>
        <SettingRow label="Font size" description="Adjust for comfort or vision.">
          <LabeledSelect
            value={data.fontSize}
            onChange={(v) => update("fontSize", v)}
            options={FONT_OPTIONS}
            minWidth={140}
          />
        </SettingRow>
        <SettingRow
          label="Tighter spacing"
          description="Squeezes more messages onto one screen."
        >
          <Toggle
            checked={data.compactMessages}
            onChange={(v) => update("compactMessages", v)}
            ariaLabel="Tighter spacing"
          />
        </SettingRow>
        <SettingRow
          label="Show timestamps"
          description="Print the time next to each message."
        >
          <Toggle
            checked={data.showTimestamps}
            onChange={(v) => update("showTimestamps", v)}
            ariaLabel="Show timestamps"
          />
        </SettingRow>
      </SettingGroup>

      {app && setAppSettings && (
        <>
          <SettingGroup title="Voice">
            <SettingRow
              label="Voice type"
              description="How Zed sounds when it speaks to you out loud."
            >
              <LabeledSelect
                value={app.voiceType || "balanced"}
                onChange={(v) => updateApp("voiceType", v)}
                options={VOICE_TYPE_OPTIONS}
                minWidth={140}
              />
            </SettingRow>
          </SettingGroup>

          <SettingGroup title="Notifications">
            <SettingRow
              label="Turn notifications on"
              description="Master switch. Turn off to silence everything below."
            >
              <Toggle
                checked={app.notifications}
                onChange={(v) => updateApp("notifications", v)}
                ariaLabel="Turn notifications on"
              />
            </SettingRow>
            <SettingRow
              label="Agent alerts"
              description="Tell me when an agent finishes work or needs my OK."
            >
              <Toggle
                checked={app.agentAlerts}
                onChange={(v) => updateApp("agentAlerts", v)}
                ariaLabel="Agent alerts"
              />
            </SettingRow>
            <SettingRow
              label="Chat messages"
              description="Ping me when Zed replies while I'm not looking."
            >
              <Toggle
                checked={app.messageNotifications}
                onChange={(v) => updateApp("messageNotifications", v)}
                ariaLabel="Chat messages"
              />
            </SettingRow>
            <SettingRow
              label="System alerts"
              description="Errors, warnings, and things Zed can't quietly fix."
            >
              <Toggle
                checked={app.systemAlerts}
                onChange={(v) => updateApp("systemAlerts", v)}
                ariaLabel="System alerts"
              />
            </SettingRow>
          </SettingGroup>

          <SettingGroup title="How Zed behaves">
            <SettingRow
              label="Haptic feedback"
              description="Small vibrations when you tap on iPhone."
            >
              <Toggle
                checked={app.hapticFeedback}
                onChange={(v) => updateApp("hapticFeedback", v)}
                ariaLabel="Haptic feedback"
              />
            </SettingRow>
            <SettingRow
              label="Auto spell correct"
              description="Fix typos as you type."
            >
              <Toggle
                checked={app.autoSpellCorrect}
                onChange={(v) => updateApp("autoSpellCorrect", v)}
                ariaLabel="Auto spell correct"
              />
            </SettingRow>
            <SettingRow
              label="Auto-send after dictation"
              description="Send the message as soon as you stop talking."
            >
              <Toggle
                checked={app.autoSendDictation}
                onChange={(v) => updateApp("autoSendDictation", v)}
                ariaLabel="Auto-send after dictation"
              />
            </SettingRow>
            <SettingRow
              label="Keep running in the background"
              description="Let Zed keep agents working while the app isn't open."
            >
              <Toggle
                checked={app.backgroundConversations}
                onChange={(v) => updateApp("backgroundConversations", v)}
                ariaLabel="Background conversations"
              />
            </SettingRow>
          </SettingGroup>

          <SettingGroup title="Suggestions">
            <SettingRow
              label="Autocomplete"
              description="Zed suggests how to finish your sentence as you type."
            >
              <Toggle
                checked={app.autocomplete}
                onChange={(v) => updateApp("autocomplete", v)}
                ariaLabel="Autocomplete"
              />
            </SettingRow>
            <SettingRow
              label="Trending prompts"
              description="Show suggested things to ask Zed on the home screen."
            >
              <Toggle
                checked={app.trendingSearches}
                onChange={(v) => updateApp("trendingSearches", v)}
                ariaLabel="Trending prompts"
              />
            </SettingRow>
            <SettingRow
              label="Follow-up suggestions"
              description="After Zed replies, offer likely next questions."
            >
              <Toggle
                checked={app.followUpSuggestions}
                onChange={(v) => updateApp("followUpSuggestions", v)}
                ariaLabel="Follow-up suggestions"
              />
            </SettingRow>
          </SettingGroup>
        </>
      )}
    </div>
  );
}
