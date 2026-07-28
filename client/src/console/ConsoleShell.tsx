import type { ReactNode } from "react";

import type { ConsoleIdentity } from "./consoleIdentity";
import { ConsoleActivator } from "./ConsoleActivator";
import { ConsoleDock } from "./ConsoleDock";
import { ConsoleLogoutButton } from "./ConsoleLogoutButton";

/**
 * The ZEBULON Console Framework shell - the one composition every console
 * screen shares, regardless of galaxy: a full-viewport backdrop/content
 * layer (`children`), a floating header, and the Console Activator sitting
 * directly above the persistent ConsoleDock at the bottom - the activator
 * powers the dock, so it lives right next to what it controls rather than
 * off in the header. Callers supply the backdrop/main content and the
 * left-hand header content (home's wordmark, or a workspace's back-to-Nexus
 * control) - this component only owns the parts that must stay identical
 * everywhere.
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
        <div className="pointer-events-auto flex shrink-0 flex-col items-end gap-2">
          <ConsoleLogoutButton />
          {headerRightExtra}
        </div>
      </header>

      <div
        className="absolute inset-x-0 bottom-0 flex justify-center px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        data-console-region="dock"
        data-nexus-region="communication"
      >
        <div className="flex w-full max-w-[760px] flex-col items-center gap-2">
          <ConsoleActivator active={dockPowered} onToggle={() => onDockPowerChange(!dockPowered)} accent={identity.accent} />
          <div className="w-full">
            <ConsoleDock powered={dockPowered} onPowerChange={onDockPowerChange} accent={identity.accent} />
          </div>
        </div>
      </div>
    </div>
  );
}
