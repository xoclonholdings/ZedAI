import { CheckCircle2, Pencil, Plus, Trash2, X, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  FieldRow,
  type CustomIntegrationDraft,
  type CustomIntegrationField,
} from "./shared";

export function CustomIntegrationRow({
  item,
  expanded,
  onToggle,
  onPatch,
  onRemove,
  onAddField,
  onPatchField,
  onRemoveField,
  onClose,
}: {
  item: CustomIntegrationDraft;
  expanded: boolean;
  onToggle: () => void;
  onPatch: (p: Partial<CustomIntegrationDraft>) => void;
  onRemove: () => void;
  onAddField: () => void;
  onPatchField: (idx: number, p: Partial<CustomIntegrationField>) => void;
  onRemoveField: (idx: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center">
          {item.enabled ? (
            <CheckCircle2 size={14} className="text-emerald-300" />
          ) : (
            <XCircle size={14} className="text-muted-foreground/70" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{item.label || "Untitled"}</div>
          <div className="text-[11px] text-muted-foreground truncate">
            {item.fields.length} field{item.fields.length === 1 ? "" : "s"}
            {item.description ? ` · ${item.description}` : ""}
          </div>
        </div>
        <Pencil size={13} className="text-muted-foreground" />
      </button>

      {expanded && (
        <div className="space-y-2.5 border-t border-white/10 px-3 pt-2.5 pb-3">
          <div className="grid grid-cols-2 gap-2.5">
            <FieldRow label="Label">
              <Input
                value={item.label}
                onChange={(e) => onPatch({ label: e.target.value })}
                className="border-white/10 bg-black/30 text-sm h-9"
                placeholder="My webhook"
              />
            </FieldRow>
            <FieldRow label="Enabled">
              <button
                type="button"
                onClick={() => onPatch({ enabled: !item.enabled })}
                className="flex h-9 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-2 text-xs"
              >
                <span
                  className={`flex h-4 w-7 items-center rounded-full p-0.5 ${
                    item.enabled
                      ? "justify-end bg-emerald-500/60"
                      : "justify-start bg-white/15"
                  }`}
                >
                  <span className="h-3 w-3 rounded-full bg-white" />
                </span>
                <span>{item.enabled ? "On" : "Off"}</span>
              </button>
            </FieldRow>
          </div>
          <FieldRow label="Description">
            <Input
              value={item.description}
              onChange={(e) => onPatch({ description: e.target.value })}
              className="border-white/10 bg-black/30 text-sm h-9"
              placeholder="What ZED should know about this integration"
            />
          </FieldRow>

          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Fields
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onAddField}
                className="h-7 text-xs text-cyan-300 hover:text-cyan-200"
              >
                <Plus size={12} className="mr-1" />
                Add field
              </Button>
            </div>
            {(item.fields || []).length === 0 ? (
              <p className="text-[11px] text-muted-foreground/70 italic">No fields yet</p>
            ) : (
              <div className="space-y-1.5">
                {(item.fields || []).map((f, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-1.5"
                  >
                    <Input
                      value={f.key}
                      onChange={(e) => onPatchField(idx, { key: e.target.value })}
                      className="border-white/10 bg-black/30 text-xs h-8 w-32 font-mono"
                      placeholder="key"
                    />
                    <Input
                      type={f.isSecret ? "password" : "text"}
                      value={f.value}
                      onChange={(e) => onPatchField(idx, { value: e.target.value })}
                      className="border-white/10 bg-black/30 text-xs h-8 flex-1"
                      placeholder={f.isSecret ? "secret value" : "value"}
                    />
                    <button
                      type="button"
                      onClick={() => onPatchField(idx, { isSecret: !f.isSecret })}
                      className={`rounded-md border px-1.5 py-1 text-[9px] uppercase tracking-[0.16em] transition-colors ${
                        f.isSecret
                          ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-200"
                          : "border-white/10 bg-black/20 text-muted-foreground"
                      }`}
                      title="Toggle secret"
                    >
                      {f.isSecret ? "secret" : "plain"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveField(idx)}
                      className="text-muted-foreground hover:text-red-300"
                      aria-label="Remove field"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-red-300 hover:text-red-200 hover:bg-red-500/10 h-7 text-xs"
            >
              <Trash2 size={12} className="mr-1" />
              Remove integration
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 text-xs"
            >
              <X size={12} className="mr-1" />
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
