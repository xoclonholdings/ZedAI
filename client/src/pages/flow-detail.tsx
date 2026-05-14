import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  AlertTriangle,
  ChevronLeft,
  Play,
  Rocket,
  Workflow,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import type {
  FlowDefinition,
  FlowStage,
} from "../../../shared/flow-types";

export default function FlowDetailPage() {
  const [, navigate] = useLocation();
  const { id } = useParams<{ id?: string }>();
  const [flow, setFlow] = useState<FlowDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);

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
        if (!cancelled) setError(e?.message || "Failed to load flow");
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
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}${body ? ` — ${body.slice(0, 160)}` : ""}`);
      }
      const run = await res.json();
      navigate(`/runs/${run.id}`);
    } catch (e: any) {
      setError(e?.message || "Failed to launch flow");
      setLaunching(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-white/10 zed-glass px-4 pb-3 pt-safe-sm flex items-center justify-between sticky top-0 z-20">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/flows")}
          className="text-muted-foreground hover:text-foreground zed-button rounded-xl"
        >
          <ChevronLeft size={16} className="mr-1" />
          Flows
        </Button>
        <div className="flex items-center gap-2">
          <Workflow size={16} className="text-cyan-300" />
          <span className="text-sm font-medium truncate max-w-[60vw]">
            {flow?.userFacingLabel || "Flow"}
          </span>
        </div>
        <span className="w-10" />
      </div>

      <div className="p-4 max-w-3xl mx-auto space-y-4 pb-24">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-muted-foreground py-12 text-sm">Loading…</div>
        ) : !flow ? (
          <div className="text-center text-muted-foreground py-12 text-sm">
            Flow not found.
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold">{flow.userFacingLabel}</h1>
              <p className="text-sm text-muted-foreground leading-6">
                {flow.userFacingBlurb}
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Badge
                variant="secondary"
                className="zed-glass border-white/10 text-[10px] uppercase tracking-[0.16em]"
              >
                {flow.stages.length} stages
              </Badge>
              {flow.agents.map((a) => (
                <Badge
                  key={a}
                  variant="secondary"
                  className="zed-glass border-purple-500/30 text-purple-200 text-[10px] uppercase tracking-[0.16em]"
                >
                  {a}
                </Badge>
              ))}
              <Badge
                variant="secondary"
                className="zed-glass border-cyan-500/30 text-cyan-200 text-[10px] uppercase tracking-[0.16em]"
              >
                v{flow.version}
              </Badge>
            </div>

            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-[11px] text-yellow-200 flex items-start gap-2">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>
                Execution engine still in development — launching creates a tracked run but
                the agent dispatch + approval gates aren&apos;t wired yet. You&apos;ll see
                the run state under <strong>Runs</strong>.
              </span>
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Stages
              </p>
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
          <div className="max-w-3xl mx-auto">
            <Button
              onClick={launch}
              disabled={launching}
              className="w-full h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50"
            >
              {launching ? (
                <span className="flex items-center gap-2">
                  <Rocket size={16} className="animate-pulse" />
                  Launching…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Play size={16} />
                  Launch flow
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
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">
            {String(idx + 1).padStart(2, "0")}
          </span>
          <span className="text-sm font-medium flex-1 truncate">{stage.name}</span>
          {stage.requiresApproval && (
            <Badge
              variant="secondary"
              className="zed-glass border-yellow-500/30 text-yellow-200 text-[9px] uppercase tracking-[0.16em]"
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
        </div>
        {stage.description && (
          <p className="text-[11px] text-muted-foreground leading-5">{stage.description}</p>
        )}
        {stage.steps.length > 0 && (
          <details>
            <summary className="cursor-pointer text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {stage.steps.length} step{stage.steps.length === 1 ? "" : "s"}
            </summary>
            <ul className="mt-2 space-y-1">
              {stage.steps.map((step, i) => (
                <li key={step.id} className="flex items-start gap-2 text-[11px] text-foreground/80">
                  <span className="font-mono text-muted-foreground mt-0.5">{i + 1}.</span>
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
