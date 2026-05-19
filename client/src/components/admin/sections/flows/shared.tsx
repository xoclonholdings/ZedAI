import type { ReactNode } from "react";

import type { FlowStatus } from "../../../../../../shared/flow-types";

export type View = "list" | "detail";

export const STATUS_STYLE: Record<FlowStatus, string> = {
  draft: "bg-yellow-500/15 text-yellow-200 border-yellow-500/30",
  published: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  archived: "bg-white/5 text-muted-foreground border-white/10",
};

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
