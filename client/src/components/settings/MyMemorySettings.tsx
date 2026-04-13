import { useEffect, useState } from "react";
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

const EMPTY_MEMORY: PersonalBaseMemory = {
  name: "Personal Base Memory",
  description: "Who you are, what you care about, how you want ZED to help, and the context ZED should consistently remember about you.",
  content: "",
  isActive: true,
};

export default function MyMemorySettings() {
  const [memory, setMemory] = useState<PersonalBaseMemory>(EMPTY_MEMORY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
          setMemory({
            id: payload.item.id,
            name: payload.item.name || EMPTY_MEMORY.name,
            description: payload.item.description || EMPTY_MEMORY.description,
            content: payload.item.content || "",
            isActive: payload.item.isActive ?? true,
          });
        }
      } catch {
        // Keep default empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveMemory() {
    setSaving(true);
    try {
      const response = await fetch("/api/knowledge/personal-base", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(memory),
      });

      if (!response.ok) throw new Error("save failed");
      const payload = await response.json();
      setMemory({
        id: payload.item?.id,
        name: payload.item?.name || memory.name,
        description: payload.item?.description || memory.description,
        content: payload.item?.content || memory.content,
        isActive: payload.item?.isActive ?? memory.isActive,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="zed-glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-cyan-400" />
            My Memory
          </CardTitle>
          <CardDescription>
            Build your personal base memory so ZED understands your identity, goals, preferences, ventures, and working context without relying on admin-only knowledge.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-sm leading-6 text-foreground/85">
            This memory belongs to the current user. It is separate from the admin foundation and is meant to become the baseline context ZED uses when helping you personally.
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-cyan-400/20 text-cyan-300">
              Personal
            </Badge>
            <Badge variant="outline" className="border-white/10 text-muted-foreground">
              User-owned
            </Badge>
            <Badge variant="outline" className="border-white/10 text-muted-foreground">
              Retrieved in chat
            </Badge>
          </div>

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

          <label className="space-y-2">
            <div className="text-sm font-medium">Base Memory Content</div>
            <Textarea
              rows={14}
              value={memory.content}
              onChange={(e) => setMemory((prev) => ({ ...prev, content: e.target.value }))}
              className="zed-glass border-white/10 text-sm"
              placeholder="Describe who you are, your ventures, current priorities, style preferences, recurring needs, and anything ZED should consistently keep in mind."
            />
          </label>

          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3">
            <div>
              <div className="text-sm font-medium">Use in Retrieval</div>
              <div className="text-xs text-muted-foreground">Keep this enabled if you want ZED to prioritize your base memory during chat and agent work.</div>
            </div>
            <Switch checked={memory.isActive} onCheckedChange={(checked) => setMemory((prev) => ({ ...prev, isActive: checked }))} />
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-6 text-muted-foreground">
            Helpful examples:
            <br />
            - what ZED should call you
            <br />
            - your current businesses, projects, or products
            <br />
            - preferred response style and decision-making approach
            <br />
            - important background ZED should not make you repeat
          </div>

          <Button onClick={saveMemory} disabled={saving || loading} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700">
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : saved ? "Saved!" : "Save My Memory"}
          </Button>

          {!loading && !memory.content.trim() ? (
            <div className="flex items-center gap-2 text-xs text-amber-300">
              <Sparkles className="h-4 w-4" />
              Your personal base memory is still blank. ZED will work better once you seed it.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
