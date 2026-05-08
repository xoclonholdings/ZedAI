import { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  Bot,
  CheckCircle,
  Clock,
  Database,
  Edit3,
  FileText,
  RefreshCw,
  Server,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ProviderDiagnosticsCard from "@/components/admin/ProviderDiagnosticsCard";
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
        <div>
          <h2 className="text-lg font-semibold">Overview</h2>
          <p className="text-sm text-muted-foreground">
            Live system health, agent status, and launch controls.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchStatus}
          className="zed-button text-muted-foreground hover:text-foreground"
        >
          <RefreshCw size={14} className="mr-1" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Loading…</div>
      ) : status ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ProviderDiagnosticsCard />

          <Card className="zed-glass border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot size={18} className="text-purple-400" />
                Provider Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <StatusDot online={status.ollama?.status === "online"} />
                <span className="text-sm capitalize">{status.ollama?.status || "unknown"}</span>
                {status.ollama?.provider && (
                  <Badge
                    variant="secondary"
                    className="zed-glass border-white/10 text-[10px] uppercase tracking-[0.16em]"
                  >
                    {status.ollama.provider}
                  </Badge>
                )}
              </div>
              {status.ollama?.models?.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Reported models:</p>
                  <div className="flex flex-wrap gap-1">
                    {status.ollama.models.map((m: string) => (
                      <Badge
                        key={m}
                        variant="secondary"
                        className="zed-glass border-white/10 text-xs"
                      >
                        {m}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Provider hasn&apos;t reported any models. If chat is failing, open Integrations
                  → AI Host and run a test — the resulting error message will tell you exactly
                  what&apos;s wrong.
                </p>
              )}
              <Button
                size="sm"
                variant="outline"
                className="zed-glass border-white/10"
                onClick={() => onNavigate("integrations")}
              >
                <Bot size={14} className="mr-1" />
                Open AI Host Controls
              </Button>
            </CardContent>
          </Card>

          <Card className="zed-glass border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database size={18} className="text-cyan-400" />
                Database
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <StatusDot online={status.database === "connected"} />
                <span className="text-sm capitalize">{status.database}</span>
              </div>
              <p className="text-xs text-muted-foreground">PostgreSQL via Drizzle ORM</p>
            </CardContent>
          </Card>

          <Card className="zed-glass border-white/10 md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity size={18} className="text-pink-400" />
                Agent Orchestrator
              </CardTitle>
              <CardDescription>ManagerAgent routing status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Active agents</p>
                  {activeAgents.map((a: any) => (
                    <div key={a.key || a.label || a} className="flex items-center gap-2 mb-1">
                      <CheckCircle size={12} className="text-green-400" />
                      <span className="text-sm">{a.label || a}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Inactive / planned agents</p>
                  {inactiveAgents.map((a: any) => (
                    <div key={a.key || a.label || a} className="flex items-center gap-2 mb-1">
                      <AlertCircle size={12} className="text-yellow-400" />
                      <span className="text-sm">{a.label || a}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="zed-glass border-white/10 md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap size={18} className="text-yellow-400" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="zed-glass border-white/10"
                  onClick={() => onNavigate("integrations")}
                >
                  <Bot size={14} className="mr-1" />
                  Integrations
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="zed-glass border-white/10"
                  onClick={() => onNavigate("knowledge")}
                >
                  <Database size={14} className="mr-1" />
                  Knowledge
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="zed-glass border-white/10"
                  onClick={() => onNavigate("ruleset")}
                >
                  <Edit3 size={14} className="mr-1" />
                  Edit Ruleset
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="zed-glass border-white/10"
                  onClick={() => onNavigate("approvals")}
                >
                  <Clock size={14} className="mr-1" />
                  Approval Queue
                  {pendingApprovals > 0 && (
                    <span className="ml-1 text-pink-400">({pendingApprovals})</span>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="zed-glass border-white/10"
                  onClick={() => onNavigate("logs")}
                >
                  <FileText size={14} className="mr-1" />
                  View Logs
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="zed-glass border-white/10"
                  onClick={onOpenChat}
                >
                  <Server size={14} className="mr-1" />
                  Open Chat
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="text-center text-muted-foreground py-12">
          Could not fetch system status.
        </div>
      )}
    </>
  );
}
