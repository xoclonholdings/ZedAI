import { Bot, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/admin/types";

export interface AiHostTestState {
  status: "idle" | "testing" | "ok" | "error";
  detail?: string;
  payload?: any;
}

export function AiHostPanel({
  status,
  test,
  onTest,
}: {
  status: any;
  test: AiHostTestState;
  onTest: () => void;
}) {
  const isOnline = status?.ollama?.status === "online";
  const providerLabel = status?.ollama?.provider || "—";
  const models: string[] = status?.ollama?.models || [];
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <Bot size={14} className="text-purple-300" />
          AI Host
        </div>
        <Button
          size="sm"
          variant="outline"
          className="zed-glass border-white/10 h-8"
          onClick={onTest}
          disabled={test.status === "testing"}
        >
          <RefreshCw
            size={13}
            className={`mr-1 ${test.status === "testing" ? "animate-spin" : ""}`}
          />
          {test.status === "testing" ? "Testing…" : "Test"}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusDot online={isOnline} />
        <span className="capitalize">{status?.ollama?.status || "unknown"}</span>
        <Badge
          variant="secondary"
          className="zed-glass border-white/10 text-[10px] uppercase tracking-[0.16em]"
        >
          {providerLabel}
        </Badge>
        {models.length > 0 && (
          <span className="font-mono text-xs text-muted-foreground truncate">
            {models[0]}
            {models.length > 1 ? ` +${models.length - 1}` : ""}
          </span>
        )}
      </div>
      {test.status === "ok" && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200">
          {test.detail}
        </div>
      )}
      {test.status === "error" && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-200 space-y-1.5">
          <pre className="whitespace-pre-wrap break-all font-mono leading-5">
            {test.detail || "Unknown error"}
          </pre>
          {test.payload && (
            <details>
              <summary className="cursor-pointer text-[10px] uppercase tracking-[0.18em] text-red-300/80">
                raw response
              </summary>
              <pre className="mt-1 overflow-x-auto rounded bg-black/40 p-2 text-[10px]">
                {JSON.stringify(test.payload, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
