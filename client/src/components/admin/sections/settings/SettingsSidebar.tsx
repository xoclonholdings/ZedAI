import { SETTINGS_CATEGORIES, type SettingsCategoryId } from "./categories";

/**
 * Vertical category nav on desktop, horizontally-scrolling pill row
 * on mobile. Matches the mock. Ready categories are clickable and
 * carry the cyan accent when active; not-ready categories are
 * clickable too so the user can see the placeholder pane and know
 * what's coming.
 */
export function SettingsSidebar({
  active,
  onSelect,
}: {
  active: SettingsCategoryId;
  onSelect: (id: SettingsCategoryId) => void;
}) {
  return (
    <nav aria-label="Settings sections" className="w-full min-w-0 max-w-full md:sticky md:top-6">
      <div className="hidden md:flex md:flex-col md:gap-[2px]">
        {SETTINGS_CATEGORIES.map((cat) => {
          const isActive = cat.id === active;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(cat.id)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[14px] transition-colors ${
                isActive
                  ? "bg-cyan-400/[0.12] text-white font-medium"
                  : "text-white/50 hover:text-white/90 hover:bg-white/[0.04]"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isActive ? "bg-cyan-400" : "bg-transparent"
                }`}
              />
              <span className="truncate">{cat.label}</span>
              {!cat.ready && (
                <span className="ml-auto text-[10px] uppercase tracking-[0.08em] text-white/30">
                  soon
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Mobile: horizontal pill scroll */}
      <div
        className="w-full max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain pb-1 md:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        <div
          className="flex w-max max-w-none gap-1.5"
        >
          {SETTINGS_CATEGORIES.map((cat) => {
            const isActive = cat.id === active;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelect(cat.id)}
                className={`shrink-0 whitespace-nowrap rounded-lg border px-3.5 py-2 text-[13px] transition-colors ${
                  isActive
                    ? "bg-cyan-400/[0.12] border-cyan-400/40 text-white"
                    : "bg-white/[0.02] border-white/10 text-white/60 hover:text-white/90"
                }`}
              >
                {cat.label}
                {!cat.ready && (
                  <span className="ml-1.5 text-[9px] uppercase tracking-[0.08em] text-white/30">
                    soon
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
