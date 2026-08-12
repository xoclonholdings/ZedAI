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
  "apps",
  "desk",
  "settings",
  "portal",
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
    currentSurfacePath: "/memory",
    consumes: ["memory_policy", "retained_memory", "evidence"],
    tags: ["memory", "retention", "evidence"],
    capabilities: [
      capability("memory", "policy", "Memory Policy", "Represent user-controlled retention rules from ZAR Core.", {
        actionKind: "configure",
        actionRoute: "/memory",
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
    id: "apps",
    label: "Apps",
    summary: "The universal access layer for Extensions installed to the unified Identity.",
    icon: "PanelsTopLeft",
    color: "#2dd4bf",
    currentSurfacePath: "/apps",
    consumes: ["identity", "extensions", "permissions"],
    tags: ["apps", "extensions", "installed-capabilities"],
    capabilities: [
      capability("apps", "extensions", "Extensions", "Open the Extensions available to the unified Identity.", {
        actionKind: "read",
        actionRoute: "/apps",
        dependencies: [
          dependency("identity.current-principal", "Extensions are installed for the unified Identity."),
          dependency("settings.permissions", "Extension access must honor user permissions."),
        ],
        terms: ["apps", "extensions", "installed", "capabilities"],
      }),
    ],
  }),
  rootManifest({
    id: "desk",
    label: "Desk",
    summary: "Operate: turn conversation into ideas, authorized tasks, and evidence-backed search.",
    icon: "FolderKanban",
    color: "#3b82f6",
    currentSurfacePath: "/desk",
    consumes: ["project_context", "research_context", "execution_context"],
    tags: ["desk", "operate", "ideas", "tasks", "search"],
    capabilities: [
      capability("desk", "operate", "Operate", "Open ZAR's specialized working domain.", {
        actionKind: "navigate",
        actionRoute: "/desk",
        dependencies: [dependency("identity.collaboration-context", "Operate consumes confirmed relationship context.")],
        terms: ["desk", "operate", "work", "project"],
      }),
      capability("desk", "ideas", "Ideas", "Capture short ideas in the user's persistent scratchpad.", {
        actionKind: "navigate",
        actionRoute: "/desk/ideas",
        dependencies: [dependency("identity.collaboration-context", "Ideas use confirmed relationship context.")],
        terms: ["ideas", "brainstorm", "possibilities", "develop"],
      }),
      capability("desk", "tasks", "Task", "Keep a shared user and ZAR to-do list with suggestions, assignments, timing, and approvals.", {
        actionKind: "execute",
        actionRoute: "/desk/task",
        dependencies: [dependency("identity.current-principal", "Tasks belong to the current user.")],
        terms: ["task", "tasks", "implement", "execute", "verify", "track"],
      }),
      capability("desk", "search", "Search", "Open the in-app browser for authorized web search and navigation.", {
        actionKind: "read",
        actionRoute: "/desk/search",
        dependencies: [dependency("knowledge.relevant-sources", "Search uses source-backed Knowledge context when available.")],
        terms: ["search", "research", "evidence", "sources", "records"],
      }),
      capability("desk", "execution-policy", "Execution Policy", "Apply permission and approval boundaries to authorized work.", {
        actionKind: "execute",
        actionRoute: null,
        dependencies: [
          dependency("identity.current-principal", "Execution must be tied to a trusted user."),
          dependency("settings.permissions", "Execution depends on permission settings."),
        ],
        terms: ["execution", "permission", "approval", "policy"],
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
  rootManifest({
    id: "portal",
    label: "Portal",
    summary: "Transport from ZAR to the ZCOS constellation and other authorized destinations.",
    icon: "Cable",
    color: "#e879f9",
    currentSurfacePath: "/",
    consumes: ["identity", "authorization", "transport"],
    tags: ["portal", "transport", "constellation", "galaxies", "command"],
    capabilities: [
      capability("portal", "constellation", "Open Constellation", "Leave ZAR Nexys and open the ZCOS constellation without moving destination content into Portal.", {
        actionKind: "navigate",
        actionRoute: "/",
        dependencies: [dependency("identity.current-principal", "Portal preserves the unified Identity during movement.")],
        terms: ["portal", "constellation", "galaxy", "transport", "command"],
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
    status: currentSurfacePath ? "active" : "scaffolded",
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
