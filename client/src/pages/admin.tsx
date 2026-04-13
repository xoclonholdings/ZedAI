import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Activity,
  AlertCircle,
  Bot,
  CheckCircle,
  ChevronLeft,
  Clock,
  Database,
  Edit3,
  FileText,
  GitBranch,
  Lock,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Server,
  Shield,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Waves,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/auth/UseAuth";
import zedLogo from "@assets/Zed_logo.png";

type Section = "overview" | "knowledge" | "integrations" | "ruleset" | "approvals" | "logs" | "security";
type IntegrationKey =
  | "aiHost"
  | "businessOperations"
  | "github"
  | "email"
  | "telephony"
  | "firewall"
  | "gusto"
  | "kalshi"
  | "voiceTranscription";

type RulesetKey = "personality.yaml" | "security.yaml" | "parameters.yaml" | "access.yaml";

const RULESET_LABELS: Record<RulesetKey, { label: string; hint: string }> = {
  "personality.yaml": { label: "Personality", hint: "Voice, tone, and operator style." },
  "security.yaml": { label: "Security", hint: "Security posture and safeguards." },
  "parameters.yaml": { label: "Parameters", hint: "Routing thresholds and system defaults." },
  "access.yaml": { label: "Access", hint: "Permissions, visibility, and exposure boundaries." },
};

const integrationMeta: Record<IntegrationKey, { label: string; description: string; icon: any }> = {
  aiHost: {
    label: "AI Host",
    description: "Remote model bridge health and reconnect guidance.",
    icon: Bot,
  },
  businessOperations: {
    label: "Business Manager",
    description: "Commerce, property, credit, and planning coverage.",
    icon: Sparkles,
  },
  github: {
    label: "GitHub",
    description: "Repository connectivity and automation readiness.",
    icon: GitBranch,
  },
  email: {
    label: "Email",
    description: "Executive assistant mail lane and sender identity.",
    icon: Mail,
  },
  telephony: {
    label: "Telephony",
    description: "Phone, voicemail, and voice workflow configuration.",
    icon: Phone,
  },
  firewall: {
    label: "Firewall",
    description: "Fantasma route and health configuration.",
    icon: Shield,
  },
  gusto: {
    label: "Gusto",
    description: "Payroll and contractor workflow readiness.",
    icon: Activity,
  },
  kalshi: {
    label: "Kalshi",
    description: "Prediction-market connectivity and environment setup.",
    icon: Waves,
  },
  voiceTranscription: {
    label: "Voice",
    description: "Voice transcription provider and path.",
    icon: Zap,
  },
};

function LabeledField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="border-white/10 bg-black/30 text-sm"
      />
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  description?: string;
}) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="space-y-1">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description ? <p className="text-xs leading-5 text-muted-foreground">{description}</p> : null}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-white/20 bg-black"
      />
    </label>
  );
}

