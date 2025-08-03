import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Get the appropriate backend URL based on the endpoint
function getBackendUrl(url: string): string {
  // In development, use proxy (no base URL needed)
  if (import.meta.env.DEV) {
    return url;
  }

  // In production, determine which backend to use
  const isAgentEndpoint = url.includes('/agent') ||
    url.includes('/memory') ||
    url.includes('/zed-memory') ||
    url.includes('/analytics');

  if (isAgentEndpoint) {
    return `${import.meta.env.VITE_BACKEND_URL_AGENT}${url}`;
  }

  return `${import.meta.env.VITE_BACKEND_URL_SIMPLE}${url}`;
}

export async function apiRequest(
  url: string,
  method: string,
  data?: unknown | undefined,
): Promise<any> {
  const fullUrl = getBackendUrl(url);

  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return await res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
    async ({ queryKey }) => {
      const url = queryKey.join("/") as string;
      const fullUrl = getBackendUrl(url);

      const res = await fetch(fullUrl, {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }), // Change default to returnNull
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
