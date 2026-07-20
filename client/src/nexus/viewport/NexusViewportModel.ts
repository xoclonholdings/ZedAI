import type { NexusCapabilityRegistry } from "../capabilities/NexusCapabilityRegistry";
import type { NexusCapabilityDefinition } from "../capabilities/types";
import { isNexusCapabilityActionAvailable } from "../capabilities/capabilityAvailability";
import type { PersistentCommunicationManifest } from "../communication/types";
import type {
  NexusConnectionDefinition,
  NexusCoordinate2D,
  NexusGraphSnapshot,
  NexusNodeDefinition,
  NexusNodeId,
} from "../graph/types";

export type NexusViewportNavigationSource =
  | "initial"
  | "route"
  | "touch"
  | "keyboard"
  | "zar"
  | "programmatic";

export type NexusVisibleNodePresence = "focused" | "near" | "edge";

export interface NexusViewportState {
  readonly focusedNodeId: NexusNodeId | null;
  readonly previousNodeId: NexusNodeId | null;
  readonly offset: NexusCoordinate2D;
  readonly navigationSource: NexusViewportNavigationSource;
  readonly transitionSerial: number;
}

export interface NexusVisibleNode {
  readonly node: NexusNodeDefinition;
  readonly position: NexusCoordinate2D;
  readonly presence: NexusVisibleNodePresence;
  readonly relativeIndex: number;
  readonly interactive: boolean;
}

export interface NexusVisibleConnection {
  readonly id: string;
  readonly sourceId: NexusNodeId;
  readonly targetId: NexusNodeId;
  readonly kind: NexusConnectionDefinition["kind"];
  readonly source: NexusCoordinate2D;
  readonly target: NexusCoordinate2D;
  readonly active: boolean;
}

export interface NexusViewportSnapshot {
  readonly focusedNode: NexusNodeDefinition | null;
  readonly visibleNodes: readonly NexusVisibleNode[];
  readonly visibleConnections: readonly NexusVisibleConnection[];
  readonly hiddenNodeCount: number;
  readonly hasMoreBefore: boolean;
  readonly hasMoreAfter: boolean;
}

export interface NexusNodeActionView {
  readonly label: string;
  readonly summary: string;
  readonly route: string | null;
  readonly enabled: boolean;
  readonly status: NexusCapabilityDefinition["status"];
}

export interface NexusFocusedNodeView {
  readonly nodeId: NexusNodeId;
  readonly title: string;
  readonly summary: string;
  readonly accentColor: string;
  readonly icon: string;
  readonly actions: readonly NexusNodeActionView[];
}

export interface NexusCommunicationModeView {
  readonly id: string;
  readonly label: string;
  readonly route: string | null;
  readonly enabled: boolean;
}

export type NexusNavigationIntent =
  | { readonly kind: "node"; readonly nodeId: NexusNodeId }
  | { readonly kind: "capability"; readonly capabilityId: string }
  | { readonly kind: "query"; readonly query: string };

export interface NexusNavigationResolution {
  readonly kind: "node" | "communication";
  readonly nodeId: NexusNodeId | null;
  readonly route: string;
  readonly label: string;
  readonly capabilityId: string | null;
  readonly source: "node" | "capability" | "communication";
}

const SLOT_LAYOUT: readonly {
  readonly relativeIndex: number;
  readonly position: NexusCoordinate2D;
  readonly presence: NexusVisibleNodePresence;
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

export function createNexusViewportState(
  focusedNodeId: NexusNodeId | null,
  navigationSource: NexusViewportNavigationSource = "initial",
): NexusViewportState {
  return deepFreeze({
    focusedNodeId,
    previousNodeId: null,
    offset: { x: 0, y: 0 },
    navigationSource,
    transitionSerial: 0,
  }) as NexusViewportState;
}

export function focusNexusViewportNode(
  state: NexusViewportState,
  nodeId: NexusNodeId,
  navigationSource: NexusViewportNavigationSource,
): NexusViewportState {
  if (state.focusedNodeId === nodeId && state.navigationSource === navigationSource) return state;
  return deepFreeze({
    focusedNodeId: nodeId,
    previousNodeId: state.focusedNodeId,
    offset: { x: 0, y: 0 },
    navigationSource,
    transitionSerial: state.transitionSerial + 1,
  }) as NexusViewportState;
}

export function panNexusViewport(
  state: NexusViewportState,
  delta: NexusCoordinate2D,
  navigationSource: NexusViewportNavigationSource = "touch",
): NexusViewportState {
  return deepFreeze({
    ...state,
    offset: {
      x: clamp(state.offset.x + delta.x, -18, 18),
      y: clamp(state.offset.y + delta.y, -14, 14),
    },
    navigationSource,
  }) as NexusViewportState;
}

export function getNexusViewportSnapshot(
  graph: NexusGraphSnapshot,
  viewport: NexusViewportState,
): NexusViewportSnapshot {
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
    }) as NexusViewportSnapshot;
  }

  const focusedIndex = rootNodes.findIndex((node) => node.id === focusedNode.id);
  const seen = new Set<NexusNodeId>();
  const visibleNodes: NexusVisibleNode[] = [];

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
    .filter((connection): connection is NexusVisibleConnection => Boolean(connection));

  return deepFreeze({
    focusedNode,
    visibleNodes,
    visibleConnections,
    hiddenNodeCount: Math.max(rootNodes.length - visibleNodes.length, 0),
    hasMoreBefore: rootNodes.length > visibleNodes.length,
    hasMoreAfter: rootNodes.length > visibleNodes.length,
  }) as NexusViewportSnapshot;
}

