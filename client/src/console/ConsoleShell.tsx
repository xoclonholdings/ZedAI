import type { ReactNode } from "react";

import type { ConsoleIdentity } from "./consoleIdentity";
import { ConsoleActivator } from "./ConsoleActivator";
import { ConsoleDock } from "./ConsoleDock";

/**
 * The ZEBULON Console Framework shell - the one composition every console
 * screen shares, regardless of galaxy: a full-viewport backdrop/content
 * layer (`children`), a floating header with the Console Activator always
 * in the same top-right spot, and the persistent ConsoleDock pinned to the
 * bottom. Callers supply the backdrop/main content and the left-hand header
 * content (home's ZAR wordmark, or a workspace's back-to-Nexus control) -
 * this component only owns the parts that must stay identical everywhere.
 */
export function ConsoleShell({
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
  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[radial-gradient(ellipse_90%_70%_at_50%_35%,#0b0620_0%,#050211_55%,#010005_100%)] text-white">
      {children}

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-4 pt-safe-sm sm:px-6 sm:pt-5">
        <div className="pointer-events-auto min-w-0">{headerLeft}</div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <ConsoleActivator active={dockPowered} onToggle={() => onDockPowerChange(!dockPowered)} accent={identity.accent} />
          {headerRightExtra}
        </div>
      </header>

      <div
        className="absolute inset-x-0 bottom-0 flex justify-center px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        data-console-region="dock"
        data-nexus-region="communication"
      >
        <div className="w-full max-w-[760px]">
          <ConsoleDock powered={dockPowered} onPowerChange={onDockPowerChange} accent={identity.accent} />
        </div>
      </div>
    </div>
  );
}
