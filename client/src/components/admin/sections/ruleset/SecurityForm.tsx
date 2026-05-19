import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { FormInput, FormTextarea, ToggleRow } from "./form-atoms";
import { listValue, parseList, type UpdaterFn } from "./meta";

function PermissionTierEditor({ file, update }: { file: any; update: UpdaterFn }) {
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
              onChange={(v) => update((d) => { d.permission_tiers[tier.key].description = v; })}
              rows={3}
            />
            <FormTextarea
              label="Actions"
              value={listValue(file.permission_tiers[tier.key]?.actions)}
              onChange={(v) => update((d) => { d.permission_tiers[tier.key].actions = parseList(v); })}
              rows={6}
              hint="One action or policy item per line."
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function SecurityForm({
  file,
  activeSection,
  update,
}: {
  file: any;
  activeSection: string;
  update: UpdaterFn;
}) {
  if (activeSection === "authentication") {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormInput label="Mode" value={file.authentication.mode || ""} onChange={(v) => update((d) => { d.authentication.mode = v; })} />
          <FormInput label="Passphrase Env Key" value={file.authentication.passphrase_key || ""} onChange={(v) => update((d) => { d.authentication.passphrase_key = v; })} />
          <div className="md:col-span-2">
            <FormInput label="Default Passphrase" value={file.authentication.default_passphrase || ""} onChange={(v) => update((d) => { d.authentication.default_passphrase = v; })} />
          </div>
        </div>
        <Card className="border-white/10 bg-black/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Rate Limit</CardTitle>
            <CardDescription>Control lockout protection around login attempts.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <FormInput label="Max Attempts" type="number" value={file.authentication.rate_limit?.max_attempts ?? 0} onChange={(v) => update((d) => { d.authentication.rate_limit.max_attempts = Number(v) || 0; })} />
            <FormInput label="Lockout Minutes" type="number" value={file.authentication.rate_limit?.lockout_minutes ?? 0} onChange={(v) => update((d) => { d.authentication.rate_limit.lockout_minutes = Number(v) || 0; })} />
            <FormInput label="Window Minutes" type="number" value={file.authentication.rate_limit?.window_minutes ?? 0} onChange={(v) => update((d) => { d.authentication.rate_limit.window_minutes = Number(v) || 0; })} />
          </CardContent>
        </Card>
      </div>
    );
  }
  if (activeSection === "permission_tiers") {
    return <PermissionTierEditor file={file} update={update} />;
  }
  if (activeSection === "approval_gates") {
    return (
      <div className="space-y-4">
        <FormInput label="Queue Path" value={file.approval_gates.queue_path || ""} onChange={(v) => update((d) => { d.approval_gates.queue_path = v; })} />
        <FormInput label="Auto Expire Hours" type="number" value={file.approval_gates.auto_expire_hours ?? 24} onChange={(v) => update((d) => { d.approval_gates.auto_expire_hours = Number(v) || 0; })} />
        <ToggleRow
          label="Notify On Queue"
          checked={!!file.approval_gates.notify_on_queue}
          onCheckedChange={(c) => update((d) => { d.approval_gates.notify_on_queue = c; })}
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
        onChange={(v) => update((d) => { d.sensitive_topics.require_extra_care = parseList(v); })}
        rows={10}
        hint="One sensitive topic policy per line."
      />
    );
  }
  return (
    <div className="space-y-4">
      <FormInput label="Log Path" value={file.audit_log.path || ""} onChange={(v) => update((d) => { d.audit_log.path = v; })} />
      <ToggleRow
        label="Log All Requests"
        checked={!!file.audit_log.log_all_requests}
        onCheckedChange={(c) => update((d) => { d.audit_log.log_all_requests = c; })}
        description="Capture every request in the audit log instead of only key security events."
      />
      <ToggleRow
        label="Log Approval Events"
        checked={!!file.audit_log.log_approval_events}
        onCheckedChange={(c) => update((d) => { d.audit_log.log_approval_events = c; })}
        description="Track approval queue creation, approvals, and rejections."
      />
      <ToggleRow
        label="Log Auth Events"
        checked={!!file.audit_log.log_auth_events}
        onCheckedChange={(c) => update((d) => { d.audit_log.log_auth_events = c; })}
        description="Track login successes, failures, and auth-related blocks."
      />
    </div>
  );
}
