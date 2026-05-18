import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { FieldRow, saveButtonLabel, type SaveStatus } from "./shared";

function humanize(s: string): string {
  return s.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

export function SimpleIntegrationPanel({
  draft,
  onUpdate,
  onSave,
  saveStatus,
}: {
  draft: any;
  onUpdate: (key: string, value: any) => void;
  onSave: () => void;
  saveStatus: SaveStatus;
}) {
  const otherFields = Object.entries(draft).filter(
    ([key]) => !["enabled", "status", "notes", "accounts"].includes(key),
  );
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2 pb-1">
        <button
          type="button"
          onClick={() => onUpdate("enabled", !draft.enabled)}
          className="flex items-center gap-2 text-sm"
        >
          <span
            className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
              draft.enabled ? "justify-end bg-emerald-500/60" : "justify-start bg-white/15"
            }`}
          >
            <span className="h-4 w-4 rounded-full bg-white shadow" />
          </span>
          <span>{draft.enabled ? "Enabled" : "Disabled"}</span>
        </button>
        {"status" in draft && (
          <Badge
            variant="secondary"
            className="zed-glass border-white/10 text-[9px] uppercase tracking-[0.16em]"
          >
            {draft.status}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {otherFields.map(([key, value]) => {
          if (typeof value === "boolean") {
            return (
              <FieldRow key={key} label={humanize(key)}>
                <button
                  type="button"
                  onClick={() => onUpdate(key, !value)}
                  className="flex h-9 items-center gap-2 rounded-md border border-white/10 bg-black/30 px-2 text-xs"
                >
                  <span
                    className={`flex h-4 w-7 items-center rounded-full p-0.5 ${
                      value ? "justify-end bg-emerald-500/60" : "justify-start bg-white/15"
                    }`}
                  >
                    <span className="h-3 w-3 rounded-full bg-white" />
                  </span>
                  <span>{value ? "On" : "Off"}</span>
                </button>
              </FieldRow>
            );
          }
          const isPort = key.toLowerCase().includes("port");
          const isSecret =
            key.toLowerCase().includes("token") ||
            key.toLowerCase().includes("password") ||
            key.toLowerCase().includes("apikey");
          return (
            <FieldRow key={key} label={humanize(key)}>
              <Input
                type={isSecret ? "password" : "text"}
                value={String(value ?? "")}
                onChange={(e) =>
                  onUpdate(key, isPort ? Number(e.target.value) || 0 : e.target.value)
                }
                className="border-white/10 bg-black/30 text-sm h-9"
                placeholder={isSecret ? "stored server-side or paste to replace" : ""}
              />
            </FieldRow>
          );
        })}
      </div>

      <Button
        onClick={onSave}
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
      >
        {saveButtonLabel(saveStatus)}
      </Button>
    </div>
  );
}
