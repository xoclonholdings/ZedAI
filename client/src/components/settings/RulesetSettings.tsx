import { useEffect, useMemo, useState } from "react";
import {
  Brain,
  Lock,
  RefreshCw,
  Router,
  Save,
  Server,
  Shield,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type RulesetKey = "personality.yaml" | "security.yaml" | "parameters.yaml" | "access.yaml";
type SaveStatus = "idle" | "saving" | "saved" | "error";

type RulesetMap = {
  "personality.yaml": any;
  "security.yaml": any;
  "parameters.yaml": any;
  "access.yaml": any;
};

const FILE_META: Record<
  RulesetKey,
  {
    label: string;
    description: string;
    icon: typeof Brain;
    sections: Array<{ key: string; label: string; description: string }>;
  }
> = {
  "personality.yaml": {
    label: "Personality",
    description: "Identity, tone, persona, and response behavior for ZED.",
    icon: Sparkles,
    sections: [
      { key: "identity", label: "Identity", description: "Name, title, version, and role." },
      { key: "voice", label: "Voice", description: "Tone, register, style, and prohibited patterns." },
      { key: "persona", label: "Persona", description: "Perspective, memory use, uncertainty, and boundaries." },
      { key: "response_format", label: "Response Format", description: "Formatting defaults and response-length rules." },
      { key: "decision_rules", label: "Decision Rules", description: "Action bias, clarification thresholds, and proactivity." },
    ],
  },
  "security.yaml": {
    label: "Security",
    description: "Authentication rules, permission tiers, approvals, and audit controls.",
    icon: Shield,
    sections: [
      { key: "authentication", label: "Authentication", description: "Passphrase mode and rate limiting." },
      { key: "permission_tiers", label: "Permission Tiers", description: "Blocked, auto-approved, approval-required, and never-allowed actions." },
      { key: "approval_gates", label: "Approval Gates", description: "Queue settings and approval expiration." },
      { key: "sensitive_topics", label: "Sensitive Topics", description: "Extra-care topics that need stricter handling." },
      { key: "audit_log", label: "Audit Log", description: "Security logging destinations and behavior." },
    ],
  },
  "parameters.yaml": {
    label: "Parameters",
    description: "Model defaults, generation tuning, agent parameters, routing, and memory sizing.",
    icon: SlidersHorizontal,
    sections: [
      { key: "model_selection", label: "Model Selection", description: "Primary, fallback, vision, and embedding model choice." },
      { key: "generation_defaults", label: "Generation Defaults", description: "Temperature, top-p, context window, and streaming." },
      { key: "agent_parameters", label: "Agent Parameters", description: "Per-agent temperatures, token budgets, and status." },
      { key: "routing", label: "Routing", description: "Orchestrator timeout and routing-policy behavior." },
      { key: "memory", label: "Memory Limits", description: "Working, episodic, semantic, and context injection budgets." },
      { key: "costs", label: "Costs", description: "Budget guardrails and external API alerts." },
    ],
  },
  "access.yaml": {
    label: "Access",
    description: "Model host, local services, external APIs, filesystem paths, and trust model.",
    icon: Server,
    sections: [
      { key: "ollama", label: "AI Host", description: "Remote/local model host and timeout behavior." },
      { key: "local_services", label: "Local Services", description: "Database, vector store, and log store declarations." },
      { key: "external_apis", label: "External APIs", description: "Policy and approved integration inventory." },
      { key: "paths", label: "Paths", description: "Hub roots and storage directories." },
      { key: "trust_model", label: "Trust Model", description: "Current trust mode and multi-user readiness." },
    ],
  },
};

const DEFAULT_RULESETS: RulesetMap = {
  "personality.yaml": {
    identity: { name: "", full_name: "", version: "", tagline: "", role: "" },
    voice: { tone: "", register: "", style: "", prohibited: [] },
    persona: { perspective: "", memory_use: "", uncertainty: "", boundaries: "" },
    response_format: { default: "", code: "", lists: "", max_default_length: 600, expand_trigger: "" },
    decision_rules: { prefer_action: true, ask_clarification: "", show_reasoning: "", proactive: "" },
  },
  "security.yaml": {
    authentication: {
      mode: "",
      passphrase_key: "",
      default_passphrase: "",
      rate_limit: { max_attempts: 3, lockout_minutes: 15, window_minutes: 5 },
    },
    permission_tiers: {
      tier_0_blocked: { description: "", actions: [] },
      tier_1_auto_approved: { description: "", actions: [] },
      tier_2_admin_approval: { description: "", actions: [] },
      tier_3_never: { description: "", actions: [] },
    },
    approval_gates: { queue_path: "", notify_on_queue: true, auto_expire_hours: 24 },
    sensitive_topics: { require_extra_care: [] },
    audit_log: { path: "", log_all_requests: false, log_approval_events: true, log_auth_events: true },
  },
  "parameters.yaml": {
    model_selection: { primary: "", fallback: "", vision: "", embedding: "", selection_strategy: "" },
    generation_defaults: { temperature: 0.7, top_p: 0.9, max_tokens: 2048, stream: true, context_window: 8192 },
    agent_parameters: {
      operations: { temperature: 0.6, max_tokens: 1500, tool_timeout_ms: 10000 },
      intelligence: {
        temperature: 0.3,
        max_tokens: 2000,
        research_depth_default: "",
        deep_research_threshold: "",
      },
      ide_operator: { status: "STUBBED", temperature: 0.2, max_tokens: 4000 },
      audio_engineer: { status: "STUBBED", temperature: 0.5, max_tokens: 1000 },
    },
    routing: { orchestrator_timeout_ms: 30000, parallel_agents: false, log_routing_decisions: true, routing_log_path: "" },
    memory: { working_memory_max_entries: 50, episodic_max_entries: 500, semantic_store_max_mb: 100, context_injection_max_chars: 3000 },
    costs: { ollama_is_free: true, external_api_budget_usd: 0, alert_on_external_calls: true },
  },
  "access.yaml": {
    ollama: { host: "", shared_with_zeta_core: true, timeout_ms: 60000 },
    local_services: { database: "", vector_store: "", log_store: "" },
    external_apis: {
      policy: "",
      approved_free_tier: { search: [], github: [], firewall: [] },
    },
    paths: {
      hub_root: "",
      config: "",
      memory_working: "",
      memory_episodic: "",
      memory_semantic: "",
      memory_consensus: "",
      templates: "",
      logs: "",
    },
    trust_model: { current_mode: "", multi_user_ready: false, multi_user_stub: "" },
  },
};

function cloneDefaults(): RulesetMap {
  return JSON.parse(JSON.stringify(DEFAULT_RULESETS));
}

function mergeDeep<T>(base: T, incoming: any): T {
  if (Array.isArray(base)) return (Array.isArray(incoming) ? incoming : base) as T;
  if (base && typeof base === "object") {
    const result: any = { ...(base as any) };
    for (const key of Object.keys(result)) {
      if (incoming && Object.prototype.hasOwnProperty.call(incoming, key)) {
        result[key] = mergeDeep(result[key], incoming[key]);
      }
    }
    if (incoming && typeof incoming === "object") {
      for (const [key, value] of Object.entries(incoming)) {
        if (!Object.prototype.hasOwnProperty.call(result, key)) result[key] = value;
      }
    }
    return result;
  }
  return (incoming ?? base) as T;
}

function parseList(value: string): string[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function listValue(value: string[] | undefined): string {
  return (value || []).join("\n");
}

function sectionTitle(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <Input
        type={type}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="border-white/10 bg-black/30 text-sm"
      />
    </label>
  );
}

function FormTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 5,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <Textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="zed-glass border-white/10 text-sm"
      />
      {hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
    </label>
  );
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
  description,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="space-y-1 pr-4">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs leading-5 text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SectionButton({
  active,
  label,
  description,
  onClick,
}: {
  active: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border px-4 py-3 text-left transition-all",
        active ? "border-cyan-400/35 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.08)]" : "border-white/10 bg-black/25 hover:border-white/20 hover:bg-black/35",
      ].join(" ")}
    >
      <div className="space-y-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs leading-5 text-muted-foreground">{description}</div>
      </div>
    </button>
  );
}

