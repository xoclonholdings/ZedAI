import type { AgentTarget } from "@shared/schema";

/**
 * Persistent workspace context.
 *
 * A workspace is "entered" when the user clicks Ask ZAR in <Workspace>
 * on a workspace page, or when they hit a URL with ?ctx=<slug>. Once
 * entered, the workspace sticks until the user exits it — chat requests
 * carry the workspace's AgentTarget so ZAR routes into the right lane,
 * and the chat header shows what workspace they're in.
 *
 * Precedence for reading the active context:
 *   1. URL query ?ctx=<slug>  (fresh nav wins — allows deep links)
 *   2. localStorage           (survives page reload)
 *
 * Precedence for writing:
 *   - URL adds/removes ?ctx=  so links can be shared
 *   - localStorage is written every time we resolve a context so the
 *     next full reload picks it up
 */

const STORAGE_KEY = "zar.workspaceContext";

export const WORKSPACE_SLUGS = [
  "research",
  "operations",
  "finance",
  "marketing",
  "education",
] as const;

export type WorkspaceSlug = (typeof WORKSPACE_SLUGS)[number];

export const WORKSPACE_AGENT: Record<WorkspaceSlug, AgentTarget> = {
  research: "research",
  operations: "operations",
  finance: "finance",
  marketing: "business",
  education: "operations",
};

export const WORKSPACE_LABEL: Record<WorkspaceSlug, string> = {
  research: "Research",
  operations: "Operations",
  finance: "Finance",
  marketing: "Marketing",
  education: "Education",
};

function isSlug(v: unknown): v is WorkspaceSlug {
  return typeof v === "string" && (WORKSPACE_SLUGS as readonly string[]).includes(v);
}

export function readWorkspaceFromUrl(search: string): WorkspaceSlug | null {
  try {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const raw = params.get("ctx");
    return isSlug(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function readWorkspaceFromStorage(): WorkspaceSlug | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isSlug(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function persistWorkspace(slug: WorkspaceSlug | null): void {
  try {
    if (slug) window.localStorage.setItem(STORAGE_KEY, slug);
  } catch {
    // best effort
  }
}

export function resolveWorkspace(search: string): WorkspaceSlug | null {
  return readWorkspaceFromUrl(search) || readWorkspaceFromStorage();
}
