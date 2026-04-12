import { useEffect, useState } from "react";
import { Save, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import type { PersonalizationSettings as PersonalizationData } from "@shared/adminSettings";
import { defaultPersonalizationSettings } from "@shared/adminSettings";

export default function PersonalizationSettings() {
  const [data, setData] = useState<PersonalizationData>(defaultPersonalizationSettings);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/admin/settings", {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = await response.json();
        if (!cancelled) {
          setData({
            ...defaultPersonalizationSettings,
            ...(payload.personalization || {}),
          });
        }
      } catch {
        // keep defaults
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof PersonalizationData>(key: K, value: PersonalizationData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/settings/personalization", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const next = await response.json();
        setData({
          ...defaultPersonalizationSettings,
          ...next,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="zed-glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-purple-400" />
            Personalization
          </CardTitle>
          <CardDescription>
            Customize how ZED looks and identifies you across the current workspace.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Display Name</Label>
            <Input
              value={data.displayName}
              onChange={(e) => update("displayName", e.target.value)}
              placeholder="Your name"
              className="zed-glass border-white/10 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Language</Label>
            <Select value={data.preferredLanguage} onValueChange={(val) => update("preferredLanguage", val)}>
              <SelectTrigger className="zed-glass border-white/10 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="zed-glass border-white/10">
                <SelectItem value="English">English</SelectItem>
                <SelectItem value="Spanish">Spanish</SelectItem>
                <SelectItem value="French">French</SelectItem>
                <SelectItem value="German">German</SelectItem>
                <SelectItem value="Japanese">Japanese</SelectItem>
                <SelectItem value="Mandarin">Mandarin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Color Theme</Label>
            <Select value={data.colorScheme} onValueChange={(val) => update("colorScheme", val)}>
              <SelectTrigger className="zed-glass border-white/10 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="zed-glass border-white/10">
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="midnight">Midnight Blue</SelectItem>
                <SelectItem value="nebula">Nebula Purple</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Font Size</Label>
            <Select value={data.fontSize} onValueChange={(val) => update("fontSize", val)}>
              <SelectTrigger className="zed-glass border-white/10 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="zed-glass border-white/10">
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Compact Messages</p>
                <p className="text-xs text-muted-foreground">Tighter spacing between messages</p>
              </div>
              <Switch checked={data.compactMessages} onCheckedChange={(v) => update("compactMessages", v)} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Show Timestamps</p>
                <p className="text-xs text-muted-foreground">Display time on each message</p>
              </div>
              <Switch checked={data.showTimestamps} onCheckedChange={(v) => update("showTimestamps", v)} />
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : saved ? "Saved!" : "Save Preferences"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
