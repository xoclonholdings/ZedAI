import type {
  NexusConnectionDefinition,
  NexusGraphSnapshot,
  NexusGraphState,
  NexusNodeDefinition,
  NexusNodeId,
} from "./types";

export class NexusConstellationEngine {
  private readonly nodeRegistry = new Map<NexusNodeId, NexusNodeDefinition>();
  private readonly connectionRegistry = new Map<string, NexusConnectionDefinition>();
  private readonly childIndex = new Map<NexusNodeId, Set<NexusNodeId>>();

  constructor(
    nodes: readonly NexusNodeDefinition[] = [],
    connections: readonly NexusConnectionDefinition[] = [],
  ) {
    for (const node of nodes) this.registerNode(node);
    for (const connection of connections) this.registerConnection(connection);
  }

  registerNode(node: NexusNodeDefinition): this {
    if (this.nodeRegistry.has(node.id)) {
      throw new Error(`Nexus node already registered: ${node.id}`);
    }
    if (node.parentId && !this.nodeRegistry.has(node.parentId)) {
      throw new Error(`Nexus parent node is not registered: ${node.parentId}`);
    }

    this.nodeRegistry.set(node.id, deepFreeze({ ...node }));
    if (node.parentId) {
      const children = this.childIndex.get(node.parentId) ?? new Set<NexusNodeId>();
      children.add(node.id);
      this.childIndex.set(node.parentId, children);
      this.registerConnection({
        id: `parent:${node.parentId}:${node.id}`,
        sourceId: node.parentId,
        targetId: node.id,
        kind: "parent",
      });
    }
    return this;
  }

  registerConnection(connection: NexusConnectionDefinition): this {
    if (this.connectionRegistry.has(connection.id)) return this;
    this.assertRegistered(connection.sourceId);
    this.assertRegistered(connection.targetId);
    this.connectionRegistry.set(connection.id, deepFreeze({ ...connection }));
    return this;
  }

  createInitialState(activeNodeId: NexusNodeId | null = null): NexusGraphState {
    const active = activeNodeId && this.nodeRegistry.has(activeNodeId) ? activeNodeId : this.rootNodes()[0]?.id ?? null;
    const expandedNodeIds = this.nodes()
      .filter((node) => node.defaultExpanded)
      .map((node) => node.id);
    return deepFreeze({
      activeNodeId: active,
      expandedNodeIds,
      navigationTrail: active ? [active] : [],
      visitedNodeIds: active ? [active] : [],
    }) as NexusGraphState;
  }

  activateNode(state: NexusGraphState, nodeId: NexusNodeId): NexusGraphState {
    this.assertRegistered(nodeId);
    return deepFreeze({
      ...state,
      activeNodeId: nodeId,
      navigationTrail: [...state.navigationTrail, nodeId].slice(-12),
      visitedNodeIds: unique([...state.visitedNodeIds, nodeId]),
    }) as NexusGraphState;
  }

  expandNode(state: NexusGraphState, nodeId: NexusNodeId): NexusGraphState {
    this.assertRegistered(nodeId);
    return deepFreeze({
      ...state,
      expandedNodeIds: unique([...state.expandedNodeIds, nodeId]),
    }) as NexusGraphState;
  }

  collapseNode(state: NexusGraphState, nodeId: NexusNodeId): NexusGraphState {
    this.assertRegistered(nodeId);
    return deepFreeze({
      ...state,
      expandedNodeIds: state.expandedNodeIds.filter((id) => id !== nodeId),
    }) as NexusGraphState;
  }

  toggleNode(state: NexusGraphState, nodeId: NexusNodeId): NexusGraphState {
    return state.expandedNodeIds.includes(nodeId)
      ? this.collapseNode(state, nodeId)
      : this.expandNode(state, nodeId);
  }

  snapshot(state: NexusGraphState): NexusGraphSnapshot {
    const activeNode = state.activeNodeId ? this.nodeRegistry.get(state.activeNodeId) ?? null : null;
    return deepFreeze({
      nodes: this.nodes(),
      rootNodes: this.rootNodes(),
      connections: this.connections(),
      activeNode,
      activePath: activeNode ? this.pathTo(activeNode.id) : [],
      expandedNodeIds: [...state.expandedNodeIds],
      navigationTrail: [...state.navigationTrail],
    }) as NexusGraphSnapshot;
  }

  getNode(nodeId: NexusNodeId): NexusNodeDefinition | null {
    return this.nodeRegistry.get(nodeId) ?? null;
  }

  childrenOf(nodeId: NexusNodeId): NexusNodeDefinition[] {
    const childIds = this.childIndex.get(nodeId) ?? new Set<NexusNodeId>();
    return [...childIds]
      .map((id) => this.nodeRegistry.get(id))
      .filter((node): node is NexusNodeDefinition => Boolean(node));
  }

  nodes(): NexusNodeDefinition[] {
    return [...this.nodeRegistry.values()];
  }

  rootNodes(): NexusNodeDefinition[] {
    return this.nodes().filter((node) => node.parentId === null);
  }

  connections(): NexusConnectionDefinition[] {
    return [...this.connectionRegistry.values()];
  }

  pathTo(nodeId: NexusNodeId): NexusNodeDefinition[] {
    this.assertRegistered(nodeId);
    const path: NexusNodeDefinition[] = [];
    let current = this.nodeRegistry.get(nodeId) ?? null;
    while (current) {
      path.unshift(current);
      current = current.parentId ? this.nodeRegistry.get(current.parentId) ?? null : null;
    }
    return path;
  }

  private assertRegistered(nodeId: NexusNodeId): void {
    if (!this.nodeRegistry.has(nodeId)) {
      throw new Error(`Nexus node is not registered: ${nodeId}`);
    }
  }
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
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
