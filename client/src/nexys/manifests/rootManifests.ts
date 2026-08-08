import type { NexysApplicationBoundary } from "../apps/types";
import type {
  NexysCapabilityAction,
  NexysCapabilityDefinition,
  NexysCapabilityDependency,
  NexysCapabilityPermission,
  NexysCapabilityStatus,
} from "../capabilities/types";
import type { NexysNodeId } from "../graph/types";
import { NexysManifestRegistry } from "./NexysManifestRegistry";
import type { NexysNodeManifest } from "./types";

export const NEXYS_ROOT_NODE_IDS = [
  "identity",
  "memory",
  "knowledge",
  "workspaces",
  "projects",
  "tools",
  "connect",
  "settings",
] as const;

export type NexysRootNodeId = (typeof NEXYS_ROOT_NODE_IDS)[number];

export const NEXYS_ROOT_MANIFESTS: readonly NexysNodeManifest[] = [
  rootManifest({
    id: "identity",
    label: "Identity",
    summary: "The user's relationship-owned identity and self-authored personal notes.",
    icon: "Fingerprint",
    color: "#22d3ee",
    currentSurfacePath: "/identity",
    consumes: ["constitution", "identity", "reflection"],
    tags: ["constitution", "self-understanding", "ownership"],
    capabilities: [
      capability("identity", "current-principal", "Current Principal", "Use the trusted authenticated identity supplied by ZAR Core.", {
        actionKind: "read",
        actionRoute: null,
        terms: ["identity", "user", "principal", "owner"],
      }),
      capability("identity", "constitution-review", "Personal Notes", "Review and write the personal notes ZAR retrieves as context about you.", {
        actionKind: "review",
        actionRoute: "/identity",
        dependencies: [dependency("identity.current-principal", "Personal understanding must be owned by the current user.")],
        terms: ["notes", "review", "understanding", "reflection", "personalization"],
      }),
      capability("identity", "collaboration-context", "Collaboration Context", "Expose confirmed understanding as non-duplicated ZAR Core context.", {
        actionKind: "read",
        actionRoute: null,
        dependencies: [
          dependency("identity.constitution-review", "Confirmed understanding originates from the user's personal notes."),
          dependency("memory.policy", "Memory policy constrains retained relationship context."),
        ],
        terms: ["collaboration", "context", "confirmed", "working style"],
      }),
    ],
  }),
  rootManifest({
    id: "memory",
    label: "Memory",
    summary: "The governed retention policy for what ZAR keeps, revises, and forgets.",
    icon: "Brain",
    color: "#a78bfa",
    // No dedicated page yet — the object browser this used to point at
    // (/learning) was a duplicate of the Knowledge hub's own page and has
    // been merged there (see knowledge.tsx). Memory's real, distinct job is
    // retention/privacy policy, which isn't built yet; this stays null
    // rather than pointing at a page it doesn't actually own.
    currentSurfacePath: null,
    consumes: ["memory_policy", "retained_memory", "evidence"],
    tags: ["memory", "retention", "evidence"],
    capabilities: [
      capability("memory", "policy", "Memory Policy", "Represent user-controlled retention rules from ZAR Core.", {
        actionKind: "configure",
        actionRoute: "/nexys/memory",
        dependencies: [dependency("identity.current-principal", "Memory policy belongs to the current user.")],
        terms: ["memory", "policy", "privacy", "retention"],
      }),
      capability("memory", "relevant-context", "Relevant Memory Context", "Expose retained authoritative memory as context without making retrieval authoritative.", {
        actionKind: "read",
        // Not this hub's own page — Knowledge (/knowledge) is where a human
        // actually browses/teaches retained memory now. This capability
        // exposes it as context to the reasoning pipeline, not a nav target.
        actionRoute: null,
        dependencies: [dependency("memory.policy", "Relevant memory must honor the user's policy.")],
        terms: ["memory", "context", "continuity", "evidence"],
      }),
    ],
  }),
  rootManifest({
    id: "knowledge",
    label: "Knowledge",
    summary: "The source-backed knowledge and relationship graph surface.",
    icon: "Network",
    color: "#60a5fa",
    currentSurfacePath: "/knowledge",
    consumes: ["knowledge_authority", "retrieval_context"],
    tags: ["knowledge", "sources", "graph"],
    capabilities: [
      capability("knowledge", "source-library", "Source Library", "Represent authoritative knowledge records and source references.", {
        actionKind: "read",
        actionRoute: "/knowledge",
        dependencies: [dependency("identity.current-principal", "Knowledge access remains owner-aware.")],
        terms: ["knowledge", "source", "library", "record"],
      }),
      capability("knowledge", "relevant-sources", "Relevant Sources", "Expose source-backed knowledge references for scoped work.", {
        actionKind: "read",
        actionRoute: null,
        dependencies: [dependency("knowledge.source-library", "Relevant source context derives from the source library.")],
        terms: ["retrieval", "source", "context", "evidence"],
      }),
    ],
  }),
  rootManifest({
    id: "workspaces",
    label: "Workspaces",
    summary: "Domain operating spaces that receive ZAR Core context without owning it.",
    icon: "PanelsTopLeft",
    color: "#2dd4bf",
    currentSurfacePath: "/workspace",
    consumes: ["relationship_contract", "scope"],
    tags: ["domains", "scope", "operating-spaces"],
    capabilities: [
      capability("workspaces", "scope", "Workspace Scope", "Hold the active domain scope for contextual navigation.", {
        actionKind: "read",
        actionRoute: "/workspace",
        dependencies: [dependency("identity.collaboration-context", "Workspace behavior consumes confirmed relationship context.")],
        terms: ["workspace", "domain", "scope", "mode"],
      }),
      capability("workspaces", "switcher", "Workspace Switcher", "List and navigate between every domain operating space.", {
        actionKind: "navigate",
        actionRoute: "/workspace",
        dependencies: [dependency("workspaces.scope", "Switching operates over workspace scope.")],
        terms: ["workspace", "switch", "domain", "navigation"],
      }),
    ],
  }),
  rootManifest({
    id: "projects",
    label: "Projects",
    summary: "User-owned project context, evidence, and execution continuity.",
    icon: "FolderKanban",
    color: "#3b82f6",
    currentSurfacePath: "/projects",
    consumes: ["ownership", "project_context"],
    tags: ["projects", "execution", "context"],
    capabilities: [
      capability("projects", "current-context", "Current Project Context", "Expose selected user-owned project context to Nexys consumers.", {
        actionKind: "read",
        actionRoute: "/projects",
        dependencies: [
          dependency("identity.current-principal", "Projects are user-owned."),
          dependency("workspaces.scope", "Projects may be scoped by workspace."),
        ],
        terms: ["project", "context", "ownership", "continuity"],
      }),
      capability("projects", "navigation", "Project Navigation", "Navigate existing project surfaces without moving project authority.", {
        actionKind: "navigate",
        actionRoute: "/projects",
        dependencies: [dependency("projects.current-context", "Project navigation uses the project context boundary.")],
        terms: ["project", "navigate", "execution", "detail"],
      }),
    ],
  }),
  rootManifest({
    id: "tools",
    label: "Tools",
    summary: "Capability and workflow entry points governed by permissions and execution policy.",
    icon: "Wrench",
    color: "#fb923c",
    currentSurfacePath: "/flows",
    consumes: ["permissions", "execution_context"],
    tags: ["tools", "automation", "workflow"],
    capabilities: [
      capability("tools", "execution-policy", "Execution Policy", "Represent permission-aware tool execution boundaries.", {
        actionKind: "execute",
        actionRoute: null,
        dependencies: [
          dependency("identity.current-principal", "Tool execution must be tied to a trusted user."),
          dependency("settings.permissions", "Execution depends on permission settings."),
        ],
        terms: ["tools", "execution", "permission", "policy"],
      }),
      capability("tools", "workflow-catalog", "Workflow Catalog", "Navigate current workflow and flow surfaces through the Tools root.", {
        actionKind: "navigate",
        actionRoute: "/flows",
        dependencies: [dependency("tools.execution-policy", "Workflow actions require execution policy.")],
        terms: ["tools", "flows", "workflow", "automation"],
      }),
    ],
  }),
  rootManifest({
    id: "connect",
    label: "Connect",
    summary: "External accounts and providers ZAR can act in on your behalf.",
    icon: "Cable",
    color: "#e879f9",
    currentSurfacePath: "/connect",
    consumes: ["authorization", "provider_context"],
    tags: ["providers", "channels", "integration"],
    capabilities: [
      capability("connect", "provider-accounts", "Provider Accounts", "Connect and manage external accounts through the real per-user integrations surface.", {
        actionKind: "connect",
        actionRoute: "/connect",
        dependencies: [
          dependency("identity.current-principal", "Connections belong to the current user."),
          dependency("settings.permissions", "Provider access must honor user permissions."),
        ],
        terms: ["connect", "provider", "account", "authorization"],
      }),
      capability("connect", "channels", "Connection Channels", "Reserve channel routing for future ecosystem communication surfaces.", {
        actionKind: "connect",
        actionRoute: null,
        dependencies: [dependency("connect.provider-accounts", "Channels depend on authorized provider accounts.")],
        status: "scaffolded",
        terms: ["connect", "channel", "integration", "external"],
      }),
    ],
  }),
  rootManifest({
    id: "settings",
    label: "Settings",
    summary: "User-controlled preferences, privacy boundaries, and account configuration.",
    icon: "Settings",
    color: "#38bdf8",
    currentSurfacePath: "/settings",
    consumes: ["configuration", "privacy", "permissions"],
    tags: ["settings", "privacy", "configuration"],
    capabilities: [
      capability("settings", "privacy", "Privacy Settings", "Manage retention and privacy-relevant preferences through the real Settings surface.", {
        actionKind: "configure",
        actionRoute: "/settings",
        dependencies: [dependency("identity.current-principal", "Privacy settings belong to the current user.")],
        terms: ["settings", "privacy", "retention", "control"],
      }),
      capability("settings", "permissions", "Permission Settings", "Manage sign-in, session, and account permissions through the real Settings surface.", {
        actionKind: "configure",
        actionRoute: "/settings",
        dependencies: [dependency("identity.current-principal", "Permission settings are owned by the current user.")],
        terms: ["settings", "permissions", "authorization", "access"],
      }),
    ],
  }),
];

