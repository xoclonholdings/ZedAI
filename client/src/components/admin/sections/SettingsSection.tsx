import { useState } from "react";

import { ComingSoon } from "./settings/ComingSoon";
import { HowZarSounds } from "./settings/HowZarSounds";
import { WhatNeedsApproval } from "./settings/WhatNeedsApproval";
import { SETTINGS_CATEGORIES, type SettingsCategoryId } from "./settings/categories";
import { SettingsSidebar } from "./settings/SettingsSidebar";

/**
 * Plain-language Settings surface — sidebar of 8 categories, one
 * content pane per category. Only "How ZAR sounds" is fully built
 * in this first PR; the other 7 show a placeholder that's honest
 * about where the underlying behaviour currently lives (the Ruleset
 * tab). Each subsequent PR replaces one placeholder with a real
 * section, following the same pattern.
 */
export default function SettingsSection() {
  const [active, setActive] = useState<SettingsCategoryId>("voice");
  const category = SETTINGS_CATEGORIES.find((c) => c.id === active) || SETTINGS_CATEGORIES[0];

  return (
    <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-4 overflow-x-hidden md:grid-cols-[220px_minmax(0,1fr)] md:gap-8">
      <SettingsSidebar active={active} onSelect={setActive} />

      <main className="w-full min-w-0 max-w-full overflow-x-hidden">
        {active === "voice" ? (
          <HowZarSounds />
        ) : active === "approval" ? (
          <WhatNeedsApproval />
        ) : (
          <ComingSoon category={category} />
        )}
      </main>
    </div>
  );
}
