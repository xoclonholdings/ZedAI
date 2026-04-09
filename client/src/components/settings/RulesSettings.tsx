import { useEffect, useState } from "react";
import { Save, SlidersHorizontal, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

const STORAGE_KEY = "zed_rules_params";

interface RulesData {
  systemPrompt: string;
  behaviorRules: string;
  responseStyle: string;
  agentInstructions: string;
}

const defaultRules: RulesData = {
  systemPrompt: "",
  behaviorRules: "",
  responseStyle: "",
  agentInstructions: "",
};

export default function RulesSettings() {
  const [rules, setRules] = useState<RulesData>(defaultRules);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setRules(JSON.parse(stored));
    } catch {}
  }, []);

  function handleSave() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleReset() {
    setRules(defaultRules);
    localStorage.removeItem(STORAGE_KEY);
  }

  function update(field: keyof RulesData, value: string) {
    setRules((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  return (
    <div className="space-y-4">
      <Card className="zed-glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-purple-400" />
            Rules &amp; Parameters
          </CardTitle>
          <CardDescription>
            Define how ZED behaves, responds, and operates as an agent.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="text-sm font-medium">System Prompt</Label>
            <Textarea
              placeholder="Enter a system-level instruction that always applies to ZED's responses…"
              value={rules.systemPrompt}
              onChange={(e) => update("systemPrompt", e.target.value)}
              rows={4}
              className="zed-glass border-white/10 resize-none text-sm"
            />
            <p className="text-xs text-muted-foreground">
              This is prepended to every conversation as a hidden system message.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Behavior Rules</Label>
            <Textarea
              placeholder="e.g. Always ask clarifying questions before executing tasks. Never make assumptions about intent…"
              value={rules.behaviorRules}
              onChange={(e) => update("behaviorRules", e.target.value)}
              rows={4}
              className="zed-glass border-white/10 resize-none text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Rules and constraints that guide ZED's decision-making in all modes.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Response Style</Label>
            <Input
              placeholder="e.g. Concise, direct, use bullet points. Avoid filler words…"
              value={rules.responseStyle}
              onChange={(e) => update("responseStyle", e.target.value)}
              className="zed-glass border-white/10 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Controls the tone and format of ZED's output.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Agent-Mode Instructions</Label>
            <Textarea
              placeholder="Instructions that apply only when ZED is running as an autonomous agent…"
              value={rules.agentInstructions}
              onChange={(e) => update("agentInstructions", e.target.value)}
              rows={3}
              className="zed-glass border-white/10 resize-none text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Overrides and additions that activate only in Agent mode.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleSave}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Save className="mr-2 h-4 w-4" />
              {saved ? "Saved!" : "Save Rules"}
            </Button>

            <Button
              variant="outline"
              onClick={handleReset}
              className="zed-glass border-white/10 text-muted-foreground hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
