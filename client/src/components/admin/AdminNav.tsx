import type { AdminSection, AdminNavTab } from "./types";

const TABS: AdminNavTab[] = [
  { id: "overview", label: "Overview" },
  { id: "knowledge", label: "Knowledge" },
  { id: "integrations", label: "Integrations" },
  { id: "ruleset", label: "Ruleset" },
  { id: "approvals", label: "Approvals" },
  { id: "logs", label: "Logs" },
  { id: "security", label: "Security" },
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
  return (
    <div className="border-b border-white/10 px-4 flex gap-1 bg-black/60 overflow-x-auto">
      {TABS.map(({ id, label }) => {
        const badge = id === "approvals" ? pendingApprovals : 0;
        const isActive = active === id;
        return (
          <button
            key={id}
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
  );
}
