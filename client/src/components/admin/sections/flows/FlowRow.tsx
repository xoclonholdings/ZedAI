import { ChevronLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import type { FlowDefinition } from "../../../../../../shared/flow-types";
import { STATUS_STYLE } from "./shared";

export function FlowRow({ flow, onOpen }: { flow: FlowDefinition; onOpen: () => void }) {
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
            <span>
              {flow.stages.length} stage{flow.stages.length === 1 ? "" : "s"}
            </span>
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
