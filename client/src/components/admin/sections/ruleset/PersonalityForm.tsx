import { FormInput, FormTextarea, ToggleRow } from "./form-atoms";
import { listValue, parseList, type UpdaterFn } from "./meta";

export function PersonalityForm({
  file,
  activeSection,
  update,
}: {
  file: any;
  activeSection: string;
  update: UpdaterFn;
}) {
  if (activeSection === "identity") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <FormInput label="Name" value={file.identity.name || ""} onChange={(v) => update((d) => { d.identity.name = v; })} />
        <FormInput label="Full Name" value={file.identity.full_name || ""} onChange={(v) => update((d) => { d.identity.full_name = v; })} />
        <FormInput label="Version" value={file.identity.version || ""} onChange={(v) => update((d) => { d.identity.version = v; })} />
        <FormInput label="Tagline" value={file.identity.tagline || ""} onChange={(v) => update((d) => { d.identity.tagline = v; })} />
        <div className="md:col-span-2">
          <FormTextarea label="Role" value={file.identity.role || ""} onChange={(v) => update((d) => { d.identity.role = v; })} rows={4} />
        </div>
      </div>
    );
  }
  if (activeSection === "voice") {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormTextarea label="Tone" value={file.voice.tone || ""} onChange={(v) => update((d) => { d.voice.tone = v; })} rows={4} />
          <FormTextarea label="Register" value={file.voice.register || ""} onChange={(v) => update((d) => { d.voice.register = v; })} rows={4} />
        </div>
        <FormTextarea label="Style" value={file.voice.style || ""} onChange={(v) => update((d) => { d.voice.style = v; })} rows={4} />
        <FormTextarea
          label="Prohibited Phrases & Behaviors"
          value={listValue(file.voice.prohibited)}
          onChange={(v) => update((d) => { d.voice.prohibited = parseList(v); })}
          rows={6}
          hint="One prohibited phrase or pattern per line."
        />
      </div>
    );
  }
  if (activeSection === "persona") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <FormTextarea label="Perspective" value={file.persona.perspective || ""} onChange={(v) => update((d) => { d.persona.perspective = v; })} rows={4} />
        <FormTextarea label="Memory Use" value={file.persona.memory_use || ""} onChange={(v) => update((d) => { d.persona.memory_use = v; })} rows={4} />
        <FormTextarea label="Uncertainty Handling" value={file.persona.uncertainty || ""} onChange={(v) => update((d) => { d.persona.uncertainty = v; })} rows={4} />
        <FormTextarea label="Boundaries" value={file.persona.boundaries || ""} onChange={(v) => update((d) => { d.persona.boundaries = v; })} rows={4} />
      </div>
    );
  }
  if (activeSection === "response_format") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <FormTextarea label="Default Format" value={file.response_format.default || ""} onChange={(v) => update((d) => { d.response_format.default = v; })} rows={4} />
        <FormTextarea label="Code Output" value={file.response_format.code || ""} onChange={(v) => update((d) => { d.response_format.code = v; })} rows={4} />
        <FormTextarea label="List Behavior" value={file.response_format.lists || ""} onChange={(v) => update((d) => { d.response_format.lists = v; })} rows={4} />
        <FormInput label="Max Default Length" type="number" value={file.response_format.max_default_length ?? 600} onChange={(v) => update((d) => { d.response_format.max_default_length = Number(v) || 0; })} />
        <div className="md:col-span-2">
          <FormTextarea label="Expand Trigger" value={file.response_format.expand_trigger || ""} onChange={(v) => update((d) => { d.response_format.expand_trigger = v; })} rows={4} />
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <ToggleRow
        label="Prefer Action"
        checked={!!file.decision_rules.prefer_action}
        onCheckedChange={(c) => update((d) => { d.decision_rules.prefer_action = c; })}
        description="Bias ZED toward taking the next useful step instead of over-explaining."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <FormTextarea label="Ask Clarification" value={file.decision_rules.ask_clarification || ""} onChange={(v) => update((d) => { d.decision_rules.ask_clarification = v; })} rows={4} />
        <FormTextarea label="Show Reasoning" value={file.decision_rules.show_reasoning || ""} onChange={(v) => update((d) => { d.decision_rules.show_reasoning = v; })} rows={4} />
        <div className="md:col-span-2">
          <FormTextarea label="Proactive Context" value={file.decision_rules.proactive || ""} onChange={(v) => update((d) => { d.decision_rules.proactive = v; })} rows={4} />
        </div>
      </div>
    </div>
  );
}
