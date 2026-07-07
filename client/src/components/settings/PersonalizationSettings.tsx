import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PersonalizationSettings as PersonalizationData } from "@shared/adminSettings";
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
 * Plain-language Preferences surface.
 *
 * Replaces the card-heavy form with the same SettingRow style used
 * across /admin. Autosaves on every change; no manual Save button.
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

export default function PersonalizationSettings() {
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

  const header = useMemo(
    () => (
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
            Preferences
          </h2>
          <p className="mt-1.5 text-[13.5px] text-white/50 max-w-full sm:max-w-[62ch] leading-snug">
            Your name, the language Zed answers in, and how the app looks and reads on your screen.
          </p>
        </div>
        <SaveIndicator status={status} errorMessage={errorMessage} />
      </header>
    ),
    [status, errorMessage],
  );

  return (
    <div>
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
        <SettingRow label="Color theme" description="Pick a background palette for the app.">
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
    </div>
  );
}
