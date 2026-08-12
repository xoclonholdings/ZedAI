import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";

import { useNexysChatSession } from "./useNexysChatSession";

type NexysConsoleChatSession = ReturnType<typeof useNexysChatSession>;
type NexysModeActionHandler = (modeId: string) => void;

interface NexysConsoleChatContextValue extends NexysConsoleChatSession {
  readonly registerModeAction: (handler: NexysModeActionHandler) => () => void;
}

const NexysConsoleChatContext = createContext<NexysConsoleChatContextValue | null>(null);

function conversationIdFromLocation(location: string): string | undefined {
  const match = /^\/chat\/([^/?#]+)/.exec(location);
  if (!match?.[1]) return undefined;
  return decodeURIComponent(match[1]);
}

/**
 * Owns the one persistent NEXYS conversation session used by both the Dock
 * composer and the display-only conversation screen. It lives above the
 * router so navigation from a Console screen into /chat/:id does not replace
 * the controller while a request is in flight.
 */
export function NexysConsoleChatProvider({ children }: { readonly children: ReactNode }) {
  const [location, navigate] = useLocation();
  const modeActionRef = useRef<NexysModeActionHandler | null>(null);
  const routeConversationId = conversationIdFromLocation(location);

  const handleModeAction = useCallback((modeId: string) => {
    modeActionRef.current?.(modeId);
  }, []);

  const handleConversationStart = useCallback((conversationId: string) => {
    const route = `/chat/${conversationId}`;
    if (location !== route) navigate(route);
  }, [location, navigate]);

  const session = useNexysChatSession(routeConversationId, {
    onModeAction: handleModeAction,
    onConversationStart: handleConversationStart,
  });

  const registerModeAction = useCallback((handler: NexysModeActionHandler) => {
    modeActionRef.current = handler;
    return () => {
      if (modeActionRef.current === handler) modeActionRef.current = null;
    };
  }, []);

  const value = useMemo<NexysConsoleChatContextValue>(() => ({
    ...session,
    registerModeAction,
  }), [registerModeAction, session]);

  return (
    <NexysConsoleChatContext.Provider value={value}>
      {children}
    </NexysConsoleChatContext.Provider>
  );
}

export function useNexysConsoleChat(): NexysConsoleChatContextValue {
  const value = useContext(NexysConsoleChatContext);
  if (!value) {
    throw new Error("useNexysConsoleChat must be used within NexysConsoleChatProvider");
  }
  return value;
}
