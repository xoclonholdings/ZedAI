import { ArrowUpRight, Circle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

import { WORKSPACE_LABEL, type WorkspaceSlug } from "@/lib/workspaceContext";
import { useNexus } from "../state/NexusProvider";
import { createFocusedNodeView } from "../viewport/NexusViewportModel";
import { NexusIcon } from "./NexusIcon";

/**
 * The opened root application. Rendered only after the user intentionally
 * enters a node (/nexus/:nodeId) — never on the portal landing page.
 * Identity/visuals come from the node manifest; actions come from the
 * capability registry; content is live state from the existing APIs.
 */

export function NexusApplicationSurface() {
  const [, navigate] = useLocation();
  const { capabilityRegistry, viewportSnapshot } = useNexus();
  const focusedNode = viewportSnapshot.focusedNode;
  if (!focusedNode) return null;

  const view = createFocusedNodeView(focusedNode, capabilityRegistry);

  return (
    <section
      className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 backdrop-blur-xl sm:p-5"
      aria-labelledby="nexus-application-title"
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10"
          style={{ color: view.accentColor, backgroundColor: `${view.accentColor}14` }}
          aria-hidden="true"
        >
          <NexusIcon name={view.icon} size={22} />
        </div>
        <div className="min-w-0">
          <h1 id="nexus-application-title" className="text-2xl font-semibold text-white">
            {view.title}
          </h1>
          <p className="mt-1 text-sm leading-6 text-white/62">{view.summary}</p>
        </div>
      </div>

      <div className="mt-5">
        <NodeContent nodeId={view.nodeId} navigate={navigate} />
      </div>

      {view.actions.length > 0 && (
        <div className="mt-5 space-y-2">
          {view.actions.map((action) => (
            <button
              key={`${view.nodeId}:${action.label}`}
              type="button"
              onClick={() => action.route && navigate(action.route)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-black/25 px-3 py-3 text-left transition hover:border-cyan-200/35 hover:bg-white/[0.05] focus:outline-none focus:ring-2 focus:ring-cyan-200/50 motion-reduce:transition-none"
            >
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-white/88">{action.label}</span>
                <span className="mt-1 block text-[12px] leading-5 text-white/52">{action.summary}</span>
              </span>
              <ArrowUpRight size={15} className="shrink-0 text-cyan-100/65" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function NodeContent({ nodeId, navigate }: { readonly nodeId: string; readonly navigate: (route: string) => void }) {
  switch (nodeId) {
    case "identity":
      return <IdentityContent />;
    case "memory":
      return <MemoryContent />;
    case "knowledge":
      return <KnowledgeContent />;
    case "projects":
      return <ProjectsContent navigate={navigate} />;
    case "workspaces":
      return <WorkspacesContent navigate={navigate} />;
    case "tools":
      return <ToolsContent />;
    case "connect":
      return <ConnectContent />;
    case "settings":
      return <SettingsContent />;
    default:
      return null;
  }
}

function Rows({
  label,
  children,
  empty,
  loading,
}: {
  readonly label: string;
  readonly children?: React.ReactNode;
  readonly empty?: string | null;
  readonly loading?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/50">{label}</div>
      <div className="mt-2 space-y-1.5">
        {loading ? (
          <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5 text-[12px] text-white/40">Loading…</div>
        ) : (
          children ?? (empty ? <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5 text-[12px] text-white/40">{empty}</div> : null)
        )}
      </div>
    </div>
  );
}

function Row({
  title,
  detail,
  onOpen,
  dot,
}: {
  readonly title: string;
  readonly detail?: string;
  readonly onOpen?: () => void;
  readonly dot?: "ok" | "down";
}) {
  const body = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        {dot ? (
          <Circle
            size={8}
            className={dot === "ok" ? "shrink-0 fill-emerald-400 text-emerald-400" : "shrink-0 fill-red-400/70 text-red-400/70"}
            aria-label={dot === "ok" ? "Available" : "Unavailable"}
          />
        ) : null}
        <span className="truncate text-[13px] text-white/85">{title}</span>
      </span>
      {detail ? <span className="ml-2 shrink-0 truncate text-[12px] text-white/42">{detail}</span> : null}
    </>
  );
  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5 text-left transition hover:border-cyan-200/30 hover:bg-white/[0.04]"
      >
        {body}
      </button>
    );
  }
  return <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">{body}</div>;
}

function IdentityContent() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/me"] });
  const user = data?.user ?? data;
  const name = user?.personalization?.displayName || user?.firstName || user?.username;
  return (
    <Rows label="Who ZAR knows you as" loading={isLoading} empty="Sign-in details unavailable.">
      {user ? (
        <>
          <Row title={name || "Unnamed"} detail={user.email || undefined} />
          {user.personalization?.roleDescription ? <Row title={user.personalization.roleDescription} /> : null}
        </>
      ) : null}
    </Rows>
  );
}

function MemoryContent() {
  const { data, isLoading } = useQuery<{ items: Array<{ id: string; content: string; createdAt?: string }> }>({
    queryKey: ["/api/knowledge/scratchpad"],
  });
  const items = (data?.items ?? []).slice(0, 5);
  return (
    <Rows label="Recent working memory" loading={isLoading} empty="Nothing retained recently.">
      {items.length > 0
        ? items.map((item) => (
            <Row key={item.id} title={item.content.slice(0, 90)} detail={item.createdAt ? new Date(item.createdAt).toLocaleDateString() : undefined} />
          ))
        : null}
    </Rows>
  );
}

function KnowledgeContent() {
  const { data, isLoading } = useQuery<{ items: Array<{ id: string; type?: string; content?: string; title?: string; isActive?: boolean }> }>({
    queryKey: ["/api/knowledge/project-memory"],
  });
  const items = (data?.items ?? []).filter((item) => item.isActive !== false).slice(0, 5);
  return (
    <Rows label="Knowledge on file" loading={isLoading} empty="No knowledge sources yet — share a document to build the library.">
      {items.length > 0
        ? items.map((item) => (
            <Row key={item.id} title={item.title || (item.content || "").slice(0, 90) || "Knowledge entry"} detail={item.type || undefined} />
          ))
        : null}
    </Rows>
  );
}

function ProjectsContent({ navigate }: { readonly navigate: (route: string) => void }) {
  const { data, isLoading } = useQuery<{ projects: Array<{ id: string; name: string; updatedAt?: string }> }>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load projects");
      return res.json();
    },
  });
  const projects = (data?.projects ?? []).slice(0, 5);
  return (
    <Rows label="Your projects" loading={isLoading} empty="No projects yet.">
      {projects.length > 0
        ? projects.map((project) => (
            <Row
              key={project.id}
              title={project.name}
              detail={project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : undefined}
              onOpen={() => navigate(`/projects/${project.id}`)}
            />
          ))
        : null}
    </Rows>
  );
}

function WorkspacesContent({ navigate }: { readonly navigate: (route: string) => void }) {
  const entries = Object.entries(WORKSPACE_LABEL) as Array<[WorkspaceSlug, string]>;
  return (
    <Rows label="Enter a workspace">
      {entries.map(([slug, label]) => (
        <Row key={slug} title={label} onOpen={() => navigate(`/workspaces/${slug}`)} />
      ))}
    </Rows>
  );
}

function ToolsContent() {
  const { data, isLoading } = useQuery<{ capabilities: Array<{ id: string; name: string; category: string }> }>({
    queryKey: ["/api/capabilities"],
  });
  const { data: healthData } = useQuery<{ health: Array<{ id: string; available: boolean }> }>({
    queryKey: ["/api/capabilities/health"],
  });
  const health = new Map((healthData?.health ?? []).map((h) => [h.id, h.available]));
  const capabilities = (data?.capabilities ?? []).slice(0, 8);
  return (
    <Rows label="Executable capabilities" loading={isLoading} empty="No capabilities registered.">
      {capabilities.length > 0
        ? capabilities.map((capability) => (
            <Row
              key={capability.id}
              title={capability.name}
              detail={capability.category.replace(/_/g, " ")}
              dot={health.size === 0 ? undefined : health.get(capability.id) ? "ok" : "down"}
            />
          ))
        : null}
    </Rows>
  );
}

function ConnectContent() {
  const { data, isLoading } = useQuery<{ health: Array<{ id: string; available: boolean; detail?: string }> }>({
    queryKey: ["/api/capabilities/health"],
  });
  const providers = (data?.health ?? []).filter((h) =>
    ["documentation.retrieve_library_docs", "web_research.fetch_url", "browser.session"].includes(h.id),
  );
  const labels: Record<string, string> = {
    "documentation.retrieve_library_docs": "Documentation provider",
    "web_research.fetch_url": "Web research",
    "browser.session": "Browser automation",
  };
  return (
    <Rows label="Connected services" loading={isLoading} empty="No service status available.">
      {providers.length > 0
        ? providers.map((provider) => (
            <Row
              key={provider.id}
              title={labels[provider.id] || provider.id}
              detail={provider.available ? "Available" : provider.detail || "Unavailable"}
              dot={provider.available ? "ok" : "down"}
            />
          ))
        : null}
    </Rows>
  );
}

function SettingsContent() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/settings/personalization"] });
  const personalization = data?.personalization ?? data ?? {};
  const entries = [
    personalization.displayName ? { key: "Display name", value: String(personalization.displayName) } : null,
    personalization.tone ? { key: "Tone", value: String(personalization.tone) } : null,
    personalization.roleDescription ? { key: "About you", value: String(personalization.roleDescription) } : null,
  ].filter((entry): entry is { key: string; value: string } => Boolean(entry));
  return (
    <Rows label="Preferences" loading={isLoading} empty="No preferences saved yet.">
      {entries.length > 0 ? entries.map((entry) => <Row key={entry.key} title={entry.key} detail={entry.value.slice(0, 60)} />) : null}
    </Rows>
  );
}
