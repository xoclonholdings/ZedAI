import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type AuthUser = {
  id?: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  isAdmin?: boolean;
};

type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function checkSession() {
    try {
      const res = await fetch("/api/me", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();
      setUser(data?.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
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