export default function Admin() {
  const [, navigate] = useLocation();
  const { user } = useAuth() as { user?: any };
  const [section, setSection] = useState<Section>("overview");

  const [status, setStatus] = useState<any>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [adminSettings, setAdminSettings] = useState<any>(null);
  const [integrationsDraft, setIntegrationsDraft] = useState<any>(null);
  const [integrationsLoading, setIntegrationsLoading] = useState(false);
  const [integrationSaveStatus, setIntegrationSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [activeIntegration, setActiveIntegration] = useState<IntegrationKey>("aiHost");
  const [aiHostTest, setAiHostTest] = useState<{ status: "idle" | "testing" | "ok" | "error"; detail?: string }>({
    status: "idle",
  });

  const [ruleset, setRuleset] = useState<Record<string, string>>({});
  const [activeRulesFile, setActiveRulesFile] = useState<RulesetKey>("personality.yaml");
  const [editContent, setEditContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [knowledgeOverview, setKnowledgeOverview] = useState<{ coreCount: number; projectCount: number; scratchpadCount: number } | null>(null);
  const [knowledgeQuery, setKnowledgeQuery] = useState("");
  const [knowledgeResults, setKnowledgeResults] = useState<any | null>(null);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [projectMemoryItems, setProjectMemoryItems] = useState<any[]>([]);
  const [scratchpadItems, setScratchpadItems] = useState<any[]>([]);
  const [knowledgeAdminLoading, setKnowledgeAdminLoading] = useState(false);
  const [projectMemoryDraft, setProjectMemoryDraft] = useState({
    id: "",
    name: "",
    description: "",
    content: "",
    type: "context",
    isActive: true,
  });
  const [projectMemorySaveStatus, setProjectMemorySaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [scratchpadDraft, setScratchpadDraft] = useState({
    content: "",
    tags: "",
  });
  const [scratchpadSaveStatus, setScratchpadSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [approvals, setApprovals] = useState<any[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);

  const [logs, setLogs] = useState<string[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [securityLoading, setSecurityLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
    fetchSettings();
  }, []);

  useEffect(() => {
    if (section === "ruleset" && Object.keys(ruleset).length === 0) fetchRuleset();
    if (section === "knowledge") {
      if (!knowledgeOverview) fetchKnowledgeOverview();
      if (projectMemoryItems.length === 0 && scratchpadItems.length === 0) fetchKnowledgeAdminData();
    }
    if (section === "logs") fetchLogs();
    if (section === "approvals") fetchApprovals();
    if (section === "security") fetchSecurityLog();
  }, [section]);

  useEffect(() => {
    setEditContent(ruleset[activeRulesFile] || "");
    setSaveStatus("idle");
  }, [activeRulesFile, ruleset]);

  async function fetchStatus() {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/admin/system-status", { credentials: "include" });
      if (res.ok) setStatus(await res.json());
    } catch {}
    setStatusLoading(false);
  }

  async function fetchSettings() {
    setIntegrationsLoading(true);
    try {
      const res = await fetch("/api/admin/settings", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch admin settings");
      const data = await res.json();
      setAdminSettings(data);
      setIntegrationsDraft(data.integrations);
    } catch {}
    setIntegrationsLoading(false);
  }

  async function fetchRuleset() {
    try {
      const res = await fetch("/api/admin/ruleset", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setRuleset(data);
        setEditContent(data[activeRulesFile] || "");
      }
    } catch {}
  }

  async function fetchKnowledgeOverview() {
    try {
      const res = await fetch("/api/admin/knowledge/overview", { credentials: "include" });
      if (res.ok) {
        setKnowledgeOverview(await res.json());
      }
    } catch {}
  }

  async function fetchKnowledgeAdminData() {
    setKnowledgeAdminLoading(true);
    try {
      const [projectRes, scratchpadRes] = await Promise.all([
        fetch("/api/knowledge/project-memory", { credentials: "include" }),
        fetch("/api/knowledge/scratchpad", { credentials: "include" }),
      ]);

      if (projectRes.ok) {
        const data = await projectRes.json();
        setProjectMemoryItems(data.items || []);
      }

      if (scratchpadRes.ok) {
        const data = await scratchpadRes.json();
        setScratchpadItems(data.items || []);
      }
    } catch {}
    setKnowledgeAdminLoading(false);
  }

  async function searchKnowledge() {
    if (!knowledgeQuery.trim()) return;
    setKnowledgeLoading(true);
    try {
      const res = await fetch(`/api/knowledge/search?q=${encodeURIComponent(knowledgeQuery.trim())}`, {
        credentials: "include",
      });
      if (res.ok) {
        setKnowledgeResults(await res.json());
      }
    } catch {}
    setKnowledgeLoading(false);
  }

  async function saveProjectMemoryItem() {
    if (!projectMemoryDraft.name.trim() || !projectMemoryDraft.content.trim()) {
      setProjectMemorySaveStatus("error");
      return;
    }

    setProjectMemorySaveStatus("saving");
    try {
      const isEditing = Boolean(projectMemoryDraft.id);
      const res = await fetch(
        isEditing ? `/api/knowledge/project-memory/${projectMemoryDraft.id}` : "/api/knowledge/project-memory",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: projectMemoryDraft.name,
            description: projectMemoryDraft.description,
            content: projectMemoryDraft.content,
            type: projectMemoryDraft.type,
            isActive: projectMemoryDraft.isActive,
          }),
        },
      );

      if (!res.ok) throw new Error("Failed to save project memory");

      await fetchKnowledgeAdminData();
      await fetchKnowledgeOverview();
      setProjectMemoryDraft({
        id: "",
        name: "",
        description: "",
        content: "",
        type: "context",
        isActive: true,
      });
      setProjectMemorySaveStatus("saved");
      setTimeout(() => setProjectMemorySaveStatus("idle"), 2000);
    } catch {
      setProjectMemorySaveStatus("error");
    }
  }

  async function deleteProjectMemoryItem(id: string) {
    try {
      const res = await fetch(`/api/knowledge/project-memory/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      await fetchKnowledgeAdminData();
      await fetchKnowledgeOverview();
      if (projectMemoryDraft.id === id) {
        setProjectMemoryDraft({
          id: "",
          name: "",
          description: "",
          content: "",
          type: "context",
          isActive: true,
        });
      }
    } catch {}
  }

  async function saveScratchpadItem() {
    if (!scratchpadDraft.content.trim()) {
      setScratchpadSaveStatus("error");
      return;
    }

    setScratchpadSaveStatus("saving");
    try {
      const res = await fetch("/api/knowledge/scratchpad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content: scratchpadDraft.content,
          tags: scratchpadDraft.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });

      if (!res.ok) throw new Error("Failed to save scratchpad");

      await fetchKnowledgeAdminData();
      await fetchKnowledgeOverview();
      setScratchpadDraft({ content: "", tags: "" });
      setScratchpadSaveStatus("saved");
      setTimeout(() => setScratchpadSaveStatus("idle"), 2000);
    } catch {
      setScratchpadSaveStatus("error");
    }
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
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/admin/ruleset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ filename: activeRulesFile, content: editContent }),
      });
      if (res.ok) {
        setRuleset((prev) => ({ ...prev, [activeRulesFile]: editContent }));
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    }
  }

  async function saveIntegrations() {
    if (!integrationsDraft) return;
    setIntegrationSaveStatus("saving");
    try {
      const res = await fetch("/api/admin/settings/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ [activeIntegration]: integrationsDraft[activeIntegration] }),
      });
      if (!res.ok) throw new Error("Failed to save integrations");
      const updated = await res.json();
      setIntegrationsDraft((prev: any) => ({ ...prev, [activeIntegration]: updated[activeIntegration] }));
      setIntegrationSaveStatus("saved");
      setTimeout(() => setIntegrationSaveStatus("idle"), 2000);
      await fetchSettings();
      await fetchStatus();
    } catch {
      setIntegrationSaveStatus("error");
    }
  }

  async function testAiHost() {
    setAiHostTest({ status: "testing" });
    try {
      const res = await fetch("/api/admin/ai-host/test", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI host test failed");
      if (data.chat?.status === "ok") {
        setAiHostTest({ status: "ok", detail: data.chat.reply || "AI host answered successfully." });
      } else {
        setAiHostTest({ status: "error", detail: data.chat?.error || "AI host test failed." });
      }
      await fetchStatus();
    } catch (error: any) {
      setAiHostTest({ status: "error", detail: error.message || "AI host test failed" });
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
          prev.map((e) =>
            e.id === id
              ? { ...e, status: action === "approve" ? "approved" : "rejected", resolvedAt: new Date().toISOString() }
              : e
          )
        );
      }
    } catch {}
  }

  function updateIntegrationField(sectionKey: IntegrationKey, field: string, value: any) {
    setIntegrationsDraft((prev: any) => ({
      ...prev,
      [sectionKey]: {
        ...prev?.[sectionKey],
        [field]: value,
      },
    }));
    setIntegrationSaveStatus("idle");
  }

  const StatusDot = ({ online }: { online: boolean }) => (
    <span className={`inline-block w-2 h-2 rounded-full ${online ? "bg-green-400" : "bg-red-400"}`} />
  );

  const pendingCount = approvals.filter((e) => e.status === "pending").length;

  const NAV_TABS: { id: Section; label: string; badge?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "knowledge", label: "Knowledge" },
    { id: "integrations", label: "Integrations" },
    { id: "ruleset", label: "Ruleset" },
    { id: "approvals", label: "Approvals", badge: pendingCount },
    { id: "logs", label: "Logs" },
    { id: "security", label: "Security" },
  ];

  const activeAgents = status?.orchestrator?.active || [];
  const inactiveAgents = status?.orchestrator?.planned || status?.orchestrator?.stubbed || [];
  const selectedIntegrationDraft = integrationsDraft?.[activeIntegration];

  function renderIntegrationPanel() {
    if (activeIntegration === "aiHost") {
      return (
        <Card className="zed-glass border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot size={16} className="text-purple-300" />
              AI Host
            </CardTitle>
            <CardDescription>
              Colab cannot be started remotely by ZED. Start the notebook yourself, then use this panel to verify the bridge.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <StatusDot online={status?.ollama?.status === "online"} />
                  <span className="text-sm font-medium capitalize">{status?.ollama?.status || "unknown"}</span>
                  <Badge variant="secondary" className="zed-glass border-white/10 text-[10px] uppercase tracking-[0.16em]">
                    {status?.ollama?.provider || "unknown"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Active model: {status?.ollama?.models?.[0] || "none detected"}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/25 p-4 text-xs leading-5 text-muted-foreground">
                <p>1. Open Colab and run the notebook once.</p>
                <p>2. Keep the notebook connected while using ZED.</p>
                <p>3. Use the button below to confirm the bridge is alive.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" variant="outline" className="zed-glass border-white/10" onClick={testAiHost} disabled={aiHostTest.status === "testing"}>
                <RefreshCw size={14} className={`mr-1 ${aiHostTest.status === "testing" ? "animate-spin" : ""}`} />
                {aiHostTest.status === "testing" ? "Testing..." : "Test / Reconnect AI Host"}
              </Button>
              {aiHostTest.status !== "idle" && (
                <p className={`text-xs ${aiHostTest.status === "ok" ? "text-emerald-300" : "text-red-300"}`}>
                  {aiHostTest.detail}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      );
    }

    if (!selectedIntegrationDraft) {
      return (
        <Card className="zed-glass border-white/10">
          <CardContent className="py-10 text-sm text-muted-foreground">
            This integration section is not available yet.
          </CardContent>
        </Card>
      );
    }

    const meta = integrationMeta[activeIntegration];
    return (
      <Card className="zed-glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <meta.icon size={16} className="text-cyan-300" />
            {meta.label}
          </CardTitle>
          <CardDescription>{meta.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleField
            label="Enabled"
            checked={!!selectedIntegrationDraft.enabled}
            onChange={(next) => updateIntegrationField(activeIntegration, "enabled", next)}
          />

          {"status" in selectedIntegrationDraft && (
            <LabeledField
              label="Status"
              value={selectedIntegrationDraft.status || ""}
              onChange={(next) => updateIntegrationField(activeIntegration, "status", next)}
            />
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(selectedIntegrationDraft)
              .filter(([key]) => !["enabled", "status", "notes"].includes(key))
              .map(([key, value]) => {
                if (typeof value === "boolean") {
                  return (
                    <ToggleField
                      key={key}
                      label={key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}
                      checked={value}
                      onChange={(next) => updateIntegrationField(activeIntegration, key, next)}
                    />
                  );
                }

                return (
                  <LabeledField
                    key={key}
                    label={key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}
                    value={String(value ?? "")}
                    onChange={(next) => updateIntegrationField(activeIntegration, key, key.toLowerCase().includes("port") ? Number(next) || 0 : next)}
                    placeholder={key.toLowerCase().includes("token") || key.toLowerCase().includes("password") || key.toLowerCase().includes("apikey")
                      ? "Stored server-side or paste a new value"
                      : undefined}
                  />
                );
              })}
          </div>

          {"notes" in selectedIntegrationDraft && (
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Notes</span>
              <Textarea
                rows={5}
                value={selectedIntegrationDraft.notes || ""}
                onChange={(e) => updateIntegrationField(activeIntegration, "notes", e.target.value)}
                className="zed-glass border-white/10 text-sm"
              />
            </label>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={saveIntegrations} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
              <Save size={14} className="mr-1" />
              {integrationSaveStatus === "saving"
                ? "Saving..."
                : integrationSaveStatus === "saved"
                  ? "Saved!"
                  : integrationSaveStatus === "error"
                    ? "Save failed"
                    : "Save Changes"}
            </Button>
            {integrationSaveStatus === "error" && <span className="text-xs text-red-400">Could not save this section.</span>}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10 zed-glass px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/chat")}
            className="text-muted-foreground hover:text-foreground zed-button rounded-xl"
          >
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

      {/* Nav tabs */}
      <div className="border-b border-white/10 px-4 flex gap-1 bg-black/60">
        {NAV_TABS.map(({ id, label, badge }) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-1.5 ${
              section === id
                ? "text-white border-b-2 border-purple-500"
                : "text-muted-foreground hover:text-foreground"
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

        {/* ── Overview ─────────────────────────────────────── */}
        {section === "overview" && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Overview</h2>
                <p className="text-sm text-muted-foreground">Live system health, agent status, and launch controls.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchStatus} className="zed-button text-muted-foreground hover:text-foreground">
                <RefreshCw size={14} className="mr-1" />
                Refresh
              </Button>
            </div>

            {statusLoading ? (
              <div className="text-center text-muted-foreground py-12">Loading…</div>
            ) : status ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="zed-glass border-white/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Bot size={18} className="text-purple-400" />
                      AI Host
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <StatusDot online={status.ollama?.status === "online"} />
                      <span className="text-sm capitalize">{status.ollama?.status}</span>
                      {status.ollama?.provider && (
                        <Badge variant="secondary" className="zed-glass border-white/10 text-[10px] uppercase tracking-[0.16em]">
                          {status.ollama.provider}
                        </Badge>
                      )}
                    </div>
                    {status.ollama?.models?.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Available models:</p>
                        {status.ollama.models.map((m: string) => (
                          <Badge key={m} variant="secondary" className="zed-glass border-white/10 text-xs mr-1">
                            {m}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No active bridge detected. Start the notebook or model host, then verify it from Integrations.
                      </p>
                    )}
                    <Button size="sm" variant="outline" className="zed-glass border-white/10" onClick={() => setSection("integrations")}>
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
                      <Button size="sm" variant="outline" className="zed-glass border-white/10" onClick={() => setSection("integrations")}>
                        <Bot size={14} className="mr-1" />
                        Integrations
                      </Button>
                      <Button size="sm" variant="outline" className="zed-glass border-white/10" onClick={() => setSection("knowledge")}>
                        <Database size={14} className="mr-1" />
                        Knowledge
                      </Button>
                      <Button size="sm" variant="outline" className="zed-glass border-white/10" onClick={() => setSection("ruleset")}>
                        <Edit3 size={14} className="mr-1" />
                        Edit Ruleset
                      </Button>
                      <Button size="sm" variant="outline" className="zed-glass border-white/10" onClick={() => setSection("approvals")}>
                        <Clock size={14} className="mr-1" />
                        Approval Queue
                        {pendingCount > 0 && <span className="ml-1 text-pink-400">({pendingCount})</span>}
                      </Button>
                      <Button size="sm" variant="outline" className="zed-glass border-white/10" onClick={() => setSection("logs")}>
                        <FileText size={14} className="mr-1" />
                        View Logs
                      </Button>
                      <Button size="sm" variant="outline" className="zed-glass border-white/10" onClick={() => navigate("/chat")}>
                        <Server size={14} className="mr-1" />
                        Open Chat
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-12">Could not fetch system status.</div>
            )}
          </>
        )}

        {/* ── Ruleset Editor ────────────────────────────────── */}
        {section === "knowledge" && (
          <>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Knowledge System</h2>
              <p className="text-sm text-muted-foreground">
                Inspect active memory layers and run live retrieval across rules, foundation memory, project memory, scratchpad, and semantic recall.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="zed-glass border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Core Memory</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">{knowledgeOverview?.coreCount ?? "—"}</CardContent>
              </Card>
              <Card className="zed-glass border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Project Memory</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">{knowledgeOverview?.projectCount ?? "—"}</CardContent>
              </Card>
              <Card className="zed-glass border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Scratchpad</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">{knowledgeOverview?.scratchpadCount ?? "—"}</CardContent>
              </Card>
            </div>

            <Card className="zed-glass border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database size={16} className="text-cyan-300" />
                  Knowledge Retrieval
                </CardTitle>
                <CardDescription>Search the full knowledge stack from one place.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={knowledgeQuery}
                    onChange={(e) => setKnowledgeQuery(e.target.value)}
                    placeholder="Search knowledge…"
                    className="border-white/10 bg-black/30 text-sm"
                  />
                  <Button onClick={searchKnowledge} disabled={knowledgeLoading}>
                    <RefreshCw size={14} className={`mr-1 ${knowledgeLoading ? "animate-spin" : ""}`} />
                    {knowledgeLoading ? "Searching..." : "Search"}
                  </Button>
                </div>

                {knowledgeResults && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-4">
                      <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                        <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Foundation + Rules</p>
                        <div className="whitespace-pre-wrap text-sm text-foreground/85">
                          {knowledgeResults.foundation || knowledgeResults.core || "No foundation or ruleset matches found."}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                        <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Retrieved Memory</p>
                        <div className="space-y-3 text-sm text-foreground/85">
                          {(knowledgeResults.retrieved || []).length > 0 ? (
                            knowledgeResults.retrieved.map((item: any) => (
                              <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                                <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-cyan-300">{item.source}</div>
                                <div>{item.excerpt}</div>
                              </div>
                            ))
                          ) : (
                            <div className="text-muted-foreground">No retrieved semantic or episodic matches.</div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                        <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Project Memory</p>
                        <div className="space-y-3 text-sm text-foreground/85">
                          {(knowledgeResults.project || []).length > 0 ? (
                            knowledgeResults.project.map((item: any) => (
                              <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                                <div className="mb-1 font-medium">{item.name}</div>
                                {item.description ? <div className="mb-1 text-muted-foreground">{item.description}</div> : null}
                                <div>{item.excerpt}</div>
                              </div>
                            ))
                          ) : (
                            <div className="text-muted-foreground">No project memory matches.</div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/25 p-4">
                        <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Scratchpad Memory</p>
                        <div className="space-y-3 text-sm text-foreground/85">
                          {(knowledgeResults.scratchpad || []).length > 0 ? (
                            knowledgeResults.scratchpad.map((item: any) => (
                              <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                                {item.tags?.length > 0 ? (
                                  <div className="mb-1 text-[11px] uppercase tracking-[0.16em] text-purple-300">{item.tags.join(" • ")}</div>
                                ) : null}
                                <div>{item.excerpt}</div>
                              </div>
                            ))
                          ) : (
                            <div className="text-muted-foreground">No scratchpad matches.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="zed-glass border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Plus size={16} className="text-emerald-300" />
                    Project Memory
                  </CardTitle>
                  <CardDescription>
                    Curate durable business, product, and operating knowledge that ZED should retrieve later.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <LabeledField
                      label="Name"
                      value={projectMemoryDraft.name}
                      onChange={(value) => setProjectMemoryDraft((prev) => ({ ...prev, name: value }))}
                      placeholder="ZWAP Go-To-Market"
                    />
                    <LabeledField
                      label="Type"
                      value={projectMemoryDraft.type}
                      onChange={(value) => setProjectMemoryDraft((prev) => ({ ...prev, type: value }))}
                      placeholder="context"
                    />
                  </div>
                  <label className="space-y-2">
                    <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Description</span>
                    <Textarea
                      rows={3}
                      value={projectMemoryDraft.description}
                      onChange={(e) => setProjectMemoryDraft((prev) => ({ ...prev, description: e.target.value }))}
                      className="zed-glass border-white/10 text-sm"
                      placeholder="Why this knowledge matters"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Content</span>
                    <Textarea
                      rows={8}
                      value={projectMemoryDraft.content}
                      onChange={(e) => setProjectMemoryDraft((prev) => ({ ...prev, content: e.target.value }))}
                      className="zed-glass border-white/10 text-sm"
                      placeholder="Write the durable knowledge ZED should remember"
                    />
                  </label>
                  <ToggleField
                    label="Active"
                    checked={projectMemoryDraft.isActive}
                    onChange={(next) => setProjectMemoryDraft((prev) => ({ ...prev, isActive: next }))}
                    description="Inactive entries remain stored but won’t be prioritized."
                  />
                  <div className="flex items-center gap-3">
                    <Button onClick={saveProjectMemoryItem}>
                      <Save size={14} className="mr-1" />
                      {projectMemorySaveStatus === "saving"
                        ? "Saving..."
                        : projectMemoryDraft.id
                          ? "Update Memory"
                          : "Create Memory"}
                    </Button>
                    {projectMemoryDraft.id ? (
                      <Button
                        variant="outline"
                        className="border-white/10"
                        onClick={() =>
                          setProjectMemoryDraft({
                            id: "",
                            name: "",
                            description: "",
                            content: "",
                            type: "context",
                            isActive: true,
                          })
                        }
                      >
                        Cancel Edit
                      </Button>
                    ) : null}
                    {projectMemorySaveStatus === "error" ? (
                      <span className="text-xs text-red-400">Name and content are required.</span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <Card className="zed-glass border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Edit3 size={16} className="text-purple-300" />
                    Scratchpad Capture
                  </CardTitle>
                  <CardDescription>
                    Store temporary working context that should influence near-term reasoning without becoming permanent canon.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <label className="space-y-2">
                    <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Working Note</span>
                    <Textarea
                      rows={8}
                      value={scratchpadDraft.content}
                      onChange={(e) => setScratchpadDraft((prev) => ({ ...prev, content: e.target.value }))}
                      className="zed-glass border-white/10 text-sm"
                      placeholder="Capture active priorities, temporary facts, or immediate session context"
                    />
                  </label>
                  <LabeledField
                    label="Tags"
                    value={scratchpadDraft.tags}
                    onChange={(value) => setScratchpadDraft((prev) => ({ ...prev, tags: value }))}
                    placeholder="launch, zwap, campaign"
                  />
                  <div className="flex items-center gap-3">
                    <Button onClick={saveScratchpadItem}>
                      <Save size={14} className="mr-1" />
                      {scratchpadSaveStatus === "saving" ? "Saving..." : "Save Scratchpad"}
                    </Button>
                    {scratchpadSaveStatus === "error" ? (
                      <span className="text-xs text-red-400">Scratchpad content is required.</span>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/25 p-4 text-xs leading-5 text-muted-foreground">
                    Scratchpad entries expire automatically and are intended for active work, not permanent foundational knowledge.
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="zed-glass border-white/10">
                <CardHeader>
                  <CardTitle className="text-base">Stored Project Memory</CardTitle>
                  <CardDescription>Edit or remove durable knowledge entries.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {knowledgeAdminLoading ? (
                    <div className="text-sm text-muted-foreground">Loading memory…</div>
                  ) : projectMemoryItems.length > 0 ? (
                    projectMemoryItems.map((item) => (
                      <div key={item.id} className="rounded-xl border border-white/10 bg-black/25 p-4">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.type}
                              {item.description ? ` • ${item.description}` : ""}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-white/10"
                              onClick={() =>
                                setProjectMemoryDraft({
                                  id: item.id,
                                  name: item.name,
                                  description: item.description || "",
                                  content: item.content,
                                  type: item.type || "context",
                                  isActive: item.isActive ?? true,
                                })
                              }
                            >
                              <Edit3 size={12} className="mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-500/20 text-red-300 hover:bg-red-500/10"
                              onClick={() => deleteProjectMemoryItem(item.id)}
                            >
                              <Trash2 size={12} className="mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                        <div className="text-sm text-foreground/85">{item.content}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">No project memory stored yet.</div>
                  )}
                </CardContent>
              </Card>

              <Card className="zed-glass border-white/10">
                <CardHeader>
                  <CardTitle className="text-base">Active Scratchpad</CardTitle>
                  <CardDescription>Temporary working memory currently available for retrieval.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {knowledgeAdminLoading ? (
                    <div className="text-sm text-muted-foreground">Loading scratchpad…</div>
                  ) : scratchpadItems.length > 0 ? (
                    scratchpadItems.map((item) => (
                      <div key={item.id} className="rounded-xl border border-white/10 bg-black/25 p-4">
                        <div className="mb-2 text-xs text-muted-foreground">
                          {item.tags?.length ? item.tags.join(" • ") : "untagged"}
                        </div>
                        <div className="text-sm text-foreground/85">{item.content}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">No scratchpad entries stored yet.</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {section === "integrations" && (
          <>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Integrations</h2>
              <p className="text-sm text-muted-foreground">
                Pick a feature or agent lane first, then work inside that specific section only.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(Object.keys(integrationMeta) as IntegrationKey[]).map((key) => {
                const meta = integrationMeta[key];
                const Icon = meta.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveIntegration(key)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all ${
                      activeIntegration === key
                        ? "border-cyan-400/40 bg-white/10 text-white"
                        : "border-white/10 bg-black/20 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon size={14} className={activeIntegration === key ? "text-cyan-300" : "text-muted-foreground"} />
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>

            {integrationsLoading ? (
              <div className="text-center text-muted-foreground py-12">Loading…</div>
            ) : (
              renderIntegrationPanel()
            )}
          </>
        )}

        {section === "ruleset" && (
          <>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Ruleset</h2>
                <Button variant="ghost" size="sm" onClick={fetchRuleset} className="zed-button text-muted-foreground hover:text-foreground">
                  <RefreshCw size={14} className="mr-1" />
                  Reload
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Choose a rules domain first, then edit only that section below.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {(Object.keys(RULESET_LABELS) as RulesetKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setActiveRulesFile(key)}
                  className={`rounded-xl border px-3 py-2 text-sm transition-all ${
                    activeRulesFile === key
                      ? "border-cyan-400/40 bg-white/10 text-white"
                      : "border-white/10 bg-black/20 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {RULESET_LABELS[key].label}
                </button>
              ))}
            </div>

            <Card className="zed-glass border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText size={16} className="text-cyan-300" />
                  {RULESET_LABELS[activeRulesFile].label}
                </CardTitle>
                <CardDescription>
                  {RULESET_LABELS[activeRulesFile].hint} Editing{" "}
                  <code className="rounded bg-black/30 px-1.5 py-0.5 text-[11px]">{activeRulesFile}</code>. Changes apply to orchestrator behavior after saving.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={16}
                  className="zed-glass border-white/10 font-mono text-xs resize-none"
                  placeholder="YAML content…"
                />
                <div className="flex items-center gap-3">
                  <Button
                    onClick={saveRulesetFile}
                    disabled={saveStatus === "saving"}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    <Save size={14} className="mr-1" />
                    {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved!" : saveStatus === "error" ? "Error — retry" : "Save Changes"}
                  </Button>
                  {saveStatus === "error" && <span className="text-xs text-red-400">Invalid YAML or save failed.</span>}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Approval Queue ────────────────────────────────── */}
        {section === "approvals" && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Approval Queue</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Actions flagged by agents that require your sign-off before execution.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchApprovals} className="zed-button text-muted-foreground hover:text-foreground">
                <RefreshCw size={14} className="mr-1" />
                Refresh
              </Button>
            </div>

            {approvalsLoading ? (
              <div className="text-center text-muted-foreground py-12">Loading…</div>
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
                  <Card
                    key={entry.id}
                    className={`zed-glass border-white/10 ${
                      entry.status === "approved"
                        ? "border-green-500/30"
                        : entry.status === "rejected"
                        ? "border-red-500/20 opacity-60"
                        : "border-yellow-500/30"
                    }`}
                  >
                    <CardContent className="pt-4 pb-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              className={`text-[10px] ${
                                entry.status === "pending"
                                  ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                                  : entry.status === "approved"
                                  ? "bg-green-500/20 text-green-300 border-green-500/30"
                                  : "bg-red-500/20 text-red-300 border-red-500/30"
                              }`}
                            >
                              {entry.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {entry.agent} · {new Date(entry.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-foreground/90 truncate">
                            {entry.message}
                          </p>
                          {entry.draft && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              Draft: {entry.draft}
                            </p>
                          )}
                          {entry.rejectionReason && (
                            <p className="text-xs text-red-400 mt-1">Reason: {entry.rejectionReason}</p>
                          )}
                        </div>
                        {entry.status === "pending" && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button
                              size="sm"
                              onClick={() => resolveApproval(entry.id, "approve")}
                              className="h-8 px-3 bg-green-600/20 hover:bg-green-600/40 text-green-300 border border-green-500/30"
                              variant="outline"
                            >
                              <ThumbsUp size={12} className="mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => resolveApproval(entry.id, "reject")}
                              className="h-8 px-3 bg-red-600/20 hover:bg-red-600/40 text-red-300 border border-red-500/30"
                              variant="outline"
                            >
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

        {/* ── Agent Logs ────────────────────────────────────── */}
        {section === "logs" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Agent Routing Logs</h2>
              <Button variant="ghost" size="sm" onClick={fetchLogs} className="zed-button text-muted-foreground hover:text-foreground">
                <RefreshCw size={14} className="mr-1" />
                Refresh
              </Button>
            </div>

            {logsLoading ? (
              <div className="text-center text-muted-foreground py-12">Loading…</div>
            ) : logs.length === 0 ? (
              <Card className="zed-glass border-white/10">
                <CardContent className="py-12 text-center text-muted-foreground text-sm">
                  No routing logs yet. Send a message in Agent mode to generate entries.
                </CardContent>
              </Card>
            ) : (
              <Card className="zed-glass border-white/10">
                <CardContent className="pt-4">
                  <div className="space-y-1 max-h-[60vh] overflow-y-auto font-mono">
                    {[...logs].reverse().map((entry, i) => {
                      let parsed: any = {};
                      try { parsed = JSON.parse(entry); } catch {}
                      return (
                        <div key={i} className="text-xs px-3 py-2 rounded-lg bg-white/5 border border-white/5">
                          <span className="text-muted-foreground">
                            {parsed.timestamp ? new Date(parsed.timestamp).toLocaleTimeString() : ""}
                          </span>
                          <span className="mx-2 text-purple-400 font-medium">{parsed.agent || "—"}</span>
                          <span className="text-foreground/70">
                            {parsed.conversationId ? `conv:${String(parsed.conversationId).slice(0, 8)}` : ""}
                          </span>
                          {parsed.messageLength && (
                            <span className="ml-2 text-muted-foreground">{parsed.messageLength} chars</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
        {/* ── Security Log ──────────────────────────────────── */}
        {section === "security" && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Security Log</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Auth events, tier blocks, approvals, and audit trail.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchSecurityLog} className="zed-button text-muted-foreground hover:text-foreground">
                <RefreshCw size={14} className="mr-1" />
                Refresh
              </Button>
            </div>

            {securityLoading ? (
              <div className="text-center text-muted-foreground py-12">Loading…</div>
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
                      const isOk = evt.type?.includes("success") || evt.type?.includes("approved") || evt.type?.includes("approved");
                      return (
                        <div key={i} className="text-xs px-3 py-2 rounded-lg bg-white/5 border border-white/5 flex items-start gap-2">
                          <span className="text-muted-foreground shrink-0 w-[70px]">
                            {evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : ""}
                          </span>
                          <span className={`font-medium shrink-0 w-[160px] truncate ${isWarn ? "text-red-400" : isOk ? "text-green-400" : "text-purple-400"}`}>
                            {evt.type || "unknown"}
                          </span>
                          <span className="text-foreground/70 truncate">{evt.detail || ""}</span>
                          {evt.userId && (
                            <span className="text-muted-foreground/50 shrink-0 ml-auto">{evt.userId}</span>
                          )}
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
