import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  VoicePerspective,
  VoiceResponseLength,
  VoiceSettings,
  VoiceTone,
} from "../../../../../../shared/adminSettings";

import {
  LabeledSelect,
  LabeledSlider,
  LoadErrorBanner,
  PlainTextarea,
  SaveIndicator,
  Segmented,
  SettingGroup,
  SettingRow,
  Toggle,
} from "./atoms";

/**
 * The first fully-built plain-language Settings section.
 *
 * Loads the current voice settings from /api/admin/settings on
 * mount, then autosaves every change with a small debounce so the
 * user never sees a Save button. On save the server responds with
 * the normalized VoiceSettings — we adopt that as canonical so
 * clamps + defaults from mergeSettings flow back into the UI.
 *
 * Prohibited phrases are debounced longer because they change on
 * every keystroke; the other controls debounce shorter because
 * they only change on discrete interactions.
 */

const TONE_OPTIONS: Array<{ value: VoiceTone; label: string }> = [
  { value: "warm", label: "Warm" },
  { value: "balanced", label: "Balanced" },
  { value: "direct", label: "Direct" },
  { value: "playful", label: "Playful" },
];

const PERSPECTIVE_OPTIONS: Array<{ value: VoicePerspective; label: string }> = [
  { value: "partner", label: "Thinking partner" },
  { value: "advisor", label: "Advisor" },
  { value: "straight-shooter", label: "Straight-shooter" },
  { value: "devils-advocate", label: "Devil’s advocate" },
];

const LENGTH_OPTIONS: Array<{ value: VoiceResponseLength; label: string }> = [
  { value: "concise", label: "Concise" },
  { value: "balanced", label: "Balanced" },
  { value: "thorough", label: "Thorough" },
];

