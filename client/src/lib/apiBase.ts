const rawApiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  import.meta.env.VITE_API_URL?.trim() ||
  "";

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

export function getApiBaseUrl() {
  return rawApiBaseUrl ? normalizeBaseUrl(rawApiBaseUrl) : "";
}

export function buildApiUrl(path: string) {
  if (!path.startsWith("/")) {
    return path;
  }

  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    return path;
  }

  if (path.startsWith("/api/") || path === "/api" || path.startsWith("/uploads/")) {
    return `${apiBaseUrl}${path}`;
  }

  return path;
}

export function installApiBaseFetchShim() {
  if (typeof window === "undefined") {
    return;
  }

  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    return;
  }

  const currentOrigin = window.location.origin;
  if (apiBaseUrl === currentOrigin) {
    return;
  }

  const originalFetch = window.fetch.bind(window);

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string") {
      return originalFetch(buildApiUrl(input), init);
    }

    if (input instanceof URL) {
      return originalFetch(new URL(buildApiUrl(input.pathname + input.search + input.hash)), init);
    }

    return originalFetch(input, init);
  }) as typeof window.fetch;
}
