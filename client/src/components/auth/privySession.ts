import { apiFetch, readJsonResponse } from "../../lib/apiClient";

type AccessTokenReader = () => Promise<string | null>;
type FetchSession = (
  path: string,
  init: RequestInit,
) => Promise<Response>;

export async function establishPrivySession(
  getAccessToken: AccessTokenReader,
  fetchSession: FetchSession = (path, init) => apiFetch(path, init),
): Promise<void> {
  const accessToken = (await getAccessToken())?.trim();
  if (!accessToken) {
    throw new Error("Privy did not return an access token. Sign in again.");
  }

  const response = await fetchSession("/api/auth/privy/session", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = await readJsonResponse<{ success?: boolean; error?: string }>(response);
  if (!response.ok || !data.success) {
    throw new Error(data.error || "ZAR could not verify this Privy session.");
  }
}
