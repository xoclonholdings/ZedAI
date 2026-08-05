const DEFAULT_UPLOAD_TIMEOUT_MS = 120_000;

type UploadErrorBody = {
  error?: string;
  code?: string;
};

async function responseBody(response: Response): Promise<UploadErrorBody & Record<string, unknown>> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await response.json().catch(() => ({}))) as UploadErrorBody & Record<string, unknown>;
  }

  const text = await response.text().catch(() => "");
  return text.trim() ? { error: text.trim() } : {};
}

export async function uploadRequest<T>(
  url: string,
  body: FormData,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_UPLOAD_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      body,
      signal: controller.signal,
    });
    const parsed = await responseBody(response);
    if (!response.ok) {
      throw new Error(parsed.error || `Upload failed (HTTP ${response.status}).`);
    }
    return parsed as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The upload timed out. Check your connection and try again.");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
