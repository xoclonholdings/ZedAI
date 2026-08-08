import type {
  NexysConnectionDefinition,
  NexysGraphSnapshot,
  NexysGraphState,
  NexysNodeDefinition,
  NexysNodeId,
} from "./types";

export class NexysConstellationEngine {
  private readonly nodeRegistry = new Map<NexysNodeId, NexysNodeDefinition>();
  private readonly connectionRegistry = new Map<string, NexysConnectionDefinition>();
  private readonly childIndex = new Map<NexysNodeId, Set<NexysNodeId>>();

  constructor(
    nodes: readonly NexysNodeDefinition[] = [],
    connections: readonly NexysConnectionDefinition[] = [],
  ) {
    for (const node of nodes) this.registerNode(node);
    for (const connection of connections) this.registerConnection(connection);
  }

  registerNode(node: NexysNodeDefinition): this {
    if (this.nodeRegistry.has(node.id)) {
      throw new Error(`Nexys node already registered: ${node.id}`);
    }
    if (node.parentId && !this.nodeRegistry.has(node.parentId)) {
      throw new Error(`Nexys parent node is not registered: ${node.parentId}`);
    }

    this.nodeRegistry.set(node.id, deepFreeze({ ...node }));
    if (node.parentId) {
      const children = this.childIndex.get(node.parentId) ?? new Set<NexysNodeId>();
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

  registerConnection(connection: NexysConnectionDefinition): this {
    if (this.connectionRegistry.has(connection.id)) return this;
    this.assertRegistered(connection.sourceId);
    this.assertRegistered(connection.targetId);
    this.connectionRegistry.set(connection.id, deepFreeze({ ...connection }));
    return this;
  }

  createInitialState(activeNodeId: NexysNodeId | null = null): NexysGraphState {
    const active = activeNodeId && this.nodeRegistry.has(activeNodeId) ? activeNodeId : this.rootNodes()[0]?.id ?? null;
    const expandedNodeIds = this.nodes()
      .filter((node) => node.defaultExpanded)
      .map((node) => node.id);
    return deepFreeze({
      activeNodeId: active,
      expandedNodeIds,
      navigationTrail: active ? [active] : [],
      visitedNodeIds: active ? [active] : [],
    }) as NexysGraphState;
  }

  activateNode(state: NexysGraphState, nodeId: NexysNodeId): NexysGraphState {
    this.assertRegistered(nodeId);
    return deepFreeze({
      ...state,
      activeNodeId: nodeId,
      navigationTrail: [...state.navigationTrail, nodeId].slice(-12),
      visitedNodeIds: unique([...state.visitedNodeIds, nodeId]),
    }) as NexysGraphState;
  }

  snapshot(state: NexysGraphState): NexysGraphSnapshot {
    const activeNode = state.activeNodeId ? this.nodeRegistry.get(state.activeNodeId) ?? null : null;
    return deepFreeze({
      nodes: this.nodes(),
      rootNodes: this.rootNodes(),
      connections: this.connections(),
      activeNode,
      activePath: activeNode ? this.pathTo(activeNode.id) : [],
      expandedNodeIds: [...state.expandedNodeIds],
      navigationTrail: [...state.navigationTrail],
    }) as NexysGraphSnapshot;
  }

  getNode(nodeId: NexysNodeId): NexysNodeDefinition | null {
    return this.nodeRegistry.get(nodeId) ?? null;
  }

  childrenOf(nodeId: NexysNodeId): NexysNodeDefinition[] {
    const childIds = this.childIndex.get(nodeId) ?? new Set<NexysNodeId>();
    return [...childIds]
      .map((id) => this.nodeRegistry.get(id))
      .filter((node): node is NexysNodeDefinition => Boolean(node));
  }

  nodes(): NexysNodeDefinition[] {
    return [...this.nodeRegistry.values()];
  }

  rootNodes(): NexysNodeDefinition[] {
    return this.nodes().filter((node) => node.parentId === null);
  }

  connections(): NexysConnectionDefinition[] {
    return [...this.connectionRegistry.values()];
  }

  pathTo(nodeId: NexysNodeId): NexysNodeDefinition[] {
    this.assertRegistered(nodeId);
    const path: NexysNodeDefinition[] = [];
    let current = this.nodeRegistry.get(nodeId) ?? null;
    while (current) {
      path.unshift(current);
      current = current.parentId ? this.nodeRegistry.get(current.parentId) ?? null : null;
    }
    return path;
  }

  private assertRegistered(nodeId: NexysNodeId): void {
    if (!this.nodeRegistry.has(nodeId)) {
      throw new Error(`Nexys node is not registered: ${nodeId}`);
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
