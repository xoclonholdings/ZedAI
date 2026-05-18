import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import { CustomIntegrationRow } from "./CustomIntegrationRow";
import {
  saveButtonLabel,
  type CustomIntegrationDraft,
  type CustomIntegrationField,
  type SaveStatus,
} from "./shared";

export function CustomIntegrationsPanel({
  items,
  onChange,
  onSave,
  saveStatus,
}: {
  items: CustomIntegrationDraft[];
  onChange: (items: CustomIntegrationDraft[]) => void;
  onSave: () => void;
  saveStatus: SaveStatus;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  function addIntegration() {
    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const next: CustomIntegrationDraft[] = [
      ...items,
      { id, label: "New integration", description: "", enabled: false, fields: [] },
    ];
    onChange(next);
    setExpanded(id);
  }

  function patch(id: string, p: Partial<CustomIntegrationDraft>) {
    onChange(items.map((c) => (c.id === id ? { ...c, ...p } : c)));
  }

  function removeIntegration(id: string) {
    if (!window.confirm("Remove this integration?")) return;
    onChange(items.filter((c) => c.id !== id));
    if (expanded === id) setExpanded(null);
  }

  function addField(id: string) {
    const item = items.find((c) => c.id === id);
    if (!item) return;
    patch(id, { fields: [...(item.fields || []), { key: "", value: "", isSecret: false }] });
  }

  function patchField(id: string, idx: number, p: Partial<CustomIntegrationField>) {
    const item = items.find((c) => c.id === id);
    if (!item) return;
    const fields = (item.fields || []).map((f, i) => (i === idx ? { ...f, ...p } : f));
    patch(id, { fields });
  }

  function removeField(id: string, idx: number) {
    const item = items.find((c) => c.id === id);
    if (!item) return;
    patch(id, { fields: (item.fields || []).filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
        <span className="text-sm text-muted-foreground">
          {items.length} custom integration{items.length === 1 ? "" : "s"}
        </span>
        <Button
          size="sm"
          onClick={addIntegration}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 h-8"
        >
          <Plus size={13} className="mr-1" />
          Add integration
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-black/20 p-6 text-center">
          <p className="text-sm">No custom integrations yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Define one when you have a service ZED should know about — e.g. a webhook, a
            scraper, a third-party API.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((c) => (
            <CustomIntegrationRow
              key={c.id}
              item={c}
              expanded={expanded === c.id}
              onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
              onPatch={(p) => patch(c.id, p)}
              onRemove={() => removeIntegration(c.id)}
              onAddField={() => addField(c.id)}
              onPatchField={(idx, p) => patchField(c.id, idx, p)}
              onRemoveField={(idx) => removeField(c.id, idx)}
              onClose={() => setExpanded(null)}
            />
          ))}
        </div>
      )}

      <Button
        onClick={onSave}
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
      >
        {saveButtonLabel(saveStatus)}
      </Button>
    </div>
  );
}
