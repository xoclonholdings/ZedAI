import { useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import type { FlowDefinition } from "../../../../../shared/flow-types";
import { FlowDetail } from "./flows/FlowDetail";
import { FlowRow } from "./flows/FlowRow";
import type { View } from "./flows/shared";

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
      const res = await fetch(`/api/admin/flows?includeArchived=${includeArchived}`, {
        credentials: "include",
      });
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
