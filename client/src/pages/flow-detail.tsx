import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { CheckCircle2, Play, Rocket, Wrench } from "lucide-react";

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
  const [brief, setBrief] = useState("");

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
        body: JSON.stringify({
          context: brief.trim()
            ? {
                userBrief: brief.trim(),
                launchedFrom: workspace ? `${workspace} workspace` : "tool detail",
              }
            : {},
        }),
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
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-4">
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>
        ) : !flow ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Tool not found.</div>
        ) : (
          <>
            <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-purple-500/10 to-black p-5 backdrop-blur-md shadow-[0_0_40px_rgba(139,0,255,0.15)]">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-200/80">
                <Wrench size={14} />
                Workspace Tool
              </div>
              <h1 className="mt-2 text-2xl font-semibold">{flow.userFacingLabel}</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{flow.userFacingBlurb}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="zar-glass border-white/10 text-[10px] uppercase tracking-[0.16em]">
                  {flow.stages.length} step set{flow.stages.length === 1 ? "" : "s"}
                </Badge>
                <Badge variant="secondary" className="zar-glass border-cyan-500/30 text-cyan-200 text-[10px] uppercase tracking-[0.16em]">
                  {flow.category}
                </Badge>
              </div>
            </section>

            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.05] px-3 py-3 text-xs leading-5 text-emerald-100">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-300" />
                <span>
                  Starting this creates a tracked History item. ZAR executes each step, pauses for approval when needed, stores outputs, and saves the final report.
                </span>
              </div>
            </div>

            <section className="zar-glass rounded-2xl p-4">
              <label htmlFor="flow-brief" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Run Brief
              </label>
              <textarea
                id="flow-brief"
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                placeholder="Tell ZAR what this run should work on. Include the goal, known facts, constraints, links or notes, and what a useful result should look like."
                className="zar-input mt-3 min-h-28 w-full rounded-2xl px-3 py-3 text-sm leading-6 text-white placeholder:text-muted-foreground focus:outline-none"
              />
              <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                A brief makes the endpoint produce specific work instead of a generic readiness report.
              </p>
            </section>

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
        <div className="sticky bottom-0 -mx-4 mt-4 border-t border-white/10 bg-black/95 px-4 py-3 backdrop-blur">
          <Button
            onClick={launch}
            disabled={launching}
            className="h-12 w-full rounded-xl zar-gradient disabled:opacity-50"
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
      )}
    </div>
  );
}

function StageCard({ stage, idx }: { stage: FlowStage; idx: number }) {
  return (
    <Card className="zar-glass border-white/10">
      <CardContent className="space-y-2 p-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">{String(idx + 1).padStart(2, "0")}</span>
          <span className="flex-1 truncate text-sm font-medium">{stage.name}</span>
          {stage.requiresApproval && (
            <Badge variant="secondary" className="zar-glass border-yellow-500/30 text-yellow-200 text-[9px] uppercase tracking-[0.16em]">
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
