import { useEffect, useMemo, useState } from "react";
import { Archive, CheckCircle2, DraftingCompass, Plus, RefreshCw, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import type { FlowDefinition } from "../../../../../shared/flow-types";
import { FlowDetail } from "./flows/FlowDetail";
import { FlowRow } from "./flows/FlowRow";
import type { View } from "./flows/shared";

type ToolFilter = "all" | "published" | "draft" | "archived";

export default function ToolsSection() {
  const [view, setView] = useState<View>("list");
  const [flows, setFlows] = useState<FlowDefinition[]>([]);
  const [active, setActive] = useState<FlowDefinition | null>(null);
  const [loading, setLoading] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [filter, setFilter] = useState<ToolFilter>("all");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/flows?includeArchived=${includeArchived}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFlows(data.flows || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load tools");
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
    const name = window.prompt("Name this tool");
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

  const counts = useMemo(() => {
    const published = flows.filter((flow) => flow.status === "published").length;
    const archived = flows.filter((flow) => flow.status === "archived").length;
    const draft = flows.filter((flow) => flow.status !== "published" && flow.status !== "archived").length;
    return { published, draft, archived };
  }, [flows]);

  const visibleFlows = flows.filter((flow) => {
    if (filter === "published") return flow.status === "published";
    if (filter === "archived") return flow.status === "archived";
    if (filter === "draft") return flow.status !== "published" && flow.status !== "archived";
    return true;
  });

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
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Tools</h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Configure reusable ZED tools. These are backed by the existing flow engine, but this section is for admin-facing tools that can be created, reviewed, published, duplicated, or archived.
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
            New Tool
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

      <div className="grid gap-3 md:grid-cols-4">
        <ToolStatCard
          label="All Tools"
          value={flows.length}
          active={filter === "all"}
          icon={Wrench}
          onClick={() => setFilter("all")}
        />
        <ToolStatCard
          label="Published"
          value={counts.published}
          active={filter === "published"}
          icon={CheckCircle2}
          onClick={() => setFilter("published")}
        />
        <ToolStatCard
          label="Draft"
          value={counts.draft}
          active={filter === "draft"}
          icon={DraftingCompass}
          onClick={() => setFilter("draft")}
        />
        <ToolStatCard
          label="Archived"
          value={counts.archived}
          active={filter === "archived"}
          icon={Archive}
          onClick={() => {
            setIncludeArchived(true);
            setFilter("archived");
          }}
        />
      </div>

      <div className="flex items-center gap-2 text-xs">
        <label className="flex items-center gap-1.5 text-muted-foreground">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-white/20 bg-black"
          />
          Include archived tools
        </label>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center text-muted-foreground py-8 text-sm">Loading…</div>
      ) : visibleFlows.length === 0 ? (
        <Card className="zed-glass border-white/10">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No tools match this view. Tap <strong>New Tool</strong> to create one.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {visibleFlows.map((f) => (
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
    </div>
  );
}

function ToolStatCard({
  label,
  value,
  active,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  icon: any;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition-all ${
        active
          ? "border-cyan-400/35 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.08)]"
          : "border-white/10 bg-black/25 hover:border-white/20 hover:bg-black/35"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-white/10 bg-black/40 p-2">
          <Icon size={15} className={active ? "text-cyan-300" : "text-foreground/70"} />
        </div>
        <div>
          <div className="text-2xl font-semibold leading-none">{value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{label}</div>
        </div>
      </div>
    </button>
  );
}