export default function RulesetSettings() {
  const [rulesets, setRulesets] = useState<RulesetMap>(cloneDefaults());
  const [activeFile, setActiveFile] = useState<RulesetKey>("personality.yaml");
  const [activeSection, setActiveSection] = useState("identity");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [parseIssues, setParseIssues] = useState<string[]>([]);

  const currentMeta = FILE_META[activeFile];
  const currentSectionMeta = currentMeta.sections.find((section) => section.key === activeSection) || currentMeta.sections[0];
  const currentRules = rulesets[activeFile];

  useEffect(() => {
    void loadRulesets();
  }, []);

  useEffect(() => {
    setActiveSection(FILE_META[activeFile].sections[0].key);
    setSaveStatus("idle");
  }, [activeFile]);

  async function loadRulesets() {
    setLoading(true);
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/ruleset/structured", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load ruleset");
      const raw = await res.json();
      const merged = cloneDefaults();
      const issues: string[] = [];

      (Object.keys(FILE_META) as RulesetKey[]).forEach((file) => {
        try {
          merged[file] = mergeDeep(merged[file], raw[file] || {});
        } catch (error: any) {
          issues.push(`${FILE_META[file].label}: ${error.message || "invalid YAML"}`);
        }
      });

      setRulesets(merged);
      setParseIssues(issues);
    } catch (error: any) {
      setParseIssues([error.message || "Failed to load ruleset"]);
    }
    setLoading(false);
    setRefreshing(false);
  }

  function updateCurrentFile(updater: (draft: any) => void) {
    setRulesets((prev) => {
      const next = cloneDefaults();
      Object.assign(next, prev);
      const current = JSON.parse(JSON.stringify(prev[activeFile]));
      updater(current);
      next[activeFile] = current;
      return next;
    });
    setSaveStatus("idle");
  }

  async function saveActiveFile() {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/admin/ruleset/structured", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ filename: activeFile, content: rulesets[activeFile] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1800);
    } catch {
      setSaveStatus("error");
    }
  }

  const externalApisPreview = useMemo(() => {
    const apis = (rulesets["access.yaml"].external_apis?.approved_free_tier || {}) as Record<string, any[]>;
    return Object.entries(apis).map(([group, items]) => ({
      group,
      items: (items || []).map((item) => ({
        ...item,
        permissions: item.permissions || "",
      })),
    }));
  }, [rulesets]);

  function renderPersonalitySection() {
    const file = currentRules;
    if (activeSection === "identity") {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <FormInput label="Name" value={file.identity.name || ""} onChange={(value) => updateCurrentFile((draft) => { draft.identity.name = value; })} />
          <FormInput label="Full Name" value={file.identity.full_name || ""} onChange={(value) => updateCurrentFile((draft) => { draft.identity.full_name = value; })} />
          <FormInput label="Version" value={file.identity.version || ""} onChange={(value) => updateCurrentFile((draft) => { draft.identity.version = value; })} />
          <FormInput label="Tagline" value={file.identity.tagline || ""} onChange={(value) => updateCurrentFile((draft) => { draft.identity.tagline = value; })} />
          <div className="md:col-span-2">
            <FormTextarea label="Role" value={file.identity.role || ""} onChange={(value) => updateCurrentFile((draft) => { draft.identity.role = value; })} rows={4} />
          </div>
        </div>
      );
    }
    if (activeSection === "voice") {
      return (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormTextarea label="Tone" value={file.voice.tone || ""} onChange={(value) => updateCurrentFile((draft) => { draft.voice.tone = value; })} rows={4} />
            <FormTextarea label="Register" value={file.voice.register || ""} onChange={(value) => updateCurrentFile((draft) => { draft.voice.register = value; })} rows={4} />
          </div>
          <FormTextarea label="Style" value={file.voice.style || ""} onChange={(value) => updateCurrentFile((draft) => { draft.voice.style = value; })} rows={4} />
          <FormTextarea
            label="Prohibited Phrases & Behaviors"
            value={listValue(file.voice.prohibited)}
            onChange={(value) => updateCurrentFile((draft) => { draft.voice.prohibited = parseList(value); })}
            rows={6}
            hint="One prohibited phrase or pattern per line."
          />
        </div>
      );
    }
    if (activeSection === "persona") {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <FormTextarea label="Perspective" value={file.persona.perspective || ""} onChange={(value) => updateCurrentFile((draft) => { draft.persona.perspective = value; })} rows={4} />
          <FormTextarea label="Memory Use" value={file.persona.memory_use || ""} onChange={(value) => updateCurrentFile((draft) => { draft.persona.memory_use = value; })} rows={4} />
          <FormTextarea label="Uncertainty Handling" value={file.persona.uncertainty || ""} onChange={(value) => updateCurrentFile((draft) => { draft.persona.uncertainty = value; })} rows={4} />
          <FormTextarea label="Boundaries" value={file.persona.boundaries || ""} onChange={(value) => updateCurrentFile((draft) => { draft.persona.boundaries = value; })} rows={4} />
        </div>
      );
    }
    if (activeSection === "response_format") {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <FormTextarea label="Default Format" value={file.response_format.default || ""} onChange={(value) => updateCurrentFile((draft) => { draft.response_format.default = value; })} rows={4} />
          <FormTextarea label="Code Output" value={file.response_format.code || ""} onChange={(value) => updateCurrentFile((draft) => { draft.response_format.code = value; })} rows={4} />
          <FormTextarea label="List Behavior" value={file.response_format.lists || ""} onChange={(value) => updateCurrentFile((draft) => { draft.response_format.lists = value; })} rows={4} />
          <FormInput label="Max Default Length" type="number" value={file.response_format.max_default_length ?? 600} onChange={(value) => updateCurrentFile((draft) => { draft.response_format.max_default_length = Number(value) || 0; })} />
          <div className="md:col-span-2">
            <FormTextarea label="Expand Trigger" value={file.response_format.expand_trigger || ""} onChange={(value) => updateCurrentFile((draft) => { draft.response_format.expand_trigger = value; })} rows={4} />
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <ToggleRow
          label="Prefer Action"
          checked={!!file.decision_rules.prefer_action}
          onCheckedChange={(checked) => updateCurrentFile((draft) => { draft.decision_rules.prefer_action = checked; })}
          description="Bias ZED toward taking the next useful step instead of over-explaining."
        />
        <div className="grid gap-4 md:grid-cols-2">
          <FormTextarea label="Ask Clarification" value={file.decision_rules.ask_clarification || ""} onChange={(value) => updateCurrentFile((draft) => { draft.decision_rules.ask_clarification = value; })} rows={4} />
          <FormTextarea label="Show Reasoning" value={file.decision_rules.show_reasoning || ""} onChange={(value) => updateCurrentFile((draft) => { draft.decision_rules.show_reasoning = value; })} rows={4} />
          <div className="md:col-span-2">
            <FormTextarea label="Proactive Context" value={file.decision_rules.proactive || ""} onChange={(value) => updateCurrentFile((draft) => { draft.decision_rules.proactive = value; })} rows={4} />
          </div>
        </div>
      </div>
    );
  }

  function renderPermissionTierEditor(file: any) {
    const tiers = [
      { key: "tier_0_blocked", label: "Tier 0 Blocked" },
      { key: "tier_1_auto_approved", label: "Tier 1 Auto Approved" },
      { key: "tier_2_admin_approval", label: "Tier 2 Admin Approval" },
      { key: "tier_3_never", label: "Tier 3 Never" },
    ] as const;

    return (
      <div className="space-y-4">
        {tiers.map((tier) => (
          <Card key={tier.key} className="border-white/10 bg-black/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{tier.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormTextarea
                label="Description"
                value={file.permission_tiers[tier.key]?.description || ""}
                onChange={(value) => updateCurrentFile((draft) => { draft.permission_tiers[tier.key].description = value; })}
                rows={3}
              />
              <FormTextarea
                label="Actions"
                value={listValue(file.permission_tiers[tier.key]?.actions)}
                onChange={(value) => updateCurrentFile((draft) => { draft.permission_tiers[tier.key].actions = parseList(value); })}
                rows={6}
                hint="One action or policy item per line."
              />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  function renderSecuritySection() {
    const file = currentRules;
    if (activeSection === "authentication") {
      return (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput label="Mode" value={file.authentication.mode || ""} onChange={(value) => updateCurrentFile((draft) => { draft.authentication.mode = value; })} />
            <FormInput label="Passphrase Env Key" value={file.authentication.passphrase_key || ""} onChange={(value) => updateCurrentFile((draft) => { draft.authentication.passphrase_key = value; })} />
            <div className="md:col-span-2">
              <FormInput label="Default Passphrase" value={file.authentication.default_passphrase || ""} onChange={(value) => updateCurrentFile((draft) => { draft.authentication.default_passphrase = value; })} />
            </div>
          </div>
          <Card className="border-white/10 bg-black/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Rate Limit</CardTitle>
              <CardDescription>Control lockout protection around login attempts.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <FormInput label="Max Attempts" type="number" value={file.authentication.rate_limit?.max_attempts ?? 0} onChange={(value) => updateCurrentFile((draft) => { draft.authentication.rate_limit.max_attempts = Number(value) || 0; })} />
              <FormInput label="Lockout Minutes" type="number" value={file.authentication.rate_limit?.lockout_minutes ?? 0} onChange={(value) => updateCurrentFile((draft) => { draft.authentication.rate_limit.lockout_minutes = Number(value) || 0; })} />
              <FormInput label="Window Minutes" type="number" value={file.authentication.rate_limit?.window_minutes ?? 0} onChange={(value) => updateCurrentFile((draft) => { draft.authentication.rate_limit.window_minutes = Number(value) || 0; })} />
            </CardContent>
          </Card>
        </div>
      );
    }
    if (activeSection === "permission_tiers") return renderPermissionTierEditor(file);
    if (activeSection === "approval_gates") {
      return (
        <div className="space-y-4">
          <FormInput label="Queue Path" value={file.approval_gates.queue_path || ""} onChange={(value) => updateCurrentFile((draft) => { draft.approval_gates.queue_path = value; })} />
          <FormInput label="Auto Expire Hours" type="number" value={file.approval_gates.auto_expire_hours ?? 24} onChange={(value) => updateCurrentFile((draft) => { draft.approval_gates.auto_expire_hours = Number(value) || 0; })} />
          <ToggleRow
            label="Notify On Queue"
            checked={!!file.approval_gates.notify_on_queue}
            onCheckedChange={(checked) => updateCurrentFile((draft) => { draft.approval_gates.notify_on_queue = checked; })}
            description="Raise a visible signal whenever a new approval item enters the queue."
          />
        </div>
      );
    }
    if (activeSection === "sensitive_topics") {
      return (
        <FormTextarea
          label="Require Extra Care"
          value={listValue(file.sensitive_topics.require_extra_care)}
          onChange={(value) => updateCurrentFile((draft) => { draft.sensitive_topics.require_extra_care = parseList(value); })}
          rows={10}
          hint="One sensitive topic policy per line."
        />
      );
    }
    return (
      <div className="space-y-4">
        <FormInput label="Log Path" value={file.audit_log.path || ""} onChange={(value) => updateCurrentFile((draft) => { draft.audit_log.path = value; })} />
        <ToggleRow
          label="Log All Requests"
          checked={!!file.audit_log.log_all_requests}
          onCheckedChange={(checked) => updateCurrentFile((draft) => { draft.audit_log.log_all_requests = checked; })}
          description="Capture every request in the audit log instead of only key security events."
        />
        <ToggleRow
          label="Log Approval Events"
          checked={!!file.audit_log.log_approval_events}
          onCheckedChange={(checked) => updateCurrentFile((draft) => { draft.audit_log.log_approval_events = checked; })}
          description="Track approval queue creation, approvals, and rejections."
        />
        <ToggleRow
          label="Log Auth Events"
          checked={!!file.audit_log.log_auth_events}
          onCheckedChange={(checked) => updateCurrentFile((draft) => { draft.audit_log.log_auth_events = checked; })}
          description="Track login successes, failures, and auth-related blocks."
        />
      </div>
    );
  }

  function renderAgentParameterCard(agentKey: string, values: Record<string, any>) {
    return (
      <Card key={agentKey} className="border-white/10 bg-black/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{sectionTitle(agentKey)}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {Object.entries(values).map(([key, value]) => {
            const label = sectionTitle(key);
            if (typeof value === "boolean") {
              return (
                <ToggleRow
                  key={key}
                  label={label}
                  checked={value}
                  onCheckedChange={(checked) => updateCurrentFile((draft) => { draft.agent_parameters[agentKey][key] = checked; })}
                  description={`Toggle ${label.toLowerCase()} for ${sectionTitle(agentKey)}.`}
                />
              );
            }
            const isNumber = typeof value === "number";
            return (
              <FormInput
                key={key}
                label={label}
                type={isNumber ? "number" : "text"}
                value={value}
                onChange={(next) => updateCurrentFile((draft) => { draft.agent_parameters[agentKey][key] = isNumber ? Number(next) || 0 : next; })}
              />
            );
          })}
        </CardContent>
      </Card>
    );
  }

  function renderParametersSection() {
    const file = currentRules;
    if (activeSection === "model_selection") {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <FormInput label="Primary Model" value={file.model_selection.primary || ""} onChange={(value) => updateCurrentFile((draft) => { draft.model_selection.primary = value; })} />
          <FormInput label="Fallback Model" value={file.model_selection.fallback || ""} onChange={(value) => updateCurrentFile((draft) => { draft.model_selection.fallback = value; })} />
          <FormInput label="Vision Model" value={file.model_selection.vision || ""} onChange={(value) => updateCurrentFile((draft) => { draft.model_selection.vision = value; })} />
          <FormInput label="Embedding Model" value={file.model_selection.embedding || ""} onChange={(value) => updateCurrentFile((draft) => { draft.model_selection.embedding = value; })} />
          <div className="md:col-span-2">
            <FormTextarea label="Selection Strategy" value={file.model_selection.selection_strategy || ""} onChange={(value) => updateCurrentFile((draft) => { draft.model_selection.selection_strategy = value; })} rows={4} />
          </div>
        </div>
      );
    }
    if (activeSection === "generation_defaults") {
      return (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FormInput label="Temperature" type="number" value={file.generation_defaults.temperature ?? 0} onChange={(value) => updateCurrentFile((draft) => { draft.generation_defaults.temperature = Number(value) || 0; })} />
            <FormInput label="Top P" type="number" value={file.generation_defaults.top_p ?? 0} onChange={(value) => updateCurrentFile((draft) => { draft.generation_defaults.top_p = Number(value) || 0; })} />
            <FormInput label="Max Tokens" type="number" value={file.generation_defaults.max_tokens ?? 0} onChange={(value) => updateCurrentFile((draft) => { draft.generation_defaults.max_tokens = Number(value) || 0; })} />
            <FormInput label="Context Window" type="number" value={file.generation_defaults.context_window ?? 0} onChange={(value) => updateCurrentFile((draft) => { draft.generation_defaults.context_window = Number(value) || 0; })} />
          </div>
          <ToggleRow
            label="Stream Responses"
            checked={!!file.generation_defaults.stream}
            onCheckedChange={(checked) => updateCurrentFile((draft) => { draft.generation_defaults.stream = checked; })}
            description="Stream token output live instead of waiting for the full completion."
          />
        </div>
      );
    }
    if (activeSection === "agent_parameters") {
      return <div className="space-y-4">{Object.entries(file.agent_parameters).map(([key, value]) => renderAgentParameterCard(key, value as Record<string, any>))}</div>;
    }
    if (activeSection === "routing") {
      return (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput label="Orchestrator Timeout Ms" type="number" value={file.routing.orchestrator_timeout_ms ?? 0} onChange={(value) => updateCurrentFile((draft) => { draft.routing.orchestrator_timeout_ms = Number(value) || 0; })} />
            <FormInput label="Routing Log Path" value={file.routing.routing_log_path || ""} onChange={(value) => updateCurrentFile((draft) => { draft.routing.routing_log_path = value; })} />
          </div>
          <ToggleRow
            label="Parallel Agents"
            checked={!!file.routing.parallel_agents}
            onCheckedChange={(checked) => updateCurrentFile((draft) => { draft.routing.parallel_agents = checked; })}
            description="Allow multiple agents to work in parallel when orchestration decides it is useful."
          />
          <ToggleRow
            label="Log Routing Decisions"
            checked={!!file.routing.log_routing_decisions}
            onCheckedChange={(checked) => updateCurrentFile((draft) => { draft.routing.log_routing_decisions = checked; })}
            description="Persist route-selection traces for debugging and operator review."
          />
        </div>
      );
    }
    if (activeSection === "memory") {
      return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormInput label="Working Memory Max Entries" type="number" value={file.memory.working_memory_max_entries ?? 0} onChange={(value) => updateCurrentFile((draft) => { draft.memory.working_memory_max_entries = Number(value) || 0; })} />
          <FormInput label="Episodic Max Entries" type="number" value={file.memory.episodic_max_entries ?? 0} onChange={(value) => updateCurrentFile((draft) => { draft.memory.episodic_max_entries = Number(value) || 0; })} />
          <FormInput label="Semantic Store Max MB" type="number" value={file.memory.semantic_store_max_mb ?? 0} onChange={(value) => updateCurrentFile((draft) => { draft.memory.semantic_store_max_mb = Number(value) || 0; })} />
          <FormInput label="Context Injection Max Chars" type="number" value={file.memory.context_injection_max_chars ?? 0} onChange={(value) => updateCurrentFile((draft) => { draft.memory.context_injection_max_chars = Number(value) || 0; })} />
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <FormInput label="External API Budget USD" type="number" value={file.costs.external_api_budget_usd ?? 0} onChange={(value) => updateCurrentFile((draft) => { draft.costs.external_api_budget_usd = Number(value) || 0; })} />
        <ToggleRow
          label="Ollama Is Free"
          checked={!!file.costs.ollama_is_free}
          onCheckedChange={(checked) => updateCurrentFile((draft) => { draft.costs.ollama_is_free = checked; })}
          description="Treat the default local/open model lane as zero-cost in budget logic."
        />
        <ToggleRow
          label="Alert On External Calls"
          checked={!!file.costs.alert_on_external_calls}
          onCheckedChange={(checked) => updateCurrentFile((draft) => { draft.costs.alert_on_external_calls = checked; })}
          description="Raise visibility when agent behavior would use external paid or metered APIs."
        />
      </div>
    );
  }

  function updateExternalApi(group: string, index: number, key: string, value: string) {
    updateCurrentFile((draft) => {
      if (!draft.external_apis.approved_free_tier[group]) draft.external_apis.approved_free_tier[group] = [];
      draft.external_apis.approved_free_tier[group][index][key] = value;
    });
  }

  function renderAccessSection() {
    const file = currentRules;
    if (activeSection === "ollama") {
      return (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput label="Host" value={file.ollama.host || ""} onChange={(value) => updateCurrentFile((draft) => { draft.ollama.host = value; })} />
            <FormInput label="Timeout Ms" type="number" value={file.ollama.timeout_ms ?? 0} onChange={(value) => updateCurrentFile((draft) => { draft.ollama.timeout_ms = Number(value) || 0; })} />
          </div>
          <ToggleRow
            label="Shared With Zeta Core"
            checked={!!file.ollama.shared_with_zeta_core}
            onCheckedChange={(checked) => updateCurrentFile((draft) => { draft.ollama.shared_with_zeta_core = checked; })}
            description="Indicates whether the model host is shared with the wider Zeta Core environment."
          />
        </div>
      );
    }
    if (activeSection === "local_services") {
      return (
        <div className="grid gap-4 md:grid-cols-3">
          <FormTextarea label="Database" value={file.local_services.database || ""} onChange={(value) => updateCurrentFile((draft) => { draft.local_services.database = value; })} rows={4} />
          <FormTextarea label="Vector Store" value={file.local_services.vector_store || ""} onChange={(value) => updateCurrentFile((draft) => { draft.local_services.vector_store = value; })} rows={4} />
          <FormTextarea label="Log Store" value={file.local_services.log_store || ""} onChange={(value) => updateCurrentFile((draft) => { draft.local_services.log_store = value; })} rows={4} />
        </div>
      );
    }
    if (activeSection === "external_apis") {
      return (
        <div className="space-y-4">
          <FormTextarea label="Policy" value={file.external_apis.policy || ""} onChange={(value) => updateCurrentFile((draft) => { draft.external_apis.policy = value; })} rows={3} />
          {externalApisPreview.map(({ group, items }) => (
            <Card key={group} className="border-white/10 bg-black/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{sectionTitle(group)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.length > 0 ? items.map((item, index) => (
                  <div key={`${group}-${index}`} className="grid gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 md:grid-cols-2 xl:grid-cols-4">
                    <FormInput label="Name" value={item.name || ""} onChange={(value) => updateExternalApi(group, index, "name", value)} />
                    <FormInput label="Env Key" value={item.env_key || ""} onChange={(value) => updateExternalApi(group, index, "env_key", value)} />
                    <FormInput label="Status" value={item.status || ""} onChange={(value) => updateExternalApi(group, index, "status", value)} />
                    <FormInput label="Permissions" value={item.permissions || ""} onChange={(value) => updateExternalApi(group, index, "permissions", value)} />
                  </div>
                )) : (
                  <div className="text-sm text-muted-foreground">No approved integrations listed for this group.</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }
    if (activeSection === "paths") {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(file.paths).map(([key, value]) => (
            <FormInput key={key} label={sectionTitle(key)} value={String(value ?? "")} onChange={(next) => updateCurrentFile((draft) => { draft.paths[key] = next; })} />
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <FormInput label="Current Mode" value={file.trust_model.current_mode || ""} onChange={(value) => updateCurrentFile((draft) => { draft.trust_model.current_mode = value; })} />
        <ToggleRow
          label="Multi User Ready"
          checked={!!file.trust_model.multi_user_ready}
          onCheckedChange={(checked) => updateCurrentFile((draft) => { draft.trust_model.multi_user_ready = checked; })}
          description="Indicates whether the current trust model is ready for true multi-user operation."
        />
        <FormTextarea label="Multi User Stub" value={file.trust_model.multi_user_stub || ""} onChange={(value) => updateCurrentFile((draft) => { draft.trust_model.multi_user_stub = value; })} rows={4} />
      </div>
    );
  }

  function renderSectionForm() {
    if (activeFile === "personality.yaml") return renderPersonalitySection();
    if (activeFile === "security.yaml") return renderSecuritySection();
    if (activeFile === "parameters.yaml") return renderParametersSection();
    return renderAccessSection();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Ruleset Control Center</h2>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Edit each rules domain through structured controls instead of raw YAML. Pick a rules file first, then work inside a single focused section with fields that match the real config shape.
          </p>
        </div>
        <Button variant="outline" className="border-white/10" onClick={loadRulesets} disabled={refreshing}>
          <RefreshCw size={14} className={`mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Reload Ruleset
        </Button>
      </div>

      {parseIssues.length > 0 ? (
        <Card className="border-amber-400/20 bg-amber-400/5">
          <CardContent className="pt-4 text-sm text-amber-100">
            <div className="mb-2 font-medium">Some rules files could not be parsed cleanly.</div>
            <ul className="space-y-1 text-xs text-amber-200/80">
              {parseIssues.map((issue) => (
                <li key={issue}>- {issue}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(FILE_META) as RulesetKey[]).map((key) => {
          const meta = FILE_META[key];
          const Icon = meta.icon;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveFile(key)}
              className={[
                "rounded-2xl border px-4 py-4 text-left transition-all",
                activeFile === key ? "border-cyan-400/35 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,0.08)]" : "border-white/10 bg-black/25 hover:border-white/20 hover:bg-black/35",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-white/10 bg-black/40 p-2">
                  <Icon size={15} className={activeFile === key ? "text-cyan-300" : "text-foreground/70"} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{meta.label}</span>
                    {activeFile === key ? <Badge variant="outline" className="border-cyan-400/30 text-cyan-300">Active</Badge> : null}
                  </div>
                  <div className="text-xs leading-5 text-muted-foreground">{meta.description}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.34fr_0.66fr]">
        <Card className="zed-glass border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Router size={16} className="text-cyan-300" />
              {currentMeta.label} Sections
            </CardTitle>
            <CardDescription>Choose the exact section you want to configure. Each section opens as a focused form instead of a raw document.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentMeta.sections.map((section) => (
              <SectionButton
                key={section.key}
                active={activeSection === section.key}
                label={section.label}
                description={section.description}
                onClick={() => setActiveSection(section.key)}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="zed-glass border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock size={16} className="text-purple-300" />
              {currentSectionMeta.label}
            </CardTitle>
            <CardDescription>
              {currentSectionMeta.description} This saves back into{" "}
              <code className="rounded bg-black/30 px-1.5 py-0.5 text-[11px]">{activeFile}</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="py-10 text-sm text-muted-foreground">Loading structured ruleset controls...</div>
            ) : (
              <>
                {renderSectionForm()}
                <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
                  <Button onClick={saveActiveFile} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                    <Save size={14} className="mr-2" />
                    {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved!" : saveStatus === "error" ? "Save Failed" : `Save ${currentMeta.label}`}
                  </Button>
                  {saveStatus === "error" ? <span className="text-xs text-red-400">Could not save this rules file. Check field values and try again.</span> : null}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
