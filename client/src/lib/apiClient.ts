const DEFAULT_TIMEOUT_MS = 15000;

function getApiBaseUrl() {
  const rawBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || "";
  return rawBaseUrl.replace(/\/$/, "");
}

function buildApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const apiBaseUrl = getApiBaseUrl();
  return apiBaseUrl ? `${apiBaseUrl}${normalizedPath}` : normalizedPath;
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
      throw new Error("ZED backend did not respond. Check the API deploy and API base URL.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function readJsonResponse<T = any>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error("ZED backend returned a non-JSON response. Check the API route or deploy configuration.");
  }

  return response.json() as Promise<T>;
}
