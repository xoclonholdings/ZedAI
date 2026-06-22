import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { apiFetch, readJsonResponse } from "@/lib/apiClient";

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
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function checkSession() {
    try {
      const res = await apiFetch("/api/me");
      const data = await readJsonResponse(res);
      setUser(data?.user ?? null);
    } catch (_error) {
      setUser(null);
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
    setUser(null);
  }

  useEffect(() => {
    checkSession();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
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
