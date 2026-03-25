import { useEffect, useState } from "react";

type AuthUser = {
  username: string;
};

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const res = await fetch("/api/me", {
        credentials: "include",
      });

      const data = await res.json();

      if (data?.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    refresh: checkSession,
  };
}