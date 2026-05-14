import { useEffect, useState } from "react";
import {
  Archive,
  ChevronLeft,
  CircleDot,
  Copy,
  PencilLine,
  Play,
  Plus,
  RefreshCw,
  Send,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type {
  FlowDefinition,
  FlowStage,
  FlowStatus,
} from "../../../../../shared/flow-types";

type View = "list" | "detail";

const STATUS_STYLE: Record<FlowStatus, string> = {
  draft: "bg-yellow-500/15 text-yellow-200 border-yellow-500/30",
  published: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  archived: "bg-white/5 text-muted-foreground border-white/10",
};

export default function FlowsSection() {
  const [view, setView] = useState<View>("list");
  const [flows, setFlows] = useState<FlowDefinition[]>([]);
  const [active, setActive] = useState<FlowDefinition | null>(null);
  const [loading, setLoading] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/flows?includeArchived=${includeArchived}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFlows(data.flows || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load flows");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeArchived]);

  async function action(
    id: string,
    op: "publish" | "archive" | "duplicate",
  ): Promise<FlowDefinition | null> {
    const res = await fetch(`/api/admin/flows/${id}/${op}`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return null;
    return (await res.json()) as FlowDefinition;
  }

  async function createNew() {
    const name = window.prompt("Name this flow");
    if (!name?.trim()) return;
    const res = await fetch("/api/admin/flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        name: name.trim(),
        slug: undefined,
        category: "custom",
        description: "",
        purpose: "",
        status: "draft",
        version: 1,
        agents: ["operations"],
        triggerConditions: ["manual"],
        stages: [],
        userFacingLabel: name.trim(),
        userFacingBlurb: "",
      }),
    });
    if (res.ok) {
      const flow = (await res.json()) as FlowDefinition;
      setActive(flow);
      setView("detail");
      void refresh();
    }
  }

  if (view === "detail" && active) {
    return (
      <FlowDetail
        flow={active}
        onBack={() => {
          setView("list");
          void refresh();
        }}
        onSaved={(f) => setActive(f)}
        onAction={async (op) => {
          const next = await action(active.id, op);
          if (next) setActive(next);
        }}
      />
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Flows</h2>
          <p className="text-sm text-muted-foreground">
            Reusable operational pipelines. Edit a flow's stages, publish to make it pickable in
            Flow Mode.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={createNew}
            className="zed-glass border-white/10 h-8"
          >
            <Plus size={13} className="mr-1" />
            New
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={refresh}
            disabled={loading}
            className="zed-button text-muted-foreground hover:text-foreground h-8"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <label className="flex items-center gap-1.5 text-muted-foreground">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-white/20 bg-black"
          />
          Show archived
        </label>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center text-muted-foreground py-8 text-sm">Loading…</div>
      ) : flows.length === 0 ? (
        <Card className="zed-glass border-white/10">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No flows yet. Tap <strong>New</strong> to create one.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {flows.map((f) => (
            <FlowRow
              key={f.id}
              flow={f}
              onOpen={() => {
                setActive(f);
                setView("detail");
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

function FlowRow({ flow, onOpen }: { flow: FlowDefinition; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-left transition-colors hover:bg-white/5"
      data-testid={`flow-row-${flow.slug}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">{flow.name}</span>
            <Badge
              variant="secondary"
              className={`border text-[9px] uppercase tracking-[0.16em] ${STATUS_STYLE[flow.status]}`}
            >
              {flow.status}
            </Badge>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">
            {flow.description || flow.purpose || "No description"}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            <span>{flow.stages.length} stage{flow.stages.length === 1 ? "" : "s"}</span>
            <span>·</span>
            <span>v{flow.version}</span>
            <span>·</span>
            <span className="font-mono">{flow.slug}</span>
          </div>
        </div>
        <ChevronLeft size={14} className="rotate-180 text-muted-foreground/60 shrink-0 mt-1" />
      </div>
    </button>
  );
}

function FlowDetail({
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
          <span className="text-[11px] text-muted-foreground">
            {draft.stages.length} total
          </span>
        </div>

        {draft.stages.length === 0 ? (
          <Card className="zed-glass border-white/10">
            <CardContent className="py-6 text-center text-xs text-muted-foreground">
              No stages yet. Stages are best edited as JSON for now — paste from a seed
              template, then publish.
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

function StageRow({
  stage,
  onChange,
}: {
  stage: FlowStage;
  onChange: (patch: Partial<FlowStage>) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="zed-glass border-white/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">
            {String(stage.order).padStart(2, "0")}
          </span>
          <span className="text-sm font-medium flex-1 truncate">{stage.name}</span>
          {stage.requiresApproval && (
            <Badge
              variant="secondary"
              className="zed-glass border-white/10 text-[9px] uppercase tracking-[0.16em]"
            >
              approval
            </Badge>
          )}
          {stage.assignedAgent && (
            <Badge
              variant="secondary"
              className="zed-glass border-purple-500/30 text-purple-200 text-[9px] uppercase tracking-[0.16em]"
            >
              {stage.assignedAgent}
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground">
            {stage.steps.length} step{stage.steps.length === 1 ? "" : "s"}
          </span>
        </div>
      </button>
      {open && (
        <CardContent className="space-y-2 pt-0 text-xs">
          <Field label="Name">
            <Input
              value={stage.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className="zed-glass border-white/10"
            />
          </Field>
          <Field label="Assigned agent">
            <Input
              value={stage.assignedAgent || ""}
              onChange={(e) => onChange({ assignedAgent: (e.target.value || undefined) as any })}
              className="zed-glass border-white/10 font-mono"
              placeholder="operations / research / business / finance / security / content"
            />
          </Field>
          <label className="flex items-center gap-2 text-muted-foreground">
            <input
              type="checkbox"
              checked={stage.requiresApproval}
              onChange={(e) => onChange({ requiresApproval: e.target.checked })}
              className="h-3.5 w-3.5 rounded border-white/20 bg-black"
            />
            Requires approval before advancing
          </label>
          <Field label="Steps">
            <div className="space-y-1">
              {stage.steps.map((step, idx) => (
                <div
                  key={step.id}
                  className="flex items-start gap-2 rounded-md bg-white/5 px-2 py-1.5"
                >
                  <span className="font-mono text-[10px] text-muted-foreground mt-0.5">
                    {idx + 1}.
                  </span>
                  <span className="text-xs text-foreground/85 leading-5">{step.label}</span>
                </div>
              ))}
            </div>
          </Field>
        </CardContent>
      )}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
