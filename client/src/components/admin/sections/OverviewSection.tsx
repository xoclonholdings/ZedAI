import { useEffect, useState } from "react";
import {
  AlertCircle,
  Bot,
  CheckCircle,
  ClipboardList,
  Database,
  FileText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Workflow,
  Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ProviderDiagnosticsCard from "@/components/admin/ProviderDiagnosticsCard";
import EnvValidatorCard from "@/components/admin/EnvValidatorCard";
import { StatusDot, type AdminSection } from "@/components/admin/types";

export default function OverviewSection({
  onNavigate,
  onOpenChat,
  pendingApprovals,
}: {
  onNavigate: (section: AdminSection) => void;
  onOpenChat: () => void;
  pendingApprovals: number;
}) {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function fetchStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/system-status", { credentials: "include" });
      if (res.ok) setStatus(await res.json());
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    void fetchStatus();
  }, []);

  const activeAgents: any[] = status?.orchestrator?.active || [];
  const inactiveAgents: any[] =
    status?.orchestrator?.planned || status?.orchestrator?.stubbed || [];

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Overview</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchStatus}
          disabled={loading}
          className="zed-button text-muted-foreground hover:text-foreground"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ActionTile
          icon={<Workflow size={16} className="text-cyan-300" />}
          label="Flows"
          subtle="Operational pipelines"
          onClick={() => onNavigate("flows")}
        />
        <ActionTile
          icon={<Bot size={16} className="text-purple-300" />}
          label="Integrations"
          subtle="AI host, GitHub, email…"
          onClick={() => onNavigate("integrations")}
        />
        <ActionTile
          icon={<Database size={16} className="text-cyan-300" />}
          label="Knowledge"
          subtle="Memory & sources"
          onClick={() => onNavigate("knowledge")}
        />
        <ActionTile
          icon={<Wrench size={16} className="text-emerald-300" />}
          label="Ruleset"
          subtle="Personality, security, params"
          onClick={() => onNavigate("ruleset")}
        />
        <ActionTile
          icon={<ClipboardList size={16} className="text-pink-300" />}
          label={`Approvals${pendingApprovals > 0 ? ` (${pendingApprovals})` : ""}`}
          subtle="Awaiting your sign-off"
          onClick={() => onNavigate("approvals")}
          highlight={pendingApprovals > 0}
        />
        <ActionTile
          icon={<FileText size={16} className="text-yellow-300" />}
          label="Logs"
          subtle="Errors & routing"
          onClick={() => onNavigate("logs")}
        />
        <ActionTile
          icon={<ShieldCheck size={16} className="text-blue-300" />}
          label="Security"
          subtle="Auth, env validator, log"
          onClick={() => onNavigate("security")}
        />
      </div>

      {loading && !status ? (
        <div className="text-center text-muted-foreground py-8 text-sm">Loading status…</div>
      ) : status ? (
        <div className="grid gap-3 md:grid-cols-2">
          <ProviderDiagnosticsCard />

          <Card className="zed-glass border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles size={14} className="text-purple-300" />
                Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <Row
                label="Provider"
                value={
                  <span className="flex items-center gap-2">
                    <StatusDot online={status.ollama?.status === "online"} />
                    <span className="capitalize">{status.ollama?.status || "unknown"}</span>
                    {status.ollama?.provider && (
                      <Badge
                        variant="secondary"
                        className="zed-glass border-white/10 text-[9px] uppercase tracking-[0.16em]"
                      >
                        {status.ollama.provider}
                      </Badge>
                    )}
                  </span>
                }
              />
              <Row
                label="Database"
                value={
                  <span className="flex items-center gap-2">
                    <StatusDot online={status.database === "connected"} />
                    <span className="capitalize">{status.database}</span>
                  </span>
                }
              />
              <Row
                label="Active agents"
                value={
                  <span className="text-foreground/80">
                    {activeAgents.length} live · {inactiveAgents.length} planned
                  </span>
                }
              />
              {activeAgents.length > 0 && (
                <details className="pt-1">
                  <summary className="cursor-pointer text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Show roster
                  </summary>
                  <div className="mt-2 space-y-1">
                    {activeAgents.map((a: any) => (
                      <div
                        key={a.key || a.label || a}
                        className="flex items-center gap-2 text-xs"
                      >
                        <CheckCircle size={11} className="text-green-400" />
                        <span>{a.label || a}</span>
                      </div>
                    ))}
                    {inactiveAgents.map((a: any) => (
                      <div
                        key={a.key || a.label || a}
                        className="flex items-center gap-2 text-xs"
                      >
                        <AlertCircle size={11} className="text-yellow-400" />
                        <span className="text-muted-foreground">{a.label || a}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="zed-glass border-white/10 h-7 text-xs"
                  onClick={() => onNavigate("integrations")}
                >
                  Test AI host
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="zed-glass border-white/10 h-7 text-xs"
                  onClick={onOpenChat}
                >
                  Open chat
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="md:col-span-2">
            <EnvValidatorCard />
          </div>
        </div>
      ) : (
        <div className="text-center text-muted-foreground py-8 text-sm">
          Could not fetch system status.
        </div>
      )}
    </>
  );
}

function ActionTile({
  icon,
  label,
  subtle,
  onClick,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  subtle: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-2 rounded-xl border bg-black/30 px-3 py-2.5 text-left transition-colors hover:bg-white/5 ${
        highlight ? "border-pink-500/40 bg-pink-500/5" : "border-white/10"
      }`}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-[11px] text-muted-foreground">{subtle}</div>
      </div>
    </button>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
