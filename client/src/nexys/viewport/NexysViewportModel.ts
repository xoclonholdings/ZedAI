import type { NexysCapabilityRegistry } from "../capabilities/NexysCapabilityRegistry";
import type { NexysCapabilityDefinition } from "../capabilities/types";
import { isNexysCapabilityActionAvailable } from "../capabilities/capabilityAvailability";
import type { PersistentCommunicationManifest } from "../communication/types";
import type {
  NexysConnectionDefinition,
  NexysCoordinate2D,
  NexysGraphSnapshot,
  NexysNodeDefinition,
  NexysNodeId,
} from "../graph/types";

export type NexysViewportNavigationSource =
  | "initial"
  | "route"
  | "touch"
  | "keyboard"
  | "zar"
  | "programmatic";

export type NexysVisibleNodePresence = "focused" | "near" | "edge";

export interface NexysViewportState {
  readonly focusedNodeId: NexysNodeId | null;
  readonly previousNodeId: NexysNodeId | null;
  readonly offset: NexysCoordinate2D;
  readonly navigationSource: NexysViewportNavigationSource;
  readonly transitionSerial: number;
}

export interface NexysVisibleNode {
  readonly node: NexysNodeDefinition;
  readonly position: NexysCoordinate2D;
  readonly presence: NexysVisibleNodePresence;
  readonly relativeIndex: number;
  readonly interactive: boolean;
}

export interface NexysVisibleConnection {
  readonly id: string;
  readonly sourceId: NexysNodeId;
  readonly targetId: NexysNodeId;
  readonly kind: NexysConnectionDefinition["kind"];
  readonly source: NexysCoordinate2D;
  readonly target: NexysCoordinate2D;
  readonly active: boolean;
}

export interface NexysViewportSnapshot {
  readonly focusedNode: NexysNodeDefinition | null;
  readonly visibleNodes: readonly NexysVisibleNode[];
  readonly visibleConnections: readonly NexysVisibleConnection[];
  readonly hiddenNodeCount: number;
  readonly hasMoreBefore: boolean;
  readonly hasMoreAfter: boolean;
}

export interface NexysNodeActionView {
  readonly label: string;
  readonly summary: string;
  readonly route: string | null;
  readonly enabled: boolean;
  readonly status: NexysCapabilityDefinition["status"];
  /** Set only when the underlying capability action explicitly opts in via metadata.primary. */
  readonly primary: boolean;
}

export interface NexysFocusedNodeView {
  readonly nodeId: NexysNodeId;
  readonly title: string;
  readonly summary: string;
  readonly accentColor: string;
  readonly icon: string;
  readonly actions: readonly NexysNodeActionView[];
  /** Only non-null when a capability action explicitly marks itself primary - never defaults to the first action. */
  readonly primaryAction: NexysNodeActionView | null;
}

export interface NexysCommunicationModeView {
  readonly id: string;
  readonly label: string;
  readonly route: string | null;
  readonly enabled: boolean;
}

export type NexysNavigationIntent =
  | { readonly kind: "node"; readonly nodeId: NexysNodeId }
  | { readonly kind: "capability"; readonly capabilityId: string }
  | { readonly kind: "query"; readonly query: string };

export interface NexysNavigationResolution {
  readonly kind: "node" | "communication";
  readonly nodeId: NexysNodeId | null;
  readonly route: string;
  readonly label: string;
  readonly capabilityId: string | null;
  readonly source: "node" | "capability" | "communication";
}

const SLOT_LAYOUT: readonly {
  readonly relativeIndex: number;
  readonly position: NexysCoordinate2D;
  readonly presence: NexysVisibleNodePresence;
}[] = [
  { relativeIndex: 0, position: { x: 50, y: 47 }, presence: "focused" },
  { relativeIndex: -1, position: { x: 24, y: 31 }, presence: "near" },
  { relativeIndex: 1, position: { x: 76, y: 34 }, presence: "near" },
  { relativeIndex: -2, position: { x: -8, y: 66 }, presence: "edge" },
  { relativeIndex: 2, position: { x: 108, y: 68 }, presence: "edge" },
];

const FILLER_WORDS = new Set([
  "a",
  "an",
  "bring",
  "can",
  "change",
  "current",
  "go",
  "me",
  "my",
  "open",
  "show",
  "take",
  "the",
  "to",
  "where",
  "you",
]);

