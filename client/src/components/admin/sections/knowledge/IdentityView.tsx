import { Fingerprint, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

import type { IdentityProfile, SaveStatus } from "./types";

export function IdentityView({
  identityProfile,
  setIdentityProfile,
  identityPreview,
  identityStatus,
  onSaveIdentity,
}: {
  identityProfile: IdentityProfile;
  setIdentityProfile: (
    next: IdentityProfile | ((prev: IdentityProfile) => IdentityProfile),
  ) => void;
  identityPreview: string;
  identityStatus: SaveStatus;
  onSaveIdentity: () => void;
}) {
  const field = (
    key: keyof IdentityProfile,
    label: string,
    rows: number,
    placeholder: string,
  ) => (
    <label className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <Textarea
        rows={rows}
        value={identityProfile[key]}
        onChange={(event) =>
          setIdentityProfile((prev) => ({ ...prev, [key]: event.target.value }))
        }
        className="zed-glass border-white/10 text-sm"
        placeholder={placeholder}
      />
    </label>
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
      <Card className="zed-glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Fingerprint size={16} className="text-cyan-300" />
            Identity Profile
          </CardTitle>
          <CardDescription>
            Define the canonical person ZED is speaking with. This is the source ZED should use
            when asked identity questions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {field("preferredName", "Preferred Name", 3, "What ZED should call you.")}
            {field("formalName", "Formal Name", 3, "Legal, business, or public-facing name if relevant.")}
            {field("role", "Role", 4, "Founder, operator, owner, admin, creator, strategist...")}
            {field("relationshipToZed", "Relationship To ZED", 4, "How ZED should understand your authority and relationship to the system.")}
          </div>

          {field("whoAmIAnswer", "Direct 'Who Am I?' Answer", 5, "The exact identity framing ZED should use when you ask 'who am I?'")}

          <div className="grid gap-4 md:grid-cols-2">
            {field("ventures", "Ventures & Responsibilities", 6, "Businesses, products, holdings, apps, or initiatives tied to you.")}
            {field("operatingStyle", "Operating Style", 6, "How you work, decide, communicate, and want support.")}
          </div>

          {field("boundaries", "Boundaries", 4, "Identity facts ZED should not invent, expose, or confuse.")}

          <div className="flex items-center gap-3">
            <Button onClick={onSaveIdentity}>
              <Save size={14} className="mr-2" />
              {identityStatus === "saving" ? "Saving..." : "Save Identity"}
            </Button>
            {identityStatus === "saved" ? (
              <span className="text-xs text-emerald-300">Identity saved.</span>
            ) : null}
            {identityStatus === "error" ? (
              <span className="text-xs text-red-400">Add at least a preferred name or direct answer.</span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="zed-glass border-white/10">
        <CardHeader>
          <CardTitle className="text-base">Canonical Identity Preview</CardTitle>
          <CardDescription>
            Saved as core memory key <span className="font-mono">identity</span> and injected
            into ZED's admin chat context.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-6 text-foreground/80">
            {identityPreview}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