export const nexysRootManifestRegistry = new NexysManifestRegistry(NEXYS_ROOT_MANIFESTS);

export function isNexysRootNodeId(value: string | undefined | null): value is NexysRootNodeId {
  return Boolean(value && (NEXYS_ROOT_NODE_IDS as readonly string[]).includes(value));
}

function rootManifest(input: {
  readonly id: NexysRootNodeId;
  readonly label: string;
  readonly summary: string;
  readonly icon: string;
  readonly color: string;
  readonly currentSurfacePath: string | null;
  readonly consumes: readonly string[];
  readonly tags: readonly string[];
  readonly capabilities: readonly NexysCapabilityDefinition[];
}): NexysNodeManifest {
  return {
    id: input.id,
    label: input.label,
    kind: "root",
    parentId: null,
    application: application(input.id, input.label, input.currentSurfacePath, input.consumes),
    discovery: {
      summary: input.summary,
      tags: input.tags,
      searchableTerms: [input.id, input.label.toLowerCase(), ...input.tags],
    },
    visual: {
      icon: input.icon,
      color: input.color,
      orbit: 1,
    },
    defaultExpanded: input.id === "identity",
    capabilities: input.capabilities,
    metadata: {
      permanentRoot: true,
    },
  };
}

function application(
  nodeId: NexysRootNodeId,
  label: string,
  currentSurfacePath: string | null,
  consumes: readonly string[],
): NexysApplicationBoundary {
  return {
    id: `${nodeId}-application`,
    nodeId,
    label,
    basePath: `/nexys/${nodeId}`,
    routePattern: `/nexys/${nodeId}/:view?`,
    stateNamespace: `nexys.${nodeId}`,
    ownsState: true,
    status: "scaffolded",
    consumes: ["zar-core", ...consumes],
    currentSurfacePath,
    notes: [
      "Application boundary reserved.",
      "State ownership is isolated to this namespace.",
      "ZAR Core remains the source for relationship intelligence.",
    ],
  };
}

