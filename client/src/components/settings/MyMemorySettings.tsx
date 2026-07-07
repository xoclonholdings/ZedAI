import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  LoadErrorBanner,
  PlainTextarea,
  SaveIndicator,
  SettingGroup,
  SettingRow,
} from "@/components/admin/sections/settings/atoms";

/**
 * Plain-language "About you" — the personal memory Zed carries
 * across every chat.
 *
 * Six free-text sections. Autosaves debounced. No manual Save
 * button, no debug preview, no engineer-facing toggles (the memory
 * is always used for retrieval — hiding that toggle from the user
 * makes the behavior consistent and the surface honest).
 */

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface MemoryProfile {
  identity: string;
  ventures: string;
  goals: string;
  responseStyle: string;
  workingContext: string;
  constraints: string;
}

const EMPTY_PROFILE: MemoryProfile = {
  identity: "",
  ventures: "",
  goals: "",
  responseStyle: "",
  workingContext: "",
  constraints: "",
};

const PROFILE_FIELDS: Array<{
  key: keyof MemoryProfile;
  label: string;
  description: string;
  placeholder: string;
}> = [
  {
    key: "identity",
    label: "Who you are",
    description: "How Zed should think about you. Name, role, framing you care about.",
    placeholder: "I'm Sam. I run ZebCom. Call me Sam.",
  },
  {
    key: "ventures",
    label: "What you're building",
    description: "Businesses, brands, products, or side projects Zed should remember.",
    placeholder: "ZebCom (parent). ZED AI (product). Zwap (side project).",
  },
  {
    key: "goals",
    label: "What you're focused on right now",
    description: "The outcomes you're actively chasing this week or month.",
    placeholder: "Ship ZED plain-language surface. Get 10 paper trades logged.",
  },
  {
    key: "responseStyle",
    label: "How you like Zed to help",
    description: "Preferred tone, depth, pace, and style.",
    placeholder: "Direct, plain-language, no jargon. Decision-oriented.",
  },
  {
    key: "workingContext",
    label: "Stuff you don't want to repeat",
    description: "Facts about your context, tools, or setup that come up often.",
    placeholder: "iPhone user. Prefer iCloud email. Mobile-first for everything.",
  },
  {
    key: "constraints",
    label: "Limits and boundaries",
    description: "Budget, sensitivities, or things Zed should avoid.",
    placeholder: "Solo founder budget. Never post to social without approval.",
  },
];

function serializeProfile(profile: MemoryProfile): string {
  return [
    `## Identity\n${profile.identity.trim() || "Not provided yet."}`,
    `## Ventures & Projects\n${profile.ventures.trim() || "Not provided yet."}`,
    `## Current Goals\n${profile.goals.trim() || "Not provided yet."}`,
    `## Preferred Response Style\n${profile.responseStyle.trim() || "Not provided yet."}`,
    `## Recurring Context\n${profile.workingContext.trim() || "Not provided yet."}`,
    `## Constraints & Boundaries\n${profile.constraints.trim() || "Not provided yet."}`,
  ].join("\n\n");
}

function extractSection(content: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`## ${escaped}\\n([\\s\\S]*?)(?=\\n## |$)`, "i");
  const match = content.match(regex);
  return match?.[1]?.trim() || "";
}

function parseProfile(content: string): MemoryProfile {
  if (!content.includes("## ")) {
    return { ...EMPTY_PROFILE, workingContext: content.trim() };
  }
  return {
    identity: extractSection(content, "Identity"),
    ventures: extractSection(content, "Ventures & Projects"),
    goals: extractSection(content, "Current Goals"),
    responseStyle: extractSection(content, "Preferred Response Style"),
    workingContext: extractSection(content, "Recurring Context"),
    constraints: extractSection(content, "Constraints & Boundaries"),
  };
}

export default function MyMemorySettings() {
  const [profile, setProfile] = useState<MemoryProfile>(EMPTY_PROFILE);
  const [memoryId, setMemoryId] = useState<string | undefined>();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [loadError, setLoadError] = useState<boolean>(false);
  const savedTimer = useRef<number | null>(null);
  const flushTimer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge/personal-base", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const payload = await res.json();
      if (payload?.item) {
        setMemoryId(payload.item.id);
        setProfile(parseProfile(payload.item.content || ""));
      }
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (next: MemoryProfile) => {
      setStatus("saving");
      setErrorMessage(undefined);
      try {
        const res = await fetch("/api/knowledge/personal-base", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            id: memoryId,
            name: "Personal base memory",
            description: "Facts Zed should remember about you across chats.",
            content: serializeProfile(next),
            isActive: true,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error || `Save failed (${res.status})`);
        }
        const payload = await res.json();
        if (payload?.item?.id) setMemoryId(payload.item.id);
        setStatus("saved");
        if (savedTimer.current) window.clearTimeout(savedTimer.current);
        savedTimer.current = window.setTimeout(() => setStatus("idle"), 1500);
      } catch (err: any) {
        setErrorMessage(err?.message);
        setStatus("error");
      }
    },
    [memoryId],
  );

  const update = useCallback(
    <K extends keyof MemoryProfile>(key: K, value: MemoryProfile[K]) => {
      setProfile((prev) => {
        const next = { ...prev, [key]: value };
        if (flushTimer.current) window.clearTimeout(flushTimer.current);
        flushTimer.current = window.setTimeout(() => void save(next), 600);
        return next;
      });
    },
    [save],
  );

  const header = useMemo(
    () => (
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
            About you
          </h2>
          <p className="mt-1.5 text-[13.5px] text-white/50 max-w-full sm:max-w-[62ch] leading-snug">
            Tell Zed who you are and what you're working on. This is private
            to you and shows up in every chat so Zed doesn't ask again.
            Changes save automatically.
          </p>
        </div>
        <SaveIndicator status={status} errorMessage={errorMessage} />
      </header>
    ),
    [status, errorMessage],
  );

  return (
    <div className="min-w-0">
      {header}
      {loadError && <LoadErrorBanner onRetry={() => void load()} />}

      <SettingGroup title="Your notes to Zed">
        {PROFILE_FIELDS.map((field) => (
          <SettingRow
            key={field.key}
            label={field.label}
            description={field.description}
            stack
          >
            <PlainTextarea
              value={profile[field.key]}
              onChange={(v) => update(field.key, v)}
              placeholder={field.placeholder}
              ariaLabel={field.label}
              rows={4}
            />
          </SettingRow>
        ))}
      </SettingGroup>
    </div>
  );
}