export function getAdjacentNexusNode(
  graph: NexusGraphSnapshot,
  currentNodeId: NexusNodeId | null,
  direction: "previous" | "next",
): NexusNodeDefinition | null {
  const rootNodes = [...graph.rootNodes];
  if (rootNodes.length === 0) return null;

  const currentIndex = Math.max(
    0,
    rootNodes.findIndex((node) => node.id === currentNodeId),
  );
  const delta = direction === "next" ? 1 : -1;
  return rootNodes[wrapIndex(currentIndex + delta, rootNodes.length)] ?? null;
}

export function createFocusedNodeView(
  node: NexusNodeDefinition,
  capabilities: NexusCapabilityRegistry,
): NexusFocusedNodeView {
  const actions = capabilities
    .byOwner(node.id)
    .filter(isNexusCapabilityActionAvailable)
    .flatMap((capability) => capability.actions.map((action) => ({
      label: action.label,
      summary: capability.searchable.summary,
      route: action.route,
      enabled: action.enabled,
      status: capability.status,
    })))
    .filter((action) => action.enabled)
    .slice(0, 3);

  return deepFreeze({
    nodeId: node.id,
    title: node.metadata.title,
    summary: node.metadata.summary,
    accentColor: node.metadata.visual.color,
    icon: node.metadata.visual.icon,
    actions,
  }) as NexusFocusedNodeView;
}

export function communicationModeViews(
  manifest: PersistentCommunicationManifest,
): readonly NexusCommunicationModeView[] {
  return manifest.modes.map((mode) => deepFreeze({
    id: mode.id,
    label: mode.label,
    route: mode.surfacePath ?? manifest.route,
    enabled: mode.status === "available" && Boolean(mode.surfacePath ?? manifest.route),
  }) as NexusCommunicationModeView);
}

export function resolveNexusNavigationIntent(
  intent: NexusNavigationIntent,
  graph: NexusGraphSnapshot,
  capabilities: NexusCapabilityRegistry,
  communication: PersistentCommunicationManifest,
): NexusNavigationResolution | null {
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

export function userFacingTextForNodeView(view: NexusFocusedNodeView): readonly string[] {
  return [
    view.title,
    view.summary,
    ...view.actions.flatMap((action) => [action.label, action.summary]),
  ];
}

export function shouldShowNexusDeveloperInspector(input: {
  readonly isDevelopment: boolean;
  readonly queryString: string;
}): boolean {
  if (!input.isDevelopment) return false;
  const normalized = input.queryString.startsWith("?") ? input.queryString.slice(1) : input.queryString;
  const params = new URLSearchParams(normalized);
  return params.get("debug") === "nexus";
}

function resolveFocusedNode(
  graph: NexusGraphSnapshot,
  viewport: NexusViewportState,
): NexusNodeDefinition | null {
  return viewport.focusedNodeId
    ? graph.nodes.find((node) => node.id === viewport.focusedNodeId) ?? graph.activeNode
    : graph.activeNode ?? graph.rootNodes[0] ?? null;
}

function bestNodeMatch(tokens: readonly string[], graph: NexusGraphSnapshot): NexusNodeDefinition | null {
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
  capabilities: NexusCapabilityRegistry,
): NexusCapabilityDefinition | null {
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
  capability: NexusCapabilityDefinition | null,
  graph: NexusGraphSnapshot,
  communication: PersistentCommunicationManifest,
): NexusNavigationResolution | null {
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
    }) as NexusNavigationResolution;
  }

  return null;
}

function nodeResolution(
  node: NexusNodeDefinition,
  capabilityId: string | null,
  source: NexusNavigationResolution["source"],
): NexusNavigationResolution {
  return deepFreeze({
    kind: "node",
    nodeId: node.id,
    route: node.metadata.route,
    label: node.label,
    capabilityId,
    source,
  }) as NexusNavigationResolution;
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
