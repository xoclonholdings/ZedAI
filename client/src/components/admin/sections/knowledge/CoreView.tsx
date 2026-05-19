import { BrainCircuit, Edit3, Layers, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { LabeledInput } from "./atoms";
import {
  EMPTY_CORE_MEMORY,
  type CoreMemoryDraft,
  type FoundationProfile,
  type SaveStatus,
} from "./types";

export function CoreView({
  coreItems,
  coreDraft,
  setCoreDraft,
  coreStatus,
  onSaveCore,
  foundationProfile,
  setFoundationProfile,
  foundationStatus,
  foundationPreview,
  onSaveFoundation,
}: {
  coreItems: any[];
  coreDraft: CoreMemoryDraft;
  setCoreDraft: (next: CoreMemoryDraft | ((prev: CoreMemoryDraft) => CoreMemoryDraft)) => void;
  coreStatus: SaveStatus;
  onSaveCore: () => void;
  foundationProfile: FoundationProfile;
  setFoundationProfile: (
    next: FoundationProfile | ((prev: FoundationProfile) => FoundationProfile),
  ) => void;
  foundationStatus: SaveStatus;
  foundationPreview: string;
  onSaveFoundation: () => void;
}) {
  const foundationField = (
    key: keyof FoundationProfile,
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
        value={foundationProfile[key]}
        onChange={(e) => setFoundationProfile((prev) => ({ ...prev, [key]: e.target.value }))}
        className="zed-glass border-white/10 text-sm"
        placeholder={placeholder}
      />
    </label>
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <Card className="zed-glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BrainCircuit size={16} className="text-cyan-300" />
            Foundation Profile
          </CardTitle>
          <CardDescription>
            Curate the global company-level knowledge ZED should use across brand, products,
            mission, and strategic direction.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {foundationField("company", "Company", 4, "Company identity, structure, and overarching context.")}
            {foundationField("mission", "Mission", 4, "What the organization is trying to accomplish.")}
            {foundationField("products", "Products & Ventures", 5, "Products, brands, apps, services, and venture portfolio.")}
            {foundationField("audience", "Audience", 5, "Who the company serves and how users/customers should be understood.")}
            {foundationField("brand", "Brand Voice", 5, "Voice, tone, positioning, and brand personality.")}
            {foundationField("principles", "Operating Principles", 5, "How the organization prefers to operate and make decisions.")}
          </div>

          {foundationField(
            "priorities",
            "Strategic Priorities",
            6,
            "Near-term priorities, current focus areas, and what ZED should optimize toward.",
          )}

          <Card className="border-white/10 bg-black/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Foundation Memory Preview</CardTitle>
              <CardDescription>
                This is the structured core-memory document ZED will retrieve from the global
                foundation layer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-6 text-foreground/80">
                {foundationPreview}
              </pre>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button onClick={onSaveFoundation}>
              <Save size={14} className="mr-2" />
              {foundationStatus === "saving" ? "Saving..." : "Save Foundation Profile"}
            </Button>
            {foundationStatus === "error" ? (
              <span className="text-xs text-red-400">Failed to save the foundation profile.</span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="zed-glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers size={16} className="text-cyan-300" />
            Core Memory Editor
          </CardTitle>
          <CardDescription>
            Edit canonical system memory entries used across identity, policy, rules, and grounded
            behavior.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LabeledInput
            label="Key"
            value={coreDraft.key}
            onChange={(value) => setCoreDraft((prev) => ({ ...prev, key: value }))}
            placeholder="identity"
          />
          <LabeledInput
            label="Description"
            value={coreDraft.description}
            onChange={(value) => setCoreDraft((prev) => ({ ...prev, description: value }))}
            placeholder="What this core memory entry controls"
          />
          <label className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Value
            </div>
            <Textarea
              rows={16}
              value={coreDraft.value}
              onChange={(e) => setCoreDraft((prev) => ({ ...prev, value: e.target.value }))}
              className="zed-glass border-white/10 font-mono text-xs"
              placeholder="Store structured JSON, YAML-ish text, or canonical memory text here."
            />
          </label>
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="space-y-1">
              <div className="text-sm font-medium">Admin Only</div>
              <div className="text-xs text-muted-foreground">
                Restrict this memory entry to privileged administrative access.
              </div>
            </div>
            <Switch
              checked={coreDraft.adminOnly}
              onCheckedChange={(checked) =>
                setCoreDraft((prev) => ({ ...prev, adminOnly: checked }))
              }
            />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={onSaveCore}>
              <Save size={14} className="mr-2" />
              {coreStatus === "saving" ? "Saving..." : "Save Core Memory"}
            </Button>
            <Button
              variant="outline"
              className="border-white/10"
              onClick={() => setCoreDraft(EMPTY_CORE_MEMORY)}
            >
              Reset
            </Button>
            {coreStatus === "error" ? (
              <span className="text-xs text-red-400">Key and value are required.</span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="zed-glass border-white/10">
        <CardHeader>
          <CardTitle className="text-base">Current Core Memory</CardTitle>
          <CardDescription>
            Load an existing entry into the editor, then update it without leaving this screen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {coreItems.length > 0 ? (
            coreItems.map((item) => (
              <div
                key={item.id || item.key}
                className="rounded-2xl border border-white/10 bg-black/25 p-4"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-medium">{item.key}</div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="border-white/10 text-muted-foreground">
                        {item.adminOnly ? "Admin Only" : "Shared"}
                      </Badge>
                      {item.description ? (
                        <Badge variant="outline" className="border-white/10 text-muted-foreground">
                          {item.description}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/10"
                    onClick={() =>
                      setCoreDraft({
                        key: item.key,
                        description: item.description || "",
                        value: item.value || "",
                        adminOnly: item.adminOnly ?? true,
                      })
                    }
                  >
                    <Edit3 size={12} className="mr-1" />
                    Load
                  </Button>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-6 text-foreground/80">
                  {item.value}
                </pre>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">
              No core memory entries were returned.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
