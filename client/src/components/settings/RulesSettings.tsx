import { useLocation } from "wouter";

import {
  SettingGroup,
  SettingRow,
} from "@/components/admin/sections/settings/atoms";

/**
 * Plain-language "Projects & workspaces" — placeholder that points
 * users toward the actual controls (Admin panel, workspace pages).
 * The old "Rules & Parameters" content is now the Admin → Advanced
 * tab; from here we just link over.
 */
export default function RulesSettings() {
  const [, navigate] = useLocation();

  return (
    <div>
      <header className="mb-6">
        <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
          Projects & workspaces
        </h2>
        <p className="mt-1.5 text-[13.5px] text-white/50 max-w-full sm:max-w-[62ch] leading-snug">
          How Zed groups your work. Projects hold a set of related files, notes,
          and rules. Workspaces are the top-level areas — Research, Operations,
          Finance, Marketing, Education.
        </p>
      </header>

      <SettingGroup title="Where things live">
        <SettingRow
          label="Manage projects"
          description="Create, rename, and organize the projects Zed groups your work under."
        >
          <button
            type="button"
            onClick={() => navigate("/chat")}
            className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/80 hover:text-white transition-colors active:opacity-80"
          >
            Open Projects
          </button>
        </SettingRow>

        <SettingRow
          label="Rules that shape Zed's behavior"
          description="The friendly version is in Admin → Settings. The engineer view is in Admin → Advanced."
        >
          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[13px] text-white/80 hover:text-white transition-colors active:opacity-80"
          >
            Open Admin
          </button>
        </SettingRow>
      </SettingGroup>
    </div>
  );
}