const DEFAULTS: VoiceSettings = {
  tone: "balanced",
  formality: 60,
  perspective: "partner",
  responseLength: "balanced",
  showReasoning: false,
  plainLanguage: true,
  codeBlocks: true,
  prohibitedPhrases: [],
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function HowZedSounds() {
  const [voice, setVoice] = useState<VoiceSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [loadError, setLoadError] = useState<boolean>(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings", { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const data = await res.json();
      if (data?.voice) {
        setVoice(data.voice as VoiceSettings);
        setLoadError(false);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoaded(true);
    }
  }, []);

  // Load current server-side settings once.
  useEffect(() => {
    void load();
  }, [load]);

  const savedTimer = useRef<number | null>(null);
  const inflight = useRef<Promise<void> | null>(null);

  const flush = useCallback(async (patch: Partial<VoiceSettings>) => {
    setStatus("saving");
    setErrorMessage(undefined);
    const run = (async () => {
      try {
        const res = await fetch("/api/admin/settings/voice", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `Save failed (${res.status})`);
        }
        const normalized = (await res.json()) as VoiceSettings;
        setVoice(normalized);
        setStatus("saved");
        if (savedTimer.current) window.clearTimeout(savedTimer.current);
        savedTimer.current = window.setTimeout(() => setStatus("idle"), 1500);
      } catch (err: any) {
        setErrorMessage(err?.message);
        setStatus("error");
      }
    })();
    inflight.current = run;
    await run;
  }, []);

  // Discrete controls (dropdowns, toggles, segmented) — save immediately.
  const patch = useCallback(
    (p: Partial<VoiceSettings>) => {
      setVoice((v) => ({ ...v, ...p }));
      void flush(p);
    },
    [flush],
  );

  // Slider — debounce so we don't PUT once per pixel while dragging.
  const sliderTimer = useRef<number | null>(null);
  const onFormalityChange = useCallback(
    (next: number) => {
      setVoice((v) => ({ ...v, formality: next }));
      if (sliderTimer.current) window.clearTimeout(sliderTimer.current);
      sliderTimer.current = window.setTimeout(() => {
        void flush({ formality: next });
      }, 350);
    },
    [flush],
  );

  // Textarea — debounce even longer.
  const phrasesTimer = useRef<number | null>(null);
  const [phrasesText, setPhrasesText] = useState<string>("");
  useEffect(() => {
    if (loaded) setPhrasesText(voice.prohibitedPhrases.join("\n"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const onPhrasesChange = useCallback(
    (next: string) => {
      setPhrasesText(next);
      if (phrasesTimer.current) window.clearTimeout(phrasesTimer.current);
      phrasesTimer.current = window.setTimeout(() => {
        const list = next
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        void flush({ prohibitedPhrases: list });
      }, 600);
    },
    [flush],
  );

  const header = useMemo(
    () => (
      <header className="mb-6 flex w-full min-w-0 max-w-full flex-wrap items-start justify-between gap-4 overflow-hidden">
        <div className="min-w-0 flex-1">
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
            How Zed sounds
          </h2>
          <p className="mt-1.5 max-w-full break-words text-[13.5px] leading-snug text-white/50 [overflow-wrap:anywhere] sm:max-w-[62ch]">
            Set the voice Zed uses when it talks to you. These shape tone, formality, and what Zed avoids saying on every response.
          </p>
        </div>
        <SaveIndicator status={status} errorMessage={errorMessage} />
      </header>
    ),
    [status, errorMessage],
  );

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden">
      {header}
      {loadError && loaded && <LoadErrorBanner onRetry={() => void load()} />}

      <SettingGroup title="Personality">
        <SettingRow
          label="Tone"
          description="The default emotional register Zed answers in."
        >
          <LabeledSelect<VoiceTone>
            value={voice.tone}
            onChange={(v) => patch({ tone: v })}
            options={TONE_OPTIONS}
          />
        </SettingRow>

        <SettingRow
          label="Formality"
          description="Casual chat vs. a professional colleague. Zed adapts, but this is the resting point."
        >
          <LabeledSlider
            value={voice.formality}
            onChange={onFormalityChange}
            leftLabel="Casual"
            rightLabel="Professional"
            ariaLabel="Formality"
          />
        </SettingRow>

        <SettingRow
          label="Perspective"
          description="How Zed positions itself when giving an opinion."
        >
          <LabeledSelect<VoicePerspective>
            value={voice.perspective}
            onChange={(v) => patch({ perspective: v })}
            options={PERSPECTIVE_OPTIONS}
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="How Zed writes">
        <SettingRow
          label="Default response length"
          description="Zed follows this unless a question clearly needs more or less."
        >
          <Segmented<VoiceResponseLength>
            options={LENGTH_OPTIONS}
            value={voice.responseLength}
            onChange={(v) => patch({ responseLength: v })}
            ariaLabel="Default response length"
          />
        </SettingRow>

        <SettingRow
          label="Show reasoning by default"
          description="Adds a short “why” after answers. Off means Zed just gives the result."
        >
          <Toggle
            checked={voice.showReasoning}
            onChange={(v) => patch({ showReasoning: v })}
            ariaLabel="Show reasoning by default"
          />
        </SettingRow>

        <SettingRow
          label="Prefer plain language"
          description="Avoid jargon and technical terms unless you ask for them."
        >
          <Toggle
            checked={voice.plainLanguage}
            onChange={(v) => patch({ plainLanguage: v })}
            ariaLabel="Prefer plain language"
          />
        </SettingRow>

        <SettingRow
          label="Format code in blocks"
          description="Wrap any code in syntax-highlighted blocks."
        >
          <Toggle
            checked={voice.codeBlocks}
            onChange={(v) => patch({ codeBlocks: v })}
            ariaLabel="Format code in blocks"
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Things to avoid">
        <SettingRow
          label="Prohibited phrases"
          description="Words or phrases Zed shouldn’t use when answering you — one per line."
          stack
        >
          <PlainTextarea
            value={phrasesText}
            onChange={onPhrasesChange}
            placeholder={"One phrase per line\ne.g. As an AI language model\ne.g. I'm just an AI"}
            ariaLabel="Prohibited phrases"
            rows={6}
          />
        </SettingRow>
      </SettingGroup>

    </div>
  );
}
