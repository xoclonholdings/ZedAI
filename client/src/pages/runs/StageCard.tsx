import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import type { FlowStageRun } from "../../../../shared/flow-types";
import { STAGE_ICON, STAGE_TONE, prettifyStageId } from "./styles";

export function StageCard({ stageRun, index }: { stageRun: FlowStageRun; index: number }) {
  const Icon = STAGE_ICON[stageRun.status];
  const tone = STAGE_TONE[stageRun.status];
  const stageName = prettifyStageId(stageRun.stageId);
  const output =
    typeof stageRun.output === "string"
      ? stageRun.output
      : stageRun.output
        ? JSON.stringify(stageRun.output, null, 2)
        : null;

  return (
    <Card className="zar-glass border-white/10">
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </span>
          <Icon
            size={13}
            className={`shrink-0 ${tone} ${stageRun.status === "running" ? "animate-spin" : ""}`}
          />
          <span className={`text-sm font-medium flex-1 truncate ${tone}`}>{stageName}</span>
          <Badge
            variant="secondary"
            className="zar-glass border-white/10 text-[9px] uppercase tracking-[0.16em]"
          >
            {stageRun.status.replace("_", " ")}
          </Badge>
        </div>
        {stageRun.notes && (
          <p className="text-[11px] text-muted-foreground leading-5">{stageRun.notes}</p>
        )}
        {stageRun.error && (
          <p className="text-[11px] text-red-300 leading-5">{stageRun.error}</p>
        )}
        {output && stageRun.status === "completed" && (
          <details className="pt-1">
            <summary className="cursor-pointer text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
              View output
            </summary>
            <div className="mt-2 rounded-lg border border-white/10 bg-black/30 p-3 text-xs leading-6 zar-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{output}</ReactMarkdown>
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
