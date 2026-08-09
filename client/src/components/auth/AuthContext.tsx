import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { apiFetch, readJsonResponse } from "@/lib/apiClient";
import { establishPrivySession } from "./privySession";

type AuthUser = {
  id?: string;
  username: string;
  displayName?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  isAdmin?: boolean;
  personalization?: {
    displayName?: string;
    preferredLanguage?: string;
    colorScheme?: string;
    compactMessages?: boolean;
    showTimestamps?: boolean;
    fontSize?: string;
  };
};

type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export type ExternalAuthAdapter = {
  ready: boolean;
  authenticated: boolean;
  userId: string | null;
  getAccessToken: () => Promise<string | null>;
  logout: () => Promise<void>;
};

export function AuthProvider({
  children,
  externalAuth,
}: {
  children: ReactNode;
  externalAuth?: ExternalAuthAdapter;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const synchronizedPrivyUserRef = useRef<string | null>(null);
  const synchronizationRef = useRef<Promise<AuthUser | null> | null>(null);

  async function readSession(): Promise<AuthUser | null> {
    try {
      const res = await apiFetch("/api/me");
      const data = await readJsonResponse(res);
      return data?.user ?? null;
    } catch (_error) {
      return null;
    }
  }

  async function synchronizeSession(): Promise<AuthUser | null> {
    let sessionUser = await readSession();
    if (
      !sessionUser &&
      externalAuth?.ready &&
      externalAuth.authenticated &&
      externalAuth.userId &&
      synchronizedPrivyUserRef.current !== externalAuth.userId
    ) {
      if (!synchronizationRef.current) {
        synchronizationRef.current = establishPrivySession(externalAuth.getAccessToken)
          .then(async () => {
            const establishedSession = await readSession();
            if (!establishedSession) {
              throw new Error("ZAR could not establish the secure session.");
            }
            synchronizedPrivyUserRef.current = externalAuth.userId;
            return establishedSession;
          })
          .finally(() => {
            synchronizationRef.current = null;
          });
      }
      sessionUser = await synchronizationRef.current;
    }
    return sessionUser;
  }

  async function checkSession() {
    setIsLoading(true);
    setAuthError("");
    try {
      const sessionUser = await synchronizeSession();
      setUser(sessionUser);
    } catch (error) {
      setUser(null);
      setAuthError(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    try {
      await apiFetch("/api/logout", { method: "POST" });
    } catch (_error) {
      // Logout should still clear local UI state if the API is unreachable.
    }
    try {
      await externalAuth?.logout();
    } catch (_error) {
      // The local session is already gone; keep the UI signed out truthfully.
    }
    synchronizedPrivyUserRef.current = null;
    synchronizationRef.current = null;
    setAuthError("");
    setUser(null);
  }

  useEffect(() => {
    let active = true;

    async function initialize() {
      if (externalAuth && !externalAuth.ready) return;
      setIsLoading(true);

      setAuthError("");
      let sessionUser: AuthUser | null = null;
      try {
        sessionUser = await synchronizeSession();
      } catch (error) {
        if (active) {
          setAuthError(error instanceof Error ? error.message : "Sign-in failed.");
        }
      }

      if (!active) return;
      setUser(sessionUser);
      setIsLoading(false);
    }

    void initialize();
    return () => {
      active = false;
    };
  }, [
    externalAuth?.ready,
    externalAuth?.authenticated,
    externalAuth?.userId,
  ]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        authError,
        refresh: checkSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
