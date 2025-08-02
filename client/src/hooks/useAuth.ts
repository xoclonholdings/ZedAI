import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { AuthResponse, AuthState } from "@/types/auth";

export function useAuth(): AuthState {
  const { data, isLoading, error, refetch } = useQuery<AuthResponse>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 0, // Always check freshness
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Extract user from the response
  const user = data?.user || null;

  // Debug logging for authentication state
  if (process.env.NODE_ENV === 'development') {
    console.log('Auth State:', { user, isLoading, error: error?.message, isAuthenticated: !!user && !error });
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !error,
    refetch,
  };
}