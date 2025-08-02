import { useState, useEffect } from "react";

export function useAuthMock() {
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for existing auth
    const savedAuth = localStorage.getItem('zed_auth');
    if (savedAuth) {
      try {
        const authData = JSON.parse(savedAuth);
        setUser(authData.user);
      } catch (e) {
        localStorage.removeItem('zed_auth');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    // Mock authentication
    if (username === "Admin" && password === "Zed2025") {
      const authData = {
        user: { username },
        verified: false,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('zed_auth', JSON.stringify(authData));
      setUser(authData.user);
      return { success: true };
    }
    return { success: false, reason: "Invalid credentials" };
  };

  const logout = () => {
    localStorage.removeItem('zed_auth');
    setUser(null);
  };

  const refetch = () => {
    const savedAuth = localStorage.getItem('zed_auth');
    if (savedAuth) {
      try {
        const authData = JSON.parse(savedAuth);
        setUser(authData.user);
      } catch (e) {
        localStorage.removeItem('zed_auth');
        setUser(null);
      }
    } else {
      setUser(null);
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refetch,
  };
}
