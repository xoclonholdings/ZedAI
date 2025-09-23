import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

export interface User {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const response = await fetch("/api/auth/user", {
        credentials: "include",
      });
      
      if (response.status === 401) {
        return null;
      }
      
      if (!response.ok) {
        throw new Error("Failed to fetch user");
      }
      
      return response.json();
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (data) {
      setIsAuthenticated(true);
      setUser(data);
    } else if (data === null) {
      setIsAuthenticated(false);
      setUser(null);
    }
  }, [data]);

  return {
    isAuthenticated,
    isLoading,
    user,
    error,
  };
}