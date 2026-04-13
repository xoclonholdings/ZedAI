import { useEffect, useMemo, useState } from "react";
import { Brain, Save, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type PersonalBaseMemory = {
  id?: string;
  name: string;
  description: string;
  content: string;
  isActive: boolean;
};

type MemoryProfile = {
  identity: string;
  ventures: string;
  goals: string;
  responseStyle: string;
  workingContext: string;
  constraints: string;
};

const EMPTY_MEMORY: PersonalBaseMemory = {
  name: "Personal Base Memory",
  description:
    "Who you are, what you care about, how you want ZED to help, and the context ZED should consistently remember about you.",
  content: "",
  isActive: true,
};

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
  hint: string;
  placeholder: string;
}> = [
  {
    key: "identity",
    label: "Identity",
    hint: "Who you are, what ZED should call you, and any important personal framing.",
    placeholder: "I’m ..., I prefer to be called ..., I’m building ...",
  },
  {
    key: "ventures",
    label: "Ventures & Projects",
    hint: "Businesses, brands, products, or initiatives ZED should remember.",
    placeholder: "ZWAP is ..., I’m also working on ...",
  },
  {
    key: "goals",
    label: "Current Goals",
    hint: "What outcomes you’re actively trying to achieve right now.",
    placeholder: "Right now I’m focused on launch, growth, research, funding ...",
  },
  {
    key: "responseStyle",
    label: "How ZED Should Help",
    hint: "Preferred tone, depth, pace, and style of support.",
    placeholder: "Be direct, strategic, concise, proactive, and decision-oriented ...",
  },
  {
    key: "workingContext",
    label: "Recurring Context",
    hint: "Facts you don’t want to repeat over and over.",
    placeholder: "I usually work on ..., I care about ..., my stack is ...",
  },
  {
    key: "constraints",
    label: "Constraints & Boundaries",
    hint: "Limits, sensitivities, or boundaries ZED should account for.",
    placeholder: "Budget is tight, prefer open source, avoid generic advice ...",
  },
];

function serializeProfile(profile: MemoryProfile) {
  return [
    `## Identity\n${profile.identity.trim() || "Not provided yet."}`,
    `## Ventures & Projects\n${profile.ventures.trim() || "Not provided yet."}`,
    `## Current Goals\n${profile.goals.trim() || "Not provided yet."}`,
    `## Preferred Response Style\n${profile.responseStyle.trim() || "Not provided yet."}`,
    `## Recurring Context\n${profile.workingContext.trim() || "Not provided yet."}`,
    `## Constraints & Boundaries\n${profile.constraints.trim() || "Not provided yet."}`,
  ].join("\n\n");
}

function extractSection(content: string, heading: string) {
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
  const [memory, setMemory] = useState<PersonalBaseMemory>(EMPTY_MEMORY);
  const [profile, setProfile] = useState<MemoryProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const previewContent = useMemo(() => serializeProfile(profile), [profile]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/knowledge/personal-base", {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = await response.json();
        if (!cancelled && payload.item) {
          const nextMemory = {
            id: payload.item.id,
            name: payload.item.name || EMPTY_MEMORY.name,
            description: payload.item.description || EMPTY_MEMORY.description,
            content: payload.item.content || "",
            isActive: payload.item.isActive ?? true,
          };
          setMemory(nextMemory);
          setProfile(parseProfile(nextMemory.content));
        }
      } catch {
        // Keep empty defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateProfile<K extends keyof MemoryProfile>(key: K, value: MemoryProfile[K]) {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function saveMemory() {
    setSaving(true);
    try {
      const nextPayload = { ...memory, content: previewContent };
      const response = await fetch("/api/knowledge/personal-base", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(nextPayload),
      });

      if (!response.ok) throw new Error("save failed");
      const payload = await response.json();
      setMemory({
        id: payload.item?.id,
        name: payload.item?.name || nextPayload.name,
        description: payload.item?.description || nextPayload.description,
        content: payload.item?.content || nextPayload.content,
        isActive: payload.item?.isActive ?? nextPayload.isActive,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const isBlank = !Object.values(profile).some((value) => value.trim());

  return (
    <div className="space-y-4">
      <Card className="zed-glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-cyan-400" />
            My Memory
          </CardTitle>
          <CardDescription>
            Build your personal base memory so ZED understands your identity, ventures, goals, and working style without relying on admin-only knowledge.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-sm leading-6 text-foreground/85">
            This memory belongs to the current user. It becomes the personal context ZED should carry across chat, planning, and agent work.
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-cyan-400/20 text-cyan-300">
              Personal
            </Badge>
            <Badge variant="outline" className="border-white/10 text-muted-foreground">
              Structured
            </Badge>
            <Badge variant="outline" className="border-white/10 text-muted-foreground">
              Retrieved in chat
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <div className="text-sm font-medium">Memory Name</div>
              <Input
                value={memory.name}
                onChange={(e) => setMemory((prev) => ({ ...prev, name: e.target.value }))}
                className="zed-glass border-white/10 text-sm"
              />
            </label>

            <label className="space-y-2">
              <div className="text-sm font-medium">Description</div>
              <Input
                value={memory.description}
                onChange={(e) => setMemory((prev) => ({ ...prev, description: e.target.value }))}
                className="zed-glass border-white/10 text-sm"
              />
            </label>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {PROFILE_FIELDS.map((field) => (
              <label key={field.key} className="space-y-2">
                <div>
                  <div className="text-sm font-medium">{field.label}</div>
                  <div className="text-xs text-muted-foreground">{field.hint}</div>
                </div>
                <Textarea
                  rows={field.key === "workingContext" ? 6 : 5}
                  value={profile[field.key]}
                  onChange={(e) => updateProfile(field.key, e.target.value)}
                  className="zed-glass border-white/10 text-sm"
                  placeholder={field.placeholder}
                />
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3">
            <div>
              <div className="text-sm font-medium">Use in Retrieval</div>
              <div className="text-xs text-muted-foreground">Keep this enabled if you want ZED to prioritize your personal base memory during chat and agent work.</div>
            </div>
            <Switch checked={memory.isActive} onCheckedChange={(checked) => setMemory((prev) => ({ ...prev, isActive: checked }))} />
          </div>

          <Card className="border-white/10 bg-black/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Saved Memory Preview</CardTitle>
              <CardDescription>This is the structured memory ZED will retrieve behind the scenes.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-4 text-xs leading-6 text-foreground/80">
                {previewContent}
              </pre>
            </CardContent>
          </Card>

          <Button onClick={saveMemory} disabled={saving || loading} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700">
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : saved ? "Saved!" : "Save My Memory"}
          </Button>

          {!loading && isBlank ? (
            <div className="flex items-center gap-2 text-xs text-amber-300">
              <Sparkles className="h-4 w-4" />
              Your structured personal memory is still blank. ZED will feel much smarter once this is filled in.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