function capability(
  nodeId: NexysRootNodeId,
  capabilityName: string,
  label: string,
  summary: string,
  options: {
    readonly actionKind: NexysCapabilityAction["kind"];
    readonly actionRoute: string | null;
    readonly dependencies?: readonly NexysCapabilityDependency[];
    readonly status?: NexysCapabilityStatus;
    readonly terms: readonly string[];
  },
): NexysCapabilityDefinition {
  const id = `${nodeId}.${capabilityName}`;
  return {
    id,
    owner: {
      kind: "node",
      id: nodeId,
    },
    owningNodeId: nodeId,
    label,
    category: nodeId,
    status: options.status ?? "available",
    actions: [
      {
        id: `${id}.primary`,
        label,
        kind: options.actionKind,
        route: options.actionRoute,
        enabled: Boolean(options.actionRoute),
      },
    ],
    dependencies: options.dependencies ?? [],
    permissions: [authenticatedPermission()],
    searchable: {
      summary,
      terms: [...options.terms],
      aliases: [],
    },
    metadata: {
      permanentRootCapability: true,
      ownerNode: nodeId,
    },
  };
}

function dependency(capabilityId: string, reason: string): NexysCapabilityDependency {
  return {
    capabilityId,
    required: true,
    reason,
  };
}

function authenticatedPermission(): NexysCapabilityPermission {
  return {
    id: "kernel.authenticated",
    label: "Authenticated user",
    source: "kernel",
    required: true,
  };
}

export function isNexysManifestNodeId(value: NexysNodeId): value is NexysRootNodeId {
  return isNexysRootNodeId(value);
}
