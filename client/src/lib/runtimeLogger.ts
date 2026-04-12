type RuntimeLogPayload = {
  level?: "info" | "warn" | "error";
  event: string;
  detail?: string;
  context?: Record<string, unknown>;
};

export async function logClientRuntime(payload: RuntimeLogPayload) {
  try {
    await fetch("/api/client-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
  } catch {
    // avoid recursive error loops
  }
}
