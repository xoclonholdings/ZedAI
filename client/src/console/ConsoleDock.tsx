import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { NexysConversationSurface, type NexysDockMode } from "@/nexys/components/NexysConversationSurface";
import { ConsoleStandbyBar } from "./ConsoleStandbyBar";

const POWER_TRANSITION = { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const };

/**
 * The console's persistent operating surface - attached to every console
 * screen, in every galaxy. Standby is the compact two-line face; powering on
 * expands it into the approved five-control Chat/Upload/Desk surface.
 */
export function ConsoleDock({
  powered,
  onPowerChange,
  accent,
}: {
  readonly powered: boolean;
  readonly onPowerChange: (next: boolean) => void;
  readonly accent: string;
}) {
  const reducedMotion = useReducedMotion();
  const [pendingMode, setPendingMode] = useState<NexysDockMode | undefined>(undefined);

  function handleActivate(modeId: string) {
    setPendingMode(modeId as NexysDockMode);
    onPowerChange(true);
  }

  return (
    <AnimatePresence initial={false} mode="wait">
      {powered ? (
        <motion.div
          key="active"
          initial={reducedMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
          transition={POWER_TRANSITION}
        >
          <NexysConversationSurface initialMode={pendingMode} />
        </motion.div>
      ) : (
        <motion.div
          key="standby"
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.25 }}
        >
          <ConsoleStandbyBar onActivate={handleActivate} accent={accent} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
