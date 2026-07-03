import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { FormInput, FormTextarea, ToggleRow } from "./form-atoms";
import { sectionTitle, type UpdaterFn } from "./meta";

function AgentParameterCard({
  agentKey,
  values,
  update,
}: {
  agentKey: string;
  values: Record<string, any>;
  update: UpdaterFn;
}) {
  return (
    <Card className="border-white/10 bg-black/20">
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
                onCheckedChange={(c) =>
                  update((d) => {
                    d.agent_parameters[agentKey][key] = c;
                  })
                }
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
              onChange={(next) =>
                update((d) => {
                  d.agent_parameters[agentKey][key] = isNumber ? Number(next) || 0 : next;
                })
              }
            />
          );
        })}
      </CardContent>
    </Card>
  );
}

export function ParametersForm({
  file,
  activeSection,
  update,
}: {
  file: any;
  activeSection: string;
  update: UpdaterFn;
}) {
  if (activeSection === "model_selection") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <FormInput label="Primary Model" value={file.model_selection.primary || ""} onChange={(v) => update((d) => { d.model_selection.primary = v; })} />
        <FormInput label="Fallback Model" value={file.model_selection.fallback || ""} onChange={(v) => update((d) => { d.model_selection.fallback = v; })} />
        <FormInput label="Vision Model" value={file.model_selection.vision || ""} onChange={(v) => update((d) => { d.model_selection.vision = v; })} />
        <FormInput label="Embedding Model" value={file.model_selection.embedding || ""} onChange={(v) => update((d) => { d.model_selection.embedding = v; })} />
        <div className="md:col-span-2">
          <FormTextarea label="Selection Strategy" value={file.model_selection.selection_strategy || ""} onChange={(v) => update((d) => { d.model_selection.selection_strategy = v; })} rows={4} />
        </div>
      </div>
    );
  }
  if (activeSection === "generation_defaults") {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormInput label="Temperature" type="number" value={file.generation_defaults.temperature ?? 0} onChange={(v) => update((d) => { d.generation_defaults.temperature = Number(v) || 0; })} />
          <FormInput label="Top P" type="number" value={file.generation_defaults.top_p ?? 0} onChange={(v) => update((d) => { d.generation_defaults.top_p = Number(v) || 0; })} />
          <FormInput label="Max Tokens" type="number" value={file.generation_defaults.max_tokens ?? 0} onChange={(v) => update((d) => { d.generation_defaults.max_tokens = Number(v) || 0; })} />
          <FormInput label="Context Window" type="number" value={file.generation_defaults.context_window ?? 0} onChange={(v) => update((d) => { d.generation_defaults.context_window = Number(v) || 0; })} />
        </div>
        <ToggleRow
          label="Stream Responses"
          checked={!!file.generation_defaults.stream}
          onCheckedChange={(c) => update((d) => { d.generation_defaults.stream = c; })}
          description="Stream token output live instead of waiting for the full completion."
        />
      </div>
    );
  }
  if (activeSection === "agent_parameters") {
    return (
      <div className="space-y-4">
        {Object.entries(file.agent_parameters).map(([key, value]) => (
          <AgentParameterCard
            key={key}
            agentKey={key}
            values={value as Record<string, any>}
            update={update}
          />
        ))}
      </div>
    );
  }
  if (activeSection === "routing") {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormInput label="Orchestrator Timeout Ms" type="number" value={file.routing.orchestrator_timeout_ms ?? 0} onChange={(v) => update((d) => { d.routing.orchestrator_timeout_ms = Number(v) || 0; })} />
          <FormInput label="Routing Log Path" value={file.routing.routing_log_path || ""} onChange={(v) => update((d) => { d.routing.routing_log_path = v; })} />
        </div>
        <ToggleRow
          label="Parallel Agents"
          checked={!!file.routing.parallel_agents}
          onCheckedChange={(c) => update((d) => { d.routing.parallel_agents = c; })}
          description="Allow multiple agents to work in parallel when orchestration decides it is useful."
        />
        <ToggleRow
          label="Log Routing Decisions"
          checked={!!file.routing.log_routing_decisions}
          onCheckedChange={(c) => update((d) => { d.routing.log_routing_decisions = c; })}
          description="Persist route-selection traces for debugging and operator review."
        />
      </div>
    );
  }
  if (activeSection === "memory") {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FormInput label="Working Memory Max Entries" type="number" value={file.memory.working_memory_max_entries ?? 0} onChange={(v) => update((d) => { d.memory.working_memory_max_entries = Number(v) || 0; })} />
        <FormInput label="Episodic Max Entries" type="number" value={file.memory.episodic_max_entries ?? 0} onChange={(v) => update((d) => { d.memory.episodic_max_entries = Number(v) || 0; })} />
        <FormInput label="Semantic Store Max MB" type="number" value={file.memory.semantic_store_max_mb ?? 0} onChange={(v) => update((d) => { d.memory.semantic_store_max_mb = Number(v) || 0; })} />
        <FormInput label="Context Injection Max Chars" type="number" value={file.memory.context_injection_max_chars ?? 0} onChange={(v) => update((d) => { d.memory.context_injection_max_chars = Number(v) || 0; })} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <FormInput label="External API Budget USD" type="number" value={file.costs.external_api_budget_usd ?? 0} onChange={(v) => update((d) => { d.costs.external_api_budget_usd = Number(v) || 0; })} />
      <ToggleRow
        label="Provider Free Mode"
        checked={!!file.costs.provider_free_mode}
        onCheckedChange={(c) => update((d) => { d.costs.provider_free_mode = c; })}
        description="Only enable this when the active provider is contractually unmetered."
      />
      <ToggleRow
        label="Alert On External Calls"
        checked={!!file.costs.alert_on_external_calls}
        onCheckedChange={(c) => update((d) => { d.costs.alert_on_external_calls = c; })}
        description="Raise visibility when agent behavior would use external paid or metered APIs."
      />
    </div>
  );
}
