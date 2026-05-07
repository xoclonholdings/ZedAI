import { useEffect, useState } from "react";
import { Activity, Globe, RefreshCw, Server } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type LaneKey = "chat" | "manager" | "operations" | "research" | "business" | "finance";

interface RuntimeStatus {
  provider?: string;
  model?: string;
  target?: string;
  target_url?: string;
  location_label?: string;
  is_local?: boolean;
  status?: string;
  available_models?: string[];
  lane_models?: Partial<Record<LaneKey, string>>;
}

const LANE_ORDER: LaneKey[] = ["chat", "manager", "operations", "research", "business", "finance"];

const LANE_LABELS: Record<LaneKey, string> = {
  chat: "Chat lane",
  manager: "Manager (classifier)",
  operations: "Operations agent",
  research: "Research agent",
  business: "Business agent",
  finance: "Finance agent",
};

export default function ProviderDiagnosticsCard() {
  const [data, setData] = useState<RuntimeStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchRuntime() {
    setLoading(true);
    try {
      const res = await fetch("/api/system/runtime", { credentials: "include" });
      if (!res.ok) {
        setError(`HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ""}`);
        setData(null);
      } else {
        setData((await res.json()) as RuntimeStatus);
        setError(null);
      }
    } catch (err: any) {
      setError(err?.message || "Network error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchRuntime();
  }, []);

  return (
    <Card className="zed-glass border-white/10 md:col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity size={18} className="text-cyan-300" />
              Provider Routing
            </CardTitle>
            <CardDescription>What the live deploy is actually wired to.</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchRuntime}
            disabled={loading}
            className="zed-button text-muted-foreground hover:text-foreground"
          >
            <RefreshCw size={14} className={`mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-300">
            Could not read runtime status: {error}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <DiagItem
            icon={<Server size={14} className="text-purple-300" />}
            label="Active provider"
            value={data?.provider || "—"}
            badge={data?.location_label}
          />
          <DiagItem
            icon={<Globe size={14} className="text-cyan-300" />}
            label="Target URL"
            value={data?.target_url || data?.target || "—"}
            mono
          />
          <DiagItem
            icon={<Activity size={14} className="text-pink-300" />}
            label="Default model"
            value={data?.model || "—"}
            mono
          />
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
          <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Per-lane model overrides
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {LANE_ORDER.map((lane) => {
              const override = data?.lane_models?.[lane];
              const usingDefault = !override;
              return (
                <div
                  key={lane}
                  className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs"
                >
                  <span className="text-muted-foreground">{LANE_LABELS[lane]}</span>
                  <span
                    className={`font-mono ${
                      usingDefault ? "text-muted-foreground/60 italic" : "text-foreground"
                    }`}
                  >
                    {usingDefault ? "(default)" : override}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-4 text-muted-foreground">
            Set <code className="rounded bg-white/10 px-1">MODEL_CHAT</code>,{" "}
            <code className="rounded bg-white/10 px-1">MODEL_OPERATIONS</code>, etc. as env
            vars to override per lane. Lanes marked <em>(default)</em> use the active
            provider&apos;s default model.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function DiagItem({
  icon,
  label,
  value,
  mono,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  badge?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
      <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`text-sm break-all ${mono ? "font-mono" : ""}`}
          data-testid={`diag-${label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          {value}
        </span>
        {badge ? (
          <Badge
            variant="secondary"
            className="zed-glass border-white/10 text-[10px] uppercase tracking-[0.16em]"
          >
            {badge}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
