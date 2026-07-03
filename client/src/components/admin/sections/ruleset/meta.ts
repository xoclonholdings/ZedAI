import { Sparkles, Shield, SlidersHorizontal, Server } from "lucide-react";

export type RulesetKey =
  | "personality.yaml"
  | "security.yaml"
  | "parameters.yaml"
  | "access.yaml";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type RulesetMap = {
  "personality.yaml": any;
  "security.yaml": any;
  "parameters.yaml": any;
  "access.yaml": any;
};

export const FILE_META: Record<
  RulesetKey,
  {
    label: string;
    description: string;
    icon: typeof Sparkles;
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
    description: "Cloud model endpoint, runtime services, external APIs, filesystem paths, and trust model.",
    icon: Server,
    sections: [
      { key: "ai_host", label: "AI Host", description: "Cloud model endpoint and timeout behavior." },
      { key: "local_services", label: "Runtime Services", description: "Database, vector store, and log store declarations." },
      { key: "external_apis", label: "External APIs", description: "Policy and approved integration inventory." },
      { key: "paths", label: "Paths", description: "Hub roots and storage directories." },
      { key: "trust_model", label: "Trust Model", description: "Current trust mode and multi-user readiness." },
    ],
  },
};

export const DEFAULT_RULESETS: RulesetMap = {
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
    costs: { provider_free_mode: false, external_api_budget_usd: 0, alert_on_external_calls: true },
  },
  "access.yaml": {
    ai_host: { host: "", shared_with_zeta_core: true, timeout_ms: 60000 },
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

export function cloneDefaults(): RulesetMap {
  return JSON.parse(JSON.stringify(DEFAULT_RULESETS));
}

export function mergeDeep<T>(base: T, incoming: any): T {
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

export function parseList(value: string): string[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

export function listValue(value: string[] | undefined): string {
  return (value || []).join("\n");
}

export function sectionTitle(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export type UpdaterFn = (updater: (draft: any) => void) => void;
