import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { CheckCircle2, ChevronLeft, Play, Rocket, Wrench } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import type { FlowDefinition, FlowStage } from "../../../shared/flow-types";

export default function FlowDetailPage() {
  const [, navigate] = useLocation();
  const { id, workspace } = useParams<{ id?: string; workspace?: string }>();
  const [flow, setFlow] = useState<FlowDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);

  const backPath = workspace ? `/workspaces/${workspace}` : "/chat";
  const backLabel = workspace ? "Workspace" : "Chat";

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/flows/${id}`, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as FlowDefinition;
        if (!cancelled) setFlow(data);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load tool");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function launch() {
    if (!flow) return;
    setLaunching(true);
    try {
      const res = await fetch(`/api/flows/${flow.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      navigate(`/history/${body.id}`);
    } catch (e: any) {
      setError(e?.message || "Failed to start tool");
      setLaunching(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 px-4 pb-3 pt-safe-sm zed-glass">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(backPath)}
          className="rounded-xl text-muted-foreground hover:text-foreground zed-button"
        >
          <ChevronLeft size={16} className="mr-1" />
          {backLabel}
        </Button>
        <div className="flex items-center gap-2">
          <Wrench size={16} className="text-cyan-300" />
          <span className="max-w-[60vw] truncate text-sm font-medium">
            {flow?.userFacingLabel || "Tool"}
          </span>
        </div>
        <span className="w-10" />
      </div>

      <div className="mx-auto max-w-3xl space-y-4 p-4 pb-28">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>
        ) : !flow ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Tool not found.</div>
        ) : (
          <>
            <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-black p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-200/80">
                <Wrench size={14} />
                Workspace Tool
              </div>
              <h1 className="mt-2 text-2xl font-semibold">{flow.userFacingLabel}</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{flow.userFacingBlurb}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="zed-glass border-white/10 text-[10px] uppercase tracking-[0.16em]">
                  {flow.stages.length} step set{flow.stages.length === 1 ? "" : "s"}
                </Badge>
                <Badge variant="secondary" className="zed-glass border-cyan-500/30 text-cyan-200 text-[10px] uppercase tracking-[0.16em]">
                  {flow.category}
                </Badge>
              </div>
            </section>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-3 text-xs leading-5 text-emerald-100">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-300" />
                <span>
                  Starting this creates a tracked History item. ZED executes each step, pauses for approval when needed, stores outputs, and saves the final report.
                </span>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">Steps</p>
              <div className="space-y-2">
                {flow.stages.map((stage, idx) => (
                  <StageCard key={stage.id} stage={stage} idx={idx} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {flow && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-black/95 px-4 pt-3 pb-safe backdrop-blur">
          <div className="mx-auto max-w-3xl">
            <Button
              onClick={launch}
              disabled={launching}
              className="h-12 w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
            >
              {launching ? (
                <span className="flex items-center gap-2">
                  <Rocket size={16} className="animate-pulse" />
                  Starting...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Play size={16} />
                  Start
                </span>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StageCard({ stage, idx }: { stage: FlowStage; idx: number }) {
  return (
    <Card className="zed-glass border-white/10">
      <CardContent className="space-y-2 p-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">{String(idx + 1).padStart(2, "0")}</span>
          <span className="flex-1 truncate text-sm font-medium">{stage.name}</span>
          {stage.requiresApproval && (
            <Badge variant="secondary" className="zed-glass border-yellow-500/30 text-yellow-200 text-[9px] uppercase tracking-[0.16em]">
              approval
            </Badge>
          )}
        </div>
        {stage.description && <p className="text-[11px] leading-5 text-muted-foreground">{stage.description}</p>}
        {stage.steps.length > 0 && (
          <details>
            <summary className="cursor-pointer text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {stage.steps.length} item{stage.steps.length === 1 ? "" : "s"}
            </summary>
            <ul className="mt-2 space-y-1">
              {stage.steps.map((step, i) => (
                <li key={step.id} className="flex items-start gap-2 text-[11px] text-foreground/80">
                  <span className="mt-0.5 font-mono text-muted-foreground">{i + 1}.</span>
                  <span>{step.label}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