export function createNexysViewportState(
  focusedNodeId: NexysNodeId | null,
  navigationSource: NexysViewportNavigationSource = "initial",
): NexysViewportState {
  return deepFreeze({
    focusedNodeId,
    previousNodeId: null,
    offset: { x: 0, y: 0 },
    navigationSource,
    transitionSerial: 0,
  }) as NexysViewportState;
}

export function focusNexysViewportNode(
  state: NexysViewportState,
  nodeId: NexysNodeId,
  navigationSource: NexysViewportNavigationSource,
): NexysViewportState {
  if (state.focusedNodeId === nodeId && state.navigationSource === navigationSource) return state;
  return deepFreeze({
    focusedNodeId: nodeId,
    previousNodeId: state.focusedNodeId,
    offset: { x: 0, y: 0 },
    navigationSource,
    transitionSerial: state.transitionSerial + 1,
  }) as NexysViewportState;
}

/**
 * Home must be a truly neutral state: clears the visual focus (and any
 * pan offset from it) without touching the graph engine's separate
 * activeNodeId concept, which callers like keyboard nav still need as a
 * "last known position" reference point even when nothing is focused.
 */
export function clearNexysViewportFocus(
  state: NexysViewportState,
  navigationSource: NexysViewportNavigationSource,
): NexysViewportState {
  if (state.focusedNodeId === null) return state;
  return deepFreeze({
    focusedNodeId: null,
    previousNodeId: state.focusedNodeId,
    offset: { x: 0, y: 0 },
    navigationSource,
    transitionSerial: state.transitionSerial + 1,
  }) as NexysViewportState;
}

export function panNexysViewport(
  state: NexysViewportState,
  delta: NexysCoordinate2D,
  navigationSource: NexysViewportNavigationSource = "touch",
): NexysViewportState {
  return deepFreeze({
    ...state,
    offset: {
      x: clamp(state.offset.x + delta.x, -18, 18),
      y: clamp(state.offset.y + delta.y, -14, 14),
    },
    navigationSource,
  }) as NexysViewportState;
}

export function getNexysViewportSnapshot(
  graph: NexysGraphSnapshot,
  viewport: NexysViewportState,
): NexysViewportSnapshot {
  const rootNodes = [...graph.rootNodes];
  const focusedNode = resolveFocusedNode(graph, viewport);
  if (!focusedNode || rootNodes.length === 0) {
    return deepFreeze({
      focusedNode: null,
      visibleNodes: [],
      visibleConnections: [],
      hiddenNodeCount: 0,
      hasMoreBefore: false,
      hasMoreAfter: false,
    }) as NexysViewportSnapshot;
  }

  const focusedIndex = rootNodes.findIndex((node) => node.id === focusedNode.id);
  const seen = new Set<NexysNodeId>();
  const visibleNodes: NexysVisibleNode[] = [];

  for (const slot of SLOT_LAYOUT) {
    if (seen.size >= rootNodes.length) break;
    const node = rootNodes[wrapIndex(focusedIndex + slot.relativeIndex, rootNodes.length)];
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    visibleNodes.push({
      node,
      position: {
        x: slot.position.x + viewport.offset.x,
        y: slot.position.y + viewport.offset.y,
      },
      presence: slot.presence,
      relativeIndex: slot.relativeIndex,
      interactive: true,
    });
  }

  const visibleById = new Map(visibleNodes.map((entry) => [entry.node.id, entry]));
  const visibleConnections = graph.connections
    .map((connection) => {
      const source = visibleById.get(connection.sourceId);
      const target = visibleById.get(connection.targetId);
      if (!source || !target) return null;
      return {
        id: connection.id,
        sourceId: connection.sourceId,
        targetId: connection.targetId,
        kind: connection.kind,
        source: source.position,
        target: target.position,
        active: connection.sourceId === focusedNode.id || connection.targetId === focusedNode.id,
      };
    })
    .filter((connection): connection is NexysVisibleConnection => Boolean(connection));

  return deepFreeze({
    focusedNode,
    visibleNodes,
    visibleConnections,
    hiddenNodeCount: Math.max(rootNodes.length - visibleNodes.length, 0),
    hasMoreBefore: rootNodes.length > visibleNodes.length,
    hasMoreAfter: rootNodes.length > visibleNodes.length,
  }) as NexysViewportSnapshot;
}

