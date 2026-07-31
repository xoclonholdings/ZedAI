import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import type { FlowStage } from "../../../../../../shared/flow-types";
import { Field } from "./shared";

export function StageRow({
  stage,
  onChange,
}: {
  stage: FlowStage;
  onChange: (patch: Partial<FlowStage>) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="zar-glass border-white/10">
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
              className="zar-glass border-white/10 text-[9px] uppercase tracking-[0.16em]"
            >
              approval
            </Badge>
          )}
          {stage.assignedAgent && (
            <Badge
              variant="secondary"
              className="zar-glass border-purple-500/30 text-purple-200 text-[9px] uppercase tracking-[0.16em]"
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
              className="zar-glass border-white/10"
            />
          </Field>
          <Field label="Assigned agent">
            <Input
              value={stage.assignedAgent || ""}
              onChange={(e) => onChange({ assignedAgent: (e.target.value || undefined) as any })}
              className="zar-glass border-white/10 font-mono"
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
