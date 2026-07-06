import { useState } from "react";

import { ComingSoon } from "./settings/ComingSoon";
import { HowZedSounds } from "./settings/HowZedSounds";
import { WhatNeedsApproval } from "./settings/WhatNeedsApproval";
import { SETTINGS_CATEGORIES, type SettingsCategoryId } from "./settings/categories";
import { SettingsSidebar } from "./settings/SettingsSidebar";

/**
 * Plain-language Settings surface — sidebar of 8 categories, one
 * content pane per category. Only "How Zed sounds" is fully built
 * in this first PR; the other 7 show a placeholder that's honest
 * about where the underlying behaviour currently lives (the Ruleset
 * tab). Each subsequent PR replaces one placeholder with a real
 * section, following the same pattern.
 */
export default function SettingsSection() {
  const [active, setActive] = useState<SettingsCategoryId>("voice");
  const category = SETTINGS_CATEGORIES.find((c) => c.id === active) || SETTINGS_CATEGORIES[0];

  return (
    <div className="grid gap-8 md:grid-cols-[220px_1fr]">
      <SettingsSidebar active={active} onSelect={setActive} />

      <main className="min-w-0">
        {active === "voice" ? (
          <HowZedSounds />
        ) : active === "approval" ? (
          <WhatNeedsApproval />
        ) : (
          <ComingSoon category={category} />
        )}
      </main>
    </div>
  );
}
