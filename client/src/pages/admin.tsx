import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Activity,
  AlertCircle,
  Bot,
  Briefcase,
  CheckCircle,
  ChevronLeft,
  Clock,
  Database,
  Edit3,
  FileText,
  Lock,
  RefreshCw,
  Save,
  Server,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/auth/UseAuth";
import { useAppSettings } from "@/hooks/useAppSettings";
import zedLogo from "@assets/Zed_logo.png";
import AdminSecuritySettings from "@/components/settings/AdminSecuritySettings";
import IntegrationSettings from "@/components/settings/IntegrationSettings";
import PersonalizationSettings from "@/components/settings/PersonalizationSettings";
import SettingsAppControls from "@/components/settings/SettingsAppControls";
import SettingsSuggestions from "@/components/settings/SettingsSuggestions";
import SettingsVoiceControls from "@/components/settings/SettingsVoiceControls";
import UserManagement from "@/components/settings/UserManagement";

type Section = "overview" | "configuration" | "users" | "integrations" | "ruleset" | "approvals" | "logs" | "security";

export default function Admin() {
  const [, navigate] = useLocation();
  const { user } = useAuth() as { user?: any };
  const { appSettings, setAppSettings } = useAppSettings();
  const [section, setSection] = useState<Section>("overview");

  const [status, setStatus] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [ruleset, setRuleset] = useState<Record<string, string>>({});
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [approvals, setApprovals] = useState<any[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [runtimeLogs, setRuntimeLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [securityLoading, setSecurityLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    if (section === "ruleset" && Object.keys(ruleset).length === 0) void fetchRuleset();
    if (section === "logs") void fetchLogs();
    if (section === "approvals") void fetchApprovals();
    if (section === "security") void fetchSecurityLog();
  }, [section]);

  async function fetchStatus() {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/admin/system-status", { credentials: "include" });
      if (res.ok) setStatus(await res.json());
    } catch {}
    setStatusLoading(false);
  }

  async function fetchRuleset() {
    try {
      const res = await fetch("/api/admin/ruleset", { credentials: "include" });
      if (res.ok) setRuleset(await res.json());
    } catch {}
  }

  async function fetchApprovals() {
    setApprovalsLoading(true);
    try {
      const res = await fetch("/api/admin/approval-queue", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setApprovals((data.entries || []).reverse());
      }
    } catch {}
    setApprovalsLoading(false);
  }

  async function fetchLogs() {
    setLogsLoading(true);
    try {
      const res = await fetch("/api/admin/logs", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.entries || []);
        setRuntimeLogs(data.runtime || []);
      }
    } catch {}
    setLogsLoading(false);
  }

  async function fetchSecurityLog() {
    setSecurityLoading(true);
    try {
      const res = await fetch("/api/admin/security-log", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSecurityEvents((data.events || []).reverse());
      }
    } catch {}
    setSecurityLoading(false);
  }

  async function saveRulesetFile() {
    if (!editingFile) return;
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/admin/ruleset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ filename: editingFile, content: editContent }),
      });
      if (res.ok) {
        setRuleset((prev) => ({ ...prev, [editingFile]: editContent }));
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    }
  }

  async function resolveApproval(id: string, action: "approve" | "reject") {
    try {
      const res = await fetch(`/api/admin/${action === "approve" ? "approve" : "reject"}/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setApprovals((prev) =>
          prev.map((entry) =>
            entry.id === id
              ? { ...entry, status: action === "approve" ? "approved" : "rejected", resolvedAt: new Date().toISOString() }
              : entry,
          ),
        );
      }
    } catch {}
  }

  function startEdit(filename: string) {
    setEditingFile(filename);
    setEditContent(ruleset[filename] || "");
    setSaveStatus("idle");
  }

  const StatusDot = ({ online }: { online: boolean }) => (
    <span className={`inline-block w-2 h-2 rounded-full ${online ? "bg-green-400" : "bg-red-400"}`} />
  );

  const pendingCount = approvals.filter((entry) => entry.status === "pending").length;

  const navTabs: Array<{ id: Section; label: string; badge?: number }> = [
    { id: "overview", label: "System Overview" },
    { id: "configuration", label: "Configuration" },
    { id: "users", label: "Users" },
    { id: "integrations", label: "Integrations" },
    { id: "ruleset", label: "Ruleset Editor" },
    { id: "approvals", label: "Approval Queue", badge: pendingCount },
    { id: "logs", label: "Agent Logs" },
    { id: "security", label: "Security Log" },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-white/10 zed-glass px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/chat")} className="text-muted-foreground hover:text-foreground zed-button rounded-xl">
            <ChevronLeft size={16} className="mr-1" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <img src={zedLogo} alt="ZED" className="w-6 h-6 object-contain" />
            <span className="font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
              ZED Admin
            </span>
          </div>
        </div>
        <Badge className="zed-glass border-purple-500/30 text-purple-300 text-xs">
          <Shield size={10} className="mr-1" />
          {user?.username || "Admin"}
        </Badge>
      </div>

      <div className="border-b border-white/10 px-4 flex gap-1 bg-black/60">
        {navTabs.map(({ id, label, badge }) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-1.5 ${
              section === id ? "text-white border-b-2 border-purple-500" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
            {badge != null && badge > 0 && (
              <span className="bg-pink-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {section === "overview" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">System Status</h2>
              <Button variant="ghost" size="sm" onClick={fetchStatus} className="zed-button text-muted-foreground hover:text-foreground">
                <RefreshCw size={14} className="mr-1" />
                Refresh
              </Button>
            </div>

            {statusLoading ? (
              <div className="text-center text-muted-foreground py-12">Loading...</div>
            ) : status ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="zed-glass border-white/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Bot size={18} className="text-purple-400" />
                      Ollama AI Engine
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <StatusDot online={status.ollama?.status === "online"} />
                      <span className="text-sm capitalize">{status.ollama?.status}</span>
                    </div>
                    {status.ollama?.models?.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Available models:</p>
                        {status.ollama.models.map((model: string) => (
                          <Badge key={model} variant="secondary" className="zed-glass border-white/10 text-xs mr-1">
                            {model}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No models loaded. Run <code className="bg-white/10 px-1 rounded">ollama pull qwen2.5:7b</code>
                      </p>
                    )}
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
                        {status.orchestrator?.active?.map((agent: any) => (
                          <div key={agent.key || agent.label} className="flex items-center gap-2 mb-1">
                            <CheckCircle size={12} className="text-green-400" />
                            <span className="text-sm">{agent.label || agent}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Planned lanes</p>
                        {status.orchestrator?.planned?.map((agent: any) => (
                          <div key={agent.key || agent.label} className="flex items-center gap-2 mb-1">
                            <AlertCircle size={12} className="text-yellow-400" />
                            <span className="text-sm">{agent.label || agent}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="zed-glass border-white/10 md:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Briefcase size={18} className="text-emerald-400" />
                      Setup Openings
                    </CardTitle>
                    <CardDescription>Every provider-backed feature can be configured from the integrations flow.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {["GitHub", "Email", "Phone / Voicemail", "Business Ops", "Gusto", "Kalshi"].map((label) => (
                        <Button key={label} size="sm" variant="outline" className="zed-glass border-white/10" onClick={() => setSection("integrations")}>
                          {label}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="zed-glass border-white/10 md:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Shield size={18} className="text-cyan-300" />
                      Fantasma Firewall Link
                    </CardTitle>
                    <CardDescription>VPN-first status for the firewall control plane and its public domain exposure.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <StatusDot online={status.firewall?.status === "connected"} />
                      <span className="text-sm">{status.firewall?.message || "Firewall integration not configured yet."}</span>
                    </div>
                    {status.firewall?.baseUrl && (
                      <p className="text-xs text-muted-foreground">
                        Route: {status.firewall.route} via {status.firewall.baseUrl}
                      </p>
                    )}
                    <Button size="sm" variant="outline" className="zed-glass border-white/10" onClick={() => setSection("integrations")}>
                      <Shield size={14} className="mr-1" />
                      Configure Firewall
                    </Button>
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
                      <Button size="sm" variant="outline" className="zed-glass border-white/10" onClick={() => setSection("ruleset")}><Edit3 size={14} className="mr-1" />Edit Ruleset</Button>
                      <Button size="sm" variant="outline" className="zed-glass border-white/10" onClick={() => setSection("configuration")}><Shield size={14} className="mr-1" />Settings</Button>
                      <Button size="sm" variant="outline" className="zed-glass border-white/10" onClick={() => setSection("users")}><Bot size={14} className="mr-1" />Users</Button>
                      <Button size="sm" variant="outline" className="zed-glass border-white/10" onClick={() => setSection("integrations")}><Briefcase size={14} className="mr-1" />Integrations</Button>
                      <Button size="sm" variant="outline" className="zed-glass border-white/10" onClick={() => setSection("approvals")}><Clock size={14} className="mr-1" />Approval Queue {pendingCount > 0 && <span className="ml-1 text-pink-400">({pendingCount})</span>}</Button>
                      <Button size="sm" variant="outline" className="zed-glass border-white/10" onClick={() => setSection("logs")}><FileText size={14} className="mr-1" />View Logs</Button>
                      <Button size="sm" variant="outline" className="zed-glass border-white/10" onClick={() => navigate("/chat")}><Server size={14} className="mr-1" />Open Chat</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-12">Could not fetch system status.</div>
            )}
          </>
        )}

        {section === "configuration" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Admin Configuration</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Central control plane for security, personalization defaults, and frontend feature behavior.
              </p>
            </div>
            <AdminSecuritySettings />
            <PersonalizationSettings />
            <Card className="zed-glass border-white/10">
              <CardHeader>
                <CardTitle className="text-base">Workspace Controls</CardTitle>
                <CardDescription>These controls save through the admin settings API instead of browser-only storage.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <SettingsAppControls appSettings={appSettings} setAppSettings={setAppSettings} />
                <SettingsVoiceControls appSettings={appSettings} setAppSettings={setAppSettings} />
                <SettingsSuggestions appSettings={appSettings} setAppSettings={setAppSettings} />
              </CardContent>
            </Card>
          </div>
        )}

        {section === "users" && <UserManagement />}
        {section === "integrations" && <IntegrationSettings />}

        {section === "ruleset" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Hub Config Ruleset</h2>
              <Button variant="ghost" size="sm" onClick={fetchRuleset} className="zed-button text-muted-foreground hover:text-foreground">
                <RefreshCw size={14} className="mr-1" />
                Reload
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              YAML configuration files loaded by the ManagerAgent orchestrator. Changes take effect immediately after saving.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(ruleset).map(([filename, content]) => (
                <Card key={filename} className={`zed-glass border-white/10 cursor-pointer transition-all ${editingFile === filename ? "border-purple-500/50" : "hover:border-white/20"}`} onClick={() => startEdit(filename)}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText size={14} className="text-purple-400" />
                      {filename}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs text-muted-foreground overflow-hidden max-h-16 leading-relaxed">{content || "(empty)"}</pre>
                  </CardContent>
                </Card>
              ))}
            </div>

            {editingFile && (
              <Card className="zed-glass border-purple-500/30">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Edit3 size={14} className="text-purple-400" />
                      Editing: {editingFile}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => setEditingFile(null)} className="text-muted-foreground hover:text-foreground text-xs h-auto py-1">
                      Cancel
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={12} className="zed-glass border-white/10 font-mono text-xs resize-none" placeholder="YAML content..." />
                  <div className="flex items-center gap-3">
                    <Button onClick={saveRulesetFile} disabled={saveStatus === "saving"} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                      <Save size={14} className="mr-1" />
                      {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved!" : saveStatus === "error" ? "Error - retry" : "Save Changes"}
                    </Button>
                    {saveStatus === "error" && <span className="text-xs text-red-400">Invalid YAML or save failed.</span>}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {section === "approvals" && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Approval Queue</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Actions flagged by agents that require your sign-off before execution.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchApprovals} className="zed-button text-muted-foreground hover:text-foreground">
                <RefreshCw size={14} className="mr-1" />
                Refresh
              </Button>
            </div>

            {approvalsLoading ? (
              <div className="text-center text-muted-foreground py-12">Loading...</div>
            ) : approvals.length === 0 ? (
              <Card className="zed-glass border-white/10">
                <CardContent className="py-12 text-center text-muted-foreground text-sm">
                  <CheckCircle size={32} className="mx-auto mb-3 text-green-400/50" />
                  No items in the approval queue.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {approvals.map((entry) => (
                  <Card key={entry.id} className={`zed-glass border-white/10 ${entry.status === "approved" ? "border-green-500/30" : entry.status === "rejected" ? "border-red-500/20 opacity-60" : "border-yellow-500/30"}`}>
                    <CardContent className="pt-4 pb-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={`text-[10px] ${entry.status === "pending" ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" : entry.status === "approved" ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-red-500/20 text-red-300 border-red-500/30"}`}>
                              {entry.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{entry.agent} · {new Date(entry.timestamp).toLocaleString()}</span>
                          </div>
                          <p className="text-sm font-medium text-foreground/90 truncate">{entry.message}</p>
                          {entry.draft && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">Draft: {entry.draft}</p>}
                          {entry.rejectionReason && <p className="text-xs text-red-400 mt-1">Reason: {entry.rejectionReason}</p>}
                        </div>
                        {entry.status === "pending" && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button size="sm" onClick={() => resolveApproval(entry.id, "approve")} className="h-8 px-3 bg-green-600/20 hover:bg-green-600/40 text-green-300 border border-green-500/30" variant="outline">
                              <ThumbsUp size={12} className="mr-1" />
                              Approve
                            </Button>
                            <Button size="sm" onClick={() => resolveApproval(entry.id, "reject")} className="h-8 px-3 bg-red-600/20 hover:bg-red-600/40 text-red-300 border border-red-500/30" variant="outline">
                              <ThumbsDown size={12} className="mr-1" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {section === "logs" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Agent Logs</h2>
              <Button variant="ghost" size="sm" onClick={fetchLogs} className="zed-button text-muted-foreground hover:text-foreground">
                <RefreshCw size={14} className="mr-1" />
                Refresh
              </Button>
            </div>

            {logsLoading ? (
              <div className="text-center text-muted-foreground py-12">Loading...</div>
            ) : (
              <div className="space-y-4">
                <Card className="zed-glass border-white/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Routing Logs</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {logs.length === 0 ? (
                      <div className="py-8 text-sm text-muted-foreground">No routing logs yet. Send a message in Agent mode to generate entries.</div>
                    ) : (
                      <div className="space-y-1 max-h-[35vh] overflow-y-auto font-mono">
                        {[...logs].reverse().map((entry, i) => {
                          let parsed: any = {};
                          try { parsed = JSON.parse(entry); } catch {}
                          return (
                            <div key={i} className="text-xs px-3 py-2 rounded-lg bg-white/5 border border-white/5">
                              <span className="text-muted-foreground">{parsed.timestamp ? new Date(parsed.timestamp).toLocaleTimeString() : ""}</span>
                              <span className="mx-2 text-purple-400 font-medium">{parsed.agent || "-"}</span>
                              <span className="text-foreground/70">{parsed.conversationId ? `conv:${String(parsed.conversationId).slice(0, 8)}` : ""}</span>
                              {parsed.messageLength && <span className="ml-2 text-muted-foreground">{parsed.messageLength} chars</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="zed-glass border-white/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Runtime & Client Errors</CardTitle>
                    <CardDescription>Centralized debugging feed for failed requests, UI crashes, and server runtime errors.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {runtimeLogs.length === 0 ? (
                      <div className="py-8 text-sm text-muted-foreground">No runtime errors recorded yet.</div>
                    ) : (
                      <div className="space-y-1 max-h-[35vh] overflow-y-auto font-mono">
                        {runtimeLogs.slice().reverse().map((entry, i) => (
                          <div key={i} className="text-xs px-3 py-2 rounded-lg bg-white/5 border border-white/5">
                            <span className="text-muted-foreground">{entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : ""}</span>
                            <span className={`mx-2 font-medium ${entry.level === "error" ? "text-red-400" : entry.level === "warn" ? "text-yellow-400" : "text-cyan-400"}`}>
                              {entry.source}:{entry.event}
                            </span>
                            <span className="text-foreground/70">{entry.detail || ""}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}

        {section === "security" && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Security Log</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Auth events, tier blocks, approvals, and audit trail.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchSecurityLog} className="zed-button text-muted-foreground hover:text-foreground">
                <RefreshCw size={14} className="mr-1" />
                Refresh
              </Button>
            </div>

            {securityLoading ? (
              <div className="text-center text-muted-foreground py-12">Loading...</div>
            ) : securityEvents.length === 0 ? (
              <Card className="zed-glass border-white/10">
                <CardContent className="py-12 text-center text-muted-foreground text-sm">
                  <Lock size={32} className="mx-auto mb-3 text-purple-400/50" />
                  No security events recorded yet.
                </CardContent>
              </Card>
            ) : (
              <Card className="zed-glass border-white/10">
                <CardContent className="pt-4">
                  <div className="space-y-1 max-h-[60vh] overflow-y-auto font-mono">
                    {securityEvents.map((evt, i) => {
                      const isWarn = evt.type?.includes("fail") || evt.type?.includes("block") || evt.type?.includes("reject");
                      const isOk = evt.type?.includes("success") || evt.type?.includes("approved");
                      return (
                        <div key={i} className="text-xs px-3 py-2 rounded-lg bg-white/5 border border-white/5 flex items-start gap-2">
                          <span className="text-muted-foreground shrink-0 w-[70px]">{evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : ""}</span>
                          <span className={`font-medium shrink-0 w-[160px] truncate ${isWarn ? "text-red-400" : isOk ? "text-green-400" : "text-purple-400"}`}>{evt.type || "unknown"}</span>
                          <span className="text-foreground/70 truncate">{evt.detail || ""}</span>
                          {evt.userId && <span className="text-muted-foreground/50 shrink-0 ml-auto">{evt.userId}</span>}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
