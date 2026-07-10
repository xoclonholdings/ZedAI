import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import type { AdminSection, AdminNavTab } from "./types";

const TABS: AdminNavTab[] = [
  { id: "settings", label: "Settings" },
  { id: "integrations", label: "Connections" },
  { id: "knowledge", label: "What Zed knows" },
  { id: "approvals", label: "Approvals" },
  { id: "logs", label: "Activity" },
  { id: "security", label: "Security" },
  { id: "advanced", label: "Advanced" },
];

export default function AdminNav({
  active,
  onSelect,
  pendingApprovals,
}: {
  active: AdminSection;
  onSelect: (next: AdminSection) => void;
  pendingApprovals: number;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  const activeTab = TABS.find((t) => t.id === active) || TABS[0];

  return (
    <div className="w-full max-w-[100vw] overflow-x-hidden border-b border-white/10 bg-black/60">
      {/* Mobile dropdown picker (≤ md) */}
      <div ref={wrapperRef} className="relative w-full max-w-full px-4 py-2.5 md:hidden">
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="flex w-full max-w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium"
          aria-haspopup="menu"
          aria-expanded={pickerOpen}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{activeTab.label}</span>
            {active === "approvals" && pendingApprovals > 0 && (
              <span className="bg-pink-600 text-white text-[10px] font-bold rounded-full w-4 h-4 shrink-0 flex items-center justify-center">
                {pendingApprovals}
              </span>
            )}
          </span>
          <ChevronDown size={14} className="shrink-0 opacity-70" />
        </button>
        {pickerOpen && (
          <div
            role="menu"
            className="absolute left-4 right-4 z-30 mt-1 rounded-xl border border-white/10 bg-black/95 p-1 shadow-2xl backdrop-blur"
          >
            {TABS.map(({ id, label }) => {
              const badge = id === "approvals" ? pendingApprovals : 0;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onSelect(id);
                    setPickerOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                    active === id
                      ? "bg-white/10 text-white"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  }`}
                  data-testid={`admin-tab-${id}`}
                >
                  <span>{label}</span>
                  {badge > 0 && (
                    <span className="bg-pink-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop tab strip (md+) */}
      <div className="hidden max-w-full min-w-0 gap-1 overflow-x-auto px-4 md:flex">
        {TABS.map(({ id, label }) => {
          const badge = id === "approvals" ? pendingApprovals : 0;
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`px-4 py-3 text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                isActive
                  ? "text-white border-b-2 border-purple-500"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`admin-tab-${id}`}
            >
              {label}
              {badge > 0 && (
                <span className="bg-pink-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
