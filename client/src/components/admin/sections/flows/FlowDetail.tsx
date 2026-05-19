import { useState } from "react";
import { Archive, ChevronLeft, CircleDot, Copy, PencilLine, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type {
  FlowDefinition,
  FlowStage,
} from "../../../../../../shared/flow-types";
import { Field, STATUS_STYLE } from "./shared";
import { StageRow } from "./StageRow";

export function FlowDetail({
  flow,
  onBack,
  onSaved,
  onAction,
}: {
  flow: FlowDefinition;
  onBack: () => void;
  onSaved: (f: FlowDefinition) => void;
  onAction: (op: "publish" | "archive" | "duplicate") => Promise<void>;
}) {
  const [draft, setDraft] = useState<FlowDefinition>(flow);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty = JSON.stringify(draft) !== JSON.stringify(flow);

  async function save() {
    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/admin/flows/${flow.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = (await res.json()) as FlowDefinition;
      onSaved(updated);
      setDraft(updated);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
    }
  }

  function patchStage(stageId: string, patch: Partial<FlowStage>) {
    setDraft((d) => ({
      ...d,
      stages: d.stages.map((s) => (s.id === stageId ? { ...s, ...patch } : s)),
    }));
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="zed-button text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft size={14} className="mr-1" />
          Flows
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          {flow.status === "draft" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction("publish")}
              className="zed-glass border-emerald-500/30 text-emerald-200 h-8"
            >
              <Send size={13} className="mr-1" />
              Publish
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => onAction("duplicate")}
            className="zed-glass border-white/10 h-8"
          >
            <Copy size={13} className="mr-1" />
            Duplicate
          </Button>
          {flow.status !== "archived" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction("archive")}
              className="zed-glass border-white/10 h-8 text-muted-foreground"
            >
              <Archive size={13} className="mr-1" />
              Archive
            </Button>
          )}
          <Button
            size="sm"
            onClick={save}
            disabled={!dirty || saveStatus === "saving"}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 h-8 disabled:opacity-40"
          >
            <PencilLine size={13} className="mr-1" />
            {saveStatus === "saving"
              ? "Saving…"
              : saveStatus === "saved"
                ? "Saved"
                : saveStatus === "error"
                  ? "Failed"
                  : "Save"}
          </Button>
        </div>
      </div>

      <Card className="zed-glass border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CircleDot size={14} className="text-cyan-300" />
            <span className="truncate">{draft.name}</span>
            <Badge
              variant="secondary"
              className={`border text-[9px] uppercase tracking-[0.16em] ml-auto ${STATUS_STYLE[draft.status]}`}
            >
              {draft.status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <Field label="Name">
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="zed-glass border-white/10"
            />
          </Field>
          <Field label="User-facing label">
            <Input
              value={draft.userFacingLabel}
              onChange={(e) => setDraft({ ...draft, userFacingLabel: e.target.value })}
              className="zed-glass border-white/10"
              placeholder="e.g. Build Revenue"
            />
          </Field>
          <Field label="User-facing blurb">
            <Input
              value={draft.userFacingBlurb}
              onChange={(e) => setDraft({ ...draft, userFacingBlurb: e.target.value })}
              className="zed-glass border-white/10"
              placeholder="One sentence the user sees on the picker"
            />
          </Field>
          <Field label="Purpose (internal)">
            <Textarea
              rows={2}
              value={draft.purpose}
              onChange={(e) => setDraft({ ...draft, purpose: e.target.value })}
              className="zed-glass border-white/10 text-sm"
            />
          </Field>
          <Field label="Description">
            <Textarea
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              className="zed-glass border-white/10 text-sm"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Category">
              <Input
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value as any })}
                className="zed-glass border-white/10"
              />
            </Field>
            <Field label="Icon (lucide)">
              <Input
                value={draft.icon || ""}
                onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
                className="zed-glass border-white/10"
                placeholder="TrendingUp"
              />
            </Field>
          </div>
          <Field label="Agents (comma-separated)">
            <Input
              value={draft.agents.join(", ")}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  agents: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean) as any,
                })
              }
              className="zed-glass border-white/10 font-mono"
            />
          </Field>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Stages</p>
          <span className="text-[11px] text-muted-foreground">{draft.stages.length} total</span>
        </div>

        {draft.stages.length === 0 ? (
          <Card className="zed-glass border-white/10">
            <CardContent className="py-6 text-center text-xs text-muted-foreground">
              No stages yet. Stages are best edited as JSON for now — paste from a seed template,
              then publish.
            </CardContent>
          </Card>
        ) : (
          draft.stages.map((stage) => (
            <StageRow
              key={stage.id}
              stage={stage}
              onChange={(patch) => patchStage(stage.id, patch)}
            />
          ))
        )}
      </div>
    </>
  );
}
