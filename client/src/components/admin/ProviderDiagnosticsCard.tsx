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

interface HostProbeResult {
  name: string;
  lane: LaneKey;
  reasoningEffort?: string;
  model: string;
  status: "ok" | "error";
  reply: string;
  error: string;
  errorKind: string;
  elapsedMs: number;
}

interface HostTestResponse {
  status: "success" | "failed";
  detail: string;
  checks: HostProbeResult[];
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
  const [hostTest, setHostTest] = useState<HostTestResponse | null>(null);
  const [hostTestError, setHostTestError] = useState<string | null>(null);
  const [testingHost, setTestingHost] = useState(false);

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

  async function testHost() {
    setTestingHost(true);
    setHostTestError(null);
    try {
      const res = await fetch("/api/admin/ai-host/test", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      setHostTest(body as HostTestResponse);
    } catch (err: any) {
      setHostTest(null);
      setHostTestError(err?.message || "AI host test failed");
    } finally {
      setTestingHost(false);
    }
  }

  return (
    <Card className="zar-glass border-white/10">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity size={18} className="text-cyan-300" />
            Provider Routing
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void testHost()}
              disabled={testingHost}
              className="zar-glass h-7 border-white/10 px-2 text-xs"
            >
              {testingHost ? "Testing..." : "Test AI Host"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchRuntime}
              disabled={loading}
              className="zar-button text-muted-foreground hover:text-foreground h-7 px-2"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        ) : null}
        {hostTestError ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
            {hostTestError}
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-3">
          <DiagItem
            icon={<Server size={13} className="text-purple-300" />}
            label="Provider"
            value={data?.provider || "—"}
            badge={data?.location_label}
          />
          <DiagItem
            icon={<Globe size={13} className="text-cyan-300" />}
            label="Target"
            value={data?.target_url || data?.target || "—"}
            mono
          />
          <DiagItem
            icon={<Activity size={13} className="text-pink-300" />}
            label="Default model"
            value={data?.model || "—"}
            mono
          />
        </div>

        <details className="rounded-lg border border-white/10 bg-black/20">
          <summary className="cursor-pointer px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Per-lane overrides
          </summary>
          <div className="grid gap-1.5 p-2 sm:grid-cols-2">
            {LANE_ORDER.map((lane) => {
              const override = data?.lane_models?.[lane];
              const usingDefault = !override;
              return (
                <div
                  key={lane}
                  className="flex items-center justify-between rounded-md bg-white/5 px-2.5 py-1.5 text-xs"
                >
                  <span className="text-muted-foreground">{LANE_LABELS[lane]}</span>
                  <span
                    className={`font-mono ${
                      usingDefault ? "text-muted-foreground/60 italic" : "text-foreground"
                    }`}
                  >
                    {usingDefault ? "default" : override}
                  </span>
                </div>
              );
            })}
          </div>
        </details>

        {hostTest ? (
          <div
            className={`rounded-lg border px-3 py-2 text-xs ${
              hostTest.status === "success"
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-200"
                : "border-red-500/30 bg-red-500/5 text-red-200"
            }`}
          >
            <div className="font-medium">
              {hostTest.status === "success" ? "AI host checks passed" : "AI host checks failed"}
            </div>
            <div className="mt-1 leading-5 opacity-85">{hostTest.detail}</div>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
              {hostTest.checks.map((check) => (
                <div
                  key={check.name}
                  className="rounded-md border border-white/10 bg-black/20 px-2.5 py-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-white/75">
                      {check.lane}
                      {check.reasoningEffort ? ` / ${check.reasoningEffort}` : ""}
                    </span>
                    <span
                      className={check.status === "ok" ? "text-emerald-300" : "text-red-300"}
                    >
                      {check.status}
                    </span>
                  </div>
                  <div className="mt-1 truncate font-mono text-[11px] text-white/45">
                    {check.model}
                  </div>
                </div>
              ))}
            </div>
            {hostTest.checks.some((check) => check.error) ? (
              <details className="mt-2 rounded-md border border-white/10 bg-black/20">
                <summary className="cursor-pointer px-2.5 py-1.5 text-[10px] uppercase tracking-[0.16em] text-white/50">
                  Diagnostic detail
                </summary>
                <div className="space-y-1.5 p-2.5">
                  {hostTest.checks
                    .filter((check) => check.error)
                    .map((check) => (
                      <div key={`${check.name}-error`} className="text-[11px] leading-5 text-red-200/80">
                        <span className="font-medium text-red-100">{check.lane}</span>: {check.error}
                      </div>
                    ))}
                </div>
              </details>
            ) : null}
          </div>
        ) : null}
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
    <div className="rounded-lg border border-white/10 bg-black/25 p-2.5">
      <div className="mb-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`text-xs break-all ${mono ? "font-mono" : ""}`}
          data-testid={`diag-${label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          {value}
        </span>
        {badge ? (
          <Badge
            variant="secondary"
            className="zar-glass border-white/10 text-[9px] uppercase tracking-[0.16em]"
          >
            {badge}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
