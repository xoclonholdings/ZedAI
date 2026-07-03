import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { FormInput, FormTextarea, ToggleRow } from "./form-atoms";
import { sectionTitle, type UpdaterFn } from "./meta";

export function AccessForm({
  file,
  activeSection,
  update,
}: {
  file: any;
  activeSection: string;
  update: UpdaterFn;
}) {
  const externalApisPreview = useMemo(() => {
    const apis = (file.external_apis?.approved_free_tier || {}) as Record<string, any[]>;
    return Object.entries(apis).map(([group, items]) => ({
      group,
      items: (items || []).map((item) => ({
        ...item,
        permissions: item.permissions || "",
      })),
    }));
  }, [file]);

  function updateExternalApi(group: string, index: number, key: string, value: string) {
    update((draft) => {
      if (!draft.external_apis.approved_free_tier[group]) {
        draft.external_apis.approved_free_tier[group] = [];
      }
      draft.external_apis.approved_free_tier[group][index][key] = value;
    });
  }

  if (activeSection === "ai_host") {
    const aiHost = file.ai_host || {};
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormInput label="Provider Endpoint" value={aiHost.host || ""} onChange={(v) => update((d) => { d.ai_host.host = v; })} />
          <FormInput label="Timeout Ms" type="number" value={aiHost.timeout_ms ?? 0} onChange={(v) => update((d) => { d.ai_host.timeout_ms = Number(v) || 0; })} />
        </div>
        <ToggleRow
          label="Shared Cloud Endpoint"
          checked={!!aiHost.shared_with_zeta_core}
          onCheckedChange={(c) => update((d) => { d.ai_host.shared_with_zeta_core = c; })}
          description="Indicates whether the configured model endpoint is shared with the wider Zeta Core environment."
        />
      </div>
    );
  }
  if (activeSection === "local_services") {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <FormTextarea label="Database" value={file.local_services.database || ""} onChange={(v) => update((d) => { d.local_services.database = v; })} rows={4} />
        <FormTextarea label="Vector Store" value={file.local_services.vector_store || ""} onChange={(v) => update((d) => { d.local_services.vector_store = v; })} rows={4} />
        <FormTextarea label="Log Store" value={file.local_services.log_store || ""} onChange={(v) => update((d) => { d.local_services.log_store = v; })} rows={4} />
      </div>
    );
  }
  if (activeSection === "external_apis") {
    return (
      <div className="space-y-4">
        <FormTextarea label="Policy" value={file.external_apis.policy || ""} onChange={(v) => update((d) => { d.external_apis.policy = v; })} rows={3} />
        {externalApisPreview.map(({ group, items }) => (
          <Card key={group} className="border-white/10 bg-black/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{sectionTitle(group)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.length > 0 ? (
                items.map((item, index) => (
                  <div
                    key={`${group}-${index}`}
                    className="grid gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 md:grid-cols-2 xl:grid-cols-4"
                  >
                    <FormInput label="Name" value={item.name || ""} onChange={(v) => updateExternalApi(group, index, "name", v)} />
                    <FormInput label="Env Key" value={item.env_key || ""} onChange={(v) => updateExternalApi(group, index, "env_key", v)} />
                    <FormInput label="Status" value={item.status || ""} onChange={(v) => updateExternalApi(group, index, "status", v)} />
                    <FormInput label="Permissions" value={item.permissions || ""} onChange={(v) => updateExternalApi(group, index, "permissions", v)} />
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">
                  No approved integrations listed for this group.
                </div>
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
          <FormInput
            key={key}
            label={sectionTitle(key)}
            value={String(value ?? "")}
            onChange={(next) => update((d) => { d.paths[key] = next; })}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <FormInput label="Current Mode" value={file.trust_model.current_mode || ""} onChange={(v) => update((d) => { d.trust_model.current_mode = v; })} />
      <ToggleRow
        label="Multi User Ready"
        checked={!!file.trust_model.multi_user_ready}
        onCheckedChange={(c) => update((d) => { d.trust_model.multi_user_ready = c; })}
        description="Indicates whether the current trust model is ready for true multi-user operation."
      />
      <FormTextarea label="Multi User Stub" value={file.trust_model.multi_user_stub || ""} onChange={(v) => update((d) => { d.trust_model.multi_user_stub = v; })} rows={4} />
    </div>
  );
}
