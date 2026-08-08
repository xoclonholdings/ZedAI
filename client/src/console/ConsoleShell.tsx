import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import type { ConsoleIdentity } from "./consoleIdentity";
import { ConsoleActivator } from "./ConsoleActivator";
import { ConsoleBrowserFullPage } from "./ConsoleBrowserFullPage";
import { ConsoleBrowserProvider, useConsoleBrowser } from "./ConsoleBrowserContext";
import { ConsoleDock } from "./ConsoleDock";
import { CONSOLE_CONTENT_REGION_CLASS } from "./ConsoleGlassPanel";

/**
 * The ZEBULON Console Framework shell - the one composition every console
 * screen shares, regardless of galaxy: a full-viewport backdrop/content
 * layer (`children`), a floating header, and the Console Activator sitting
 * directly above the persistent ConsoleDock at the bottom - the activator
 * powers the dock, so it lives right next to what it controls rather than
 * off in the header. Callers supply the backdrop/main content and both
 * header slots in full (home's wordmark + sign-out + planet name, or a
 * workspace's back-to-Nexys control + sign-out + node label) - this
 * component only owns the parts that must stay identical everywhere.
 */
export function ConsoleShell(props: {
  readonly identity: ConsoleIdentity;
  readonly headerLeft: ReactNode;
  readonly headerRightExtra?: ReactNode;
  readonly dockPowered: boolean;
  readonly onDockPowerChange: (next: boolean) => void;
  readonly children: ReactNode;
}) {
  return (
    <ConsoleBrowserProvider>
      <ConsoleShellBody {...props} />
    </ConsoleBrowserProvider>
  );
}

function ConsoleShellBody({
  identity,
  headerLeft,
  headerRightExtra,
  dockPowered,
  onDockPowerChange,
  children,
}: {
  readonly identity: ConsoleIdentity;
  readonly headerLeft: ReactNode;
  readonly headerRightExtra?: ReactNode;
  readonly dockPowered: boolean;
  readonly onDockPowerChange: (next: boolean) => void;
  readonly children: ReactNode;
}) {
  const { fullPageOpen } = useConsoleBrowser();
  const reducedMotion = useReducedMotion();

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[radial-gradient(ellipse_90%_70%_at_50%_35%,#0b0620_0%,#050211_55%,#010005_100%)] text-white">
      {children}

      <AnimatePresence>
        {fullPageOpen && (
          <motion.div
            key="console-browser-full-page"
            className={`${CONSOLE_CONTENT_REGION_CLASS} pb-3`}
            data-console-region="browser"
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mx-auto h-full max-w-3xl">
              <ConsoleBrowserFullPage />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-4 pt-safe-sm sm:px-6 sm:pt-5">
        <div className="pointer-events-auto min-w-0">{headerLeft}</div>
        <div className="pointer-events-auto flex shrink-0 flex-col items-end gap-2">
          {headerRightExtra}
        </div>
      </header>

      <div
        className="absolute inset-x-0 bottom-0 flex justify-center px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        data-console-region="dock"
        data-nexys-region="communication"
      >
        <div className="flex w-full max-w-[760px] flex-col items-end gap-2">
          <ConsoleActivator active={dockPowered} onToggle={() => onDockPowerChange(!dockPowered)} accent={identity.accent} />
          <div className="w-full">
            <ConsoleDock powered={dockPowered} onPowerChange={onDockPowerChange} accent={identity.accent} />
          </div>
        </div>
      </div>
    </div>
  );
}
