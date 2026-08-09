const DEFAULT_TIMEOUT_MS = 15000;

let apiFetchPatchInstalled = false;

function getApiBaseUrl() {
  const rawBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || "";
  return rawBaseUrl.replace(/\/$/, "");
}

export function buildApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const apiBaseUrl = getApiBaseUrl();
  return apiBaseUrl ? `${apiBaseUrl}${normalizedPath}` : normalizedPath;
}

function shouldRouteThroughApiBase(input: RequestInfo | URL) {
  if (typeof input === "string") return input.startsWith("/api/");
  if (input instanceof URL) return input.pathname.startsWith("/api/") && !input.origin.includes(window.location.host);
  return input.url.startsWith("/api/");
}

function rewriteApiInput(input: RequestInfo | URL): RequestInfo | URL {
  if (!getApiBaseUrl() || !shouldRouteThroughApiBase(input)) return input;

  if (typeof input === "string") return buildApiUrl(input);
  if (input instanceof URL) return new URL(buildApiUrl(`${input.pathname}${input.search}`));

  return new Request(buildApiUrl(input.url), input);
}

export function installApiFetchPatch() {
  if (apiFetchPatchInstalled || !getApiBaseUrl()) return;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    return nativeFetch(rewriteApiInput(input), {
      ...init,
      credentials: init?.credentials ?? "include",
      cache: init?.cache ?? "no-store",
    });
  };

  apiFetchPatchInstalled = true;
}

export async function apiFetch(path: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(buildApiUrl(path), {
      ...init,
      credentials: init.credentials ?? "include",
      cache: init.cache ?? "no-store",
      signal: init.signal ?? controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("ZAR backend did not respond. Check the API deploy and API base URL.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function readJsonResponse<T = any>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("ZAR backend returned a non-JSON response. Check the API route or deploy configuration.");
  }

  return response.json() as Promise<T>;
}
