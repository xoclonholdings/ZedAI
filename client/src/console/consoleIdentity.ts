/**
 * The ZEBULON Console Framework is galaxy-agnostic: every application galaxy
 * (ZAR, ZETA, ZYNC, ZWAP!, ZENO) gets its own console identity plugged into
 * the same ConsoleShell/ConsoleDock/ConsoleActivator components. Only ZAR's
 * console (NEXUS) is actually wired up today - the other galaxies don't have
 * an application behind them yet.
 */
export interface ConsoleIdentity {
  readonly galaxy: string;
  readonly console: string;
  readonly accent: string;
}

export const ZAR_NEXUS_CONSOLE: ConsoleIdentity = {
  galaxy: "ZAR",
  console: "NEXUS",
  accent: "#a78bfa",
};