export function getAdjacentNexysNode(
  graph: NexysGraphSnapshot,
  currentNodeId: NexysNodeId | null,
  direction: "previous" | "next",
): NexysNodeDefinition | null {
  const rootNodes = [...graph.rootNodes];
  if (rootNodes.length === 0) return null;

  const currentIndex = Math.max(
    0,
    rootNodes.findIndex((node) => node.id === currentNodeId),
  );
  const delta = direction === "next" ? 1 : -1;
  return rootNodes[wrapIndex(currentIndex + delta, rootNodes.length)] ?? null;
}

/**
 * Translates the capability registry (architecture layer) into the Hub's
 * user-facing gateway actions (UX layer). Deterministic ordering (an
 * explicit action.metadata.displayOrder, falling back to registry order
 * as a stable tiebreaker - never engine-iteration-order alone),
 * deduplicated by route, no arbitrary truncation, and a primary action
 * only when a capability action explicitly opts in via
 * action.metadata.primary. Never invents actions or routes: everything
 * here already exists in the manifest/capability data.
 */
export function createFocusedNodeView(
  node: NexysNodeDefinition,
  capabilities: NexysCapabilityRegistry,
): NexysFocusedNodeView {
  const candidates = capabilities
    .byOwner(node.id)
    .filter(isNexysCapabilityActionAvailable)
    .flatMap((capability) => capability.actions
      .filter((action) => action.enabled && Boolean(action.route) && action.metadata?.hiddenFromHub !== true)
      .map((action) => ({
        label: (action.metadata?.hubLabel as string | undefined) ?? action.label,
        summary: (action.metadata?.hubSummary as string | undefined) ?? capability.searchable.summary,
        route: action.route as string,
        enabled: action.enabled,
        status: capability.status,
        primary: action.metadata?.primary === true,
        displayOrder: typeof action.metadata?.displayOrder === "number"
          ? (action.metadata.displayOrder as number)
          : Number.MAX_SAFE_INTEGER,
      })));

  // Stable sort by displayOrder; equal-order actions keep registry order (the explicit tiebreaker below).
  const ordered = candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => a.candidate.displayOrder - b.candidate.displayOrder || a.index - b.index)
    .map((entry) => entry.candidate);

  // Dedupe by route: two capabilities pointing at the same destination should surface once, not twice.
  const seenRoutes = new Set<string>();
  const actions: NexysNodeActionView[] = [];
  for (const candidate of ordered) {
    if (seenRoutes.has(candidate.route)) continue;
    seenRoutes.add(candidate.route);
    actions.push({
      label: candidate.label,
      summary: candidate.summary,
      route: candidate.route,
      enabled: candidate.enabled,
      status: candidate.status,
      primary: candidate.primary,
    });
  }

  return deepFreeze({
    nodeId: node.id,
    title: node.metadata.title,
    summary: node.metadata.summary,
    accentColor: node.metadata.visual.color,
    icon: node.metadata.visual.icon,
    actions,
    primaryAction: actions.find((action) => action.primary) ?? null,
  }) as NexysFocusedNodeView;
}

export function communicationModeViews(
  manifest: PersistentCommunicationManifest,
): readonly NexysCommunicationModeView[] {
  return manifest.modes.map((mode) => deepFreeze({
    id: mode.id,
    label: mode.label,
    route: mode.surfacePath ?? manifest.route,
    enabled: mode.status === "available" && Boolean(mode.surfacePath ?? manifest.route),
  }) as NexysCommunicationModeView);
}

export function resolveNexysNavigationIntent(
  intent: NexysNavigationIntent,
  graph: NexysGraphSnapshot,
  capabilities: NexysCapabilityRegistry,
  communication: PersistentCommunicationManifest,
): NexysNavigationResolution | null {
  if (intent.kind === "node") {
    const node = graph.nodes.find((candidate) => candidate.id === intent.nodeId) ?? null;
    return node ? nodeResolution(node, null, "node") : null;
  }

  if (intent.kind === "capability") {
    return resolveCapability(capabilities.get(intent.capabilityId), graph, communication);
  }

  const tokens = tokenize(intent.query);
  if (tokens.length === 0) return null;

  const node = bestNodeMatch(tokens, graph);
  if (node) return nodeResolution(node, null, "node");

  const capability = bestCapabilityMatch(tokens, capabilities);
  return resolveCapability(capability, graph, communication);
}

