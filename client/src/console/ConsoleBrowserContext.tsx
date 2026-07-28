import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface ConsoleBrowserContextValue {
  readonly fullPageOpen: boolean;
  readonly isLoading: boolean;
  readonly openFullPage: () => void;
  readonly closeFullPage: () => void;
  readonly setLoading: (loading: boolean) => void;
}

const ConsoleBrowserContext = createContext<ConsoleBrowserContextValue | null>(null);

/**
 * Coordinates the console's live browser between two places that don't
 * otherwise share state: the dock's compact address bar (NexusLiveBrowser)
 * and the console's main content region, where the fetched page actually
 * renders full-size (ConsoleBrowserFullPage) - same region every other
 * workspace uses, per "the full page should render as all the other pages
 * do." Scoped inside ConsoleShell itself (see ConsoleShell.tsx), so it
 * resets naturally on navigation like the rest of the console's per-route
 * state, with no app-wide wiring needed.
 */
export function ConsoleBrowserProvider({ children }: { readonly children: ReactNode }) {
  const [fullPageOpen, setFullPageOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const value = useMemo<ConsoleBrowserContextValue>(() => ({
    fullPageOpen,
    isLoading,
    openFullPage: () => setFullPageOpen(true),
    closeFullPage: () => setFullPageOpen(false),
    setLoading: setIsLoading,
  }), [fullPageOpen, isLoading]);

  return <ConsoleBrowserContext.Provider value={value}>{children}</ConsoleBrowserContext.Provider>;
}

export function useConsoleBrowser(): ConsoleBrowserContextValue {
  const ctx = useContext(ConsoleBrowserContext);
  if (!ctx) throw new Error("useConsoleBrowser must be used within a ConsoleBrowserProvider");
  return ctx;
}
