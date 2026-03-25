import { useEffect, useState } from "react";
import { getLocalSession, clearLocalSession } from "./localSession";

type AuthState = {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: any | null;
};

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    user: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const localUser = getLocalSession();

      if (localUser && !cancelled) {
        setState({
          isLoading: false,
          isAuthenticated: true,
          user: localUser,
        });
        return;
      }

      try {
        const response = await fetch("/api/auth/user", {
          credentials: "include",
        });

        if (!response.ok) throw new Error();

        const user = await response.json();

        if (!cancelled) {
          setState({
            isLoading: false,
            isAuthenticated: true,
            user,
          });
        }
      } catch {
        if (!cancelled) {
          clearLocalSession();
          setState({
            isLoading: false,
            isAuthenticated: false,
            user: null,
          });
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}