export function userFacingTextForNodeView(view: NexysFocusedNodeView): readonly string[] {
  return [
    view.title,
    view.summary,
    ...view.actions.flatMap((action) => [action.label, action.summary]),
  ];
}

export function shouldShowNexysDeveloperInspector(input: {
  readonly isDevelopment: boolean;
  readonly queryString: string;
}): boolean {
  if (!input.isDevelopment) return false;
  const normalized = input.queryString.startsWith("?") ? input.queryString.slice(1) : input.queryString;
  const params = new URLSearchParams(normalized);
  return params.get("debug") === "nexys";
}

/**
 * Home (focusedNodeId === null) must resolve to no focused node at all -
 * no fallback to the graph engine's activeNode or the first root node.
 * That's a deliberately separate "last active node" concept (see
 * getAdjacentNexysNode, which still uses it as a keyboard-nav reference
 * point); the visual focus used by the Home scene must not inherit it.
 */
function resolveFocusedNode(
  graph: NexysGraphSnapshot,
  viewport: NexysViewportState,
): NexysNodeDefinition | null {
  if (!viewport.focusedNodeId) return null;
  return graph.nodes.find((node) => node.id === viewport.focusedNodeId) ?? null;
}

function bestNodeMatch(tokens: readonly string[], graph: NexysGraphSnapshot): NexysNodeDefinition | null {
  const scored = graph.rootNodes
    .map((node) => ({
      node,
      score: scoreTerms(tokens, [
        node.id,
        node.label,
        node.metadata.title,
        node.metadata.summary,
        ...node.metadata.tags,
      ]),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.node ?? null;
}

function bestCapabilityMatch(
  tokens: readonly string[],
  capabilities: NexysCapabilityRegistry,
): NexysCapabilityDefinition | null {
  const scored = capabilities
    .all()
    .map((capability) => ({
      capability,
      score: scoreTerms(tokens, [
        capability.id,
        capability.label,
        capability.category,
        capability.searchable.summary,
        ...capability.searchable.terms,
        ...capability.searchable.aliases,
      ]),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.capability ?? null;
}

function resolveCapability(
  capability: NexysCapabilityDefinition | null,
  graph: NexysGraphSnapshot,
  communication: PersistentCommunicationManifest,
): NexysNavigationResolution | null {
  if (!capability) return null;

  if (capability.owner.kind === "node" && capability.owningNodeId) {
    const node = graph.nodes.find((candidate) => candidate.id === capability.owningNodeId) ?? null;
    return node ? nodeResolution(node, capability.id, "capability") : null;
  }

  if (capability.owner.kind === "communication-layer") {
    const actionRoute = capability.actions.find((action) => action.enabled && action.route)?.route;
    return deepFreeze({
      kind: "communication",
      nodeId: null,
      route: actionRoute ?? communication.route,
      label: capability.label,
      capabilityId: capability.id,
      source: "communication",
    }) as NexysNavigationResolution;
  }

  return null;
}

function nodeResolution(
  node: NexysNodeDefinition,
  capabilityId: string | null,
  source: NexysNavigationResolution["source"],
): NexysNavigationResolution {
  return deepFreeze({
    kind: "node",
    nodeId: node.id,
    route: node.metadata.route,
    label: node.label,
    capabilityId,
    source,
  }) as NexysNavigationResolution;
}

function scoreTerms(tokens: readonly string[], fields: readonly string[]): number {
  const normalizedFields = fields.map(normalizeText).filter(Boolean);
  let score = 0;
  for (const token of tokens) {
    for (const field of normalizedFields) {
      const words = field.split(" ");
      if (field === token) score += 6;
      else if (words.includes(token)) score += 4;
      else if (token.length >= 4 && words.some((word) => word.startsWith(token))) score += 1;
    }
  }
  return score;
}

function tokenize(query: string): readonly string[] {
  return normalizeText(query)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !FILLER_WORDS.has(token));
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, " ").trim();
}

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (!value || typeof value !== "object") return value as Readonly<T>;
  const record = value as Record<PropertyKey, unknown>;
  for (const key of Reflect.ownKeys(record)) {
    const child = record[key];
    if (child && typeof child === "object" && !Object.isFrozen(child)) {
      deepFreeze(child);
    }
  }
  return Object.freeze(value);
}
