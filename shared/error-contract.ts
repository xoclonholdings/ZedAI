export interface ZarErrorDetail {
  code: string;
  userMessage: string;
  exactReason: string;
  action: string;
  technicalDetails?: Record<string, unknown>;
}

export function zarErrorMessage(error: ZarErrorDetail | undefined, fallback: string): string {
  if (!error) return fallback;
  const parts = [error.userMessage, `Exact error: ${error.exactReason}`];
  if (error.action) parts.push(`Action: ${error.action}`);
  return parts.filter(Boolean).join("\n");
}
