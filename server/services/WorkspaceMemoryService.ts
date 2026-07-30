import { readAppliedGraph, resolveObjectMemoryUserId } from "./object-memory/store";

/**
 * Workspace-memory retrieval.
 *
 * Whenever ZAR works on a request inside a workspace, it must first run
 * through that user's workspace knowledge so its work is grounded in what
 * they taught ZAR there.
 *
 * Objects added through a workspace library carry
 * `properties.workspace = <slug>`. This service pulls the current user's
 * slice, ranks it against the request, and formats a prompt block that gets
 * injected ahead of general knowledge.
 */

export interface WorkspaceMemoryContext {
  prompt: string;
  count: number;
  used: boolean;
}

const MAX_ITEMS = 14;

function tokens(text: string): string[] {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

export async function buildWorkspaceMemoryContext(
  workspace: string | undefined,
  query: string,
  userId?: string,
  isAdmin?: boolean,
): Promise<WorkspaceMemoryContext> {
  const slug = String(workspace || "").trim();
  if (!slug) return { prompt: "", count: 0, used: false };

  const memoryUserId = await resolveObjectMemoryUserId(userId, { isAdmin }).catch(() => userId);
  const graph = await readAppliedGraph(memoryUserId ? { userId: memoryUserId } : undefined).catch(() => null);
  if (!graph || !Array.isArray(graph.objects)) {
    return { prompt: "", count: 0, used: false };
  }

  const mine = graph.objects.filter(
    (o: any) => (o?.properties?.workspace || "") === slug && o?.status !== "archived",
  );
  if (mine.length === 0) return { prompt: "", count: 0, used: false };

  // Rank by overlap with the request, falling back to most recent.
  const q = new Set(tokens(query));
  const ranked = [...mine]
    .map((o: any) => {
      const hay = tokens(`${o.canonicalName} ${o.summary} ${(o.aliases || []).join(" ")}`);
      const score = hay.reduce((s, t) => s + (q.has(t) ? 1 : 0), 0);
      return { o, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(b.o.updatedAt || "").localeCompare(String(a.o.updatedAt || ""));
    })
    .slice(0, MAX_ITEMS)
    .map(({ o }) => o);

  const lines = ranked.map((o: any) => {
    const summary = String(o.summary || "").replace(/\s+/g, " ").trim().slice(0, 240);
    return `- ${o.canonicalName}${summary ? `: ${summary}` : ""}`;
  });

  const prompt = [
    `## Workspace memory — ${slug} (${mine.length} item${mine.length === 1 ? "" : "s"})`,
    `Before you do anything, ground this request in what the user has taught ZAR in the ${slug} workspace. Use it as authoritative context; if it conflicts with a general assumption, the workspace knowledge wins. Do not restate it unless asked.`,
    "",
    ...lines,
  ].join("\n");

  return { prompt, count: mine.length, used: true };
}
