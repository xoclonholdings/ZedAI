import type { NexysNodeId } from "../graph/types";
import type {
  NexysCapabilityDefinition,
  NexysCapabilityGraphEdge,
  NexysCapabilityGraphSnapshot,
  NexysCapabilityId,
  NexysUnresolvedCapabilityDependency,
} from "./types";

export class NexysCapabilityRegistry {
  private readonly capabilityById = new Map<NexysCapabilityId, NexysCapabilityDefinition>();
  private readonly capabilityIdsByNodeOwner = new Map<NexysNodeId, Set<NexysCapabilityId>>();
  private readonly capabilityIdsByCommunicationLayer = new Map<string, Set<NexysCapabilityId>>();

  constructor(capabilities: readonly NexysCapabilityDefinition[] = []) {
    for (const capability of capabilities) this.register(capability);
  }

  register(capability: NexysCapabilityDefinition): this {
    if (this.capabilityById.has(capability.id)) {
      throw new Error(`Nexys capability already registered: ${capability.id}`);
    }

    this.capabilityById.set(capability.id, deepFreeze(cloneCapability(capability)));
    if (capability.owner.kind === "node") {
      if (!capability.owningNodeId || capability.owningNodeId !== capability.owner.id) {
        throw new Error(`Nexys capability ${capability.id} has inconsistent node ownership.`);
      }
      const ownerCapabilities = this.capabilityIdsByNodeOwner.get(capability.owningNodeId) ?? new Set<NexysCapabilityId>();
      ownerCapabilities.add(capability.id);
      this.capabilityIdsByNodeOwner.set(capability.owningNodeId, ownerCapabilities);
    } else {
      if (capability.owningNodeId !== null) {
        throw new Error(`Nexys communication capability ${capability.id} cannot have a node owner.`);
      }
      const layerCapabilities = this.capabilityIdsByCommunicationLayer.get(capability.owner.id) ?? new Set<NexysCapabilityId>();
      layerCapabilities.add(capability.id);
      this.capabilityIdsByCommunicationLayer.set(capability.owner.id, layerCapabilities);
    }
    return this;
  }

  get(capabilityId: NexysCapabilityId): NexysCapabilityDefinition | null {
    return this.capabilityById.get(capabilityId) ?? null;
  }

  byOwner(nodeId: NexysNodeId): readonly NexysCapabilityDefinition[] {
    const ids = this.capabilityIdsByNodeOwner.get(nodeId) ?? new Set<NexysCapabilityId>();
    return this.capabilitiesForIds(ids);
  }

  byCommunicationLayer(layerId: string): readonly NexysCapabilityDefinition[] {
    const ids = this.capabilityIdsByCommunicationLayer.get(layerId) ?? new Set<NexysCapabilityId>();
    return this.capabilitiesForIds(ids);
  }

  capabilitiesForIds(ids: ReadonlySet<NexysCapabilityId>): readonly NexysCapabilityDefinition[] {
    return [...ids]
      .map((id) => this.capabilityById.get(id))
      .filter((capability): capability is NexysCapabilityDefinition => Boolean(capability));
  }

  all(): readonly NexysCapabilityDefinition[] {
    return [...this.capabilityById.values()];
  }

  search(query: string): readonly NexysCapabilityDefinition[] {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];

    return this.all().filter((capability) => {
      const searchable = [
        capability.id,
        capability.label,
        capability.category,
        capability.searchable.summary,
        ...capability.searchable.terms,
        ...capability.searchable.aliases,
      ].join(" ").toLowerCase();
      return searchable.includes(needle);
    });
  }

  graphSnapshot(): NexysCapabilityGraphSnapshot {
    const edges: NexysCapabilityGraphEdge[] = [];
    const unresolvedDependencies: NexysUnresolvedCapabilityDependency[] = [];

    for (const capability of this.capabilityById.values()) {
      for (const dependency of capability.dependencies) {
        if (this.capabilityById.has(dependency.capabilityId)) {
          edges.push(deepFreeze({
            fromCapabilityId: capability.id,
            toCapabilityId: dependency.capabilityId,
            required: dependency.required,
            reason: dependency.reason,
          }));
        } else {
          unresolvedDependencies.push(deepFreeze({
            fromCapabilityId: capability.id,
            missingCapabilityId: dependency.capabilityId,
            required: dependency.required,
            reason: dependency.reason,
          }));
        }
      }
    }

    return deepFreeze({
      capabilities: this.all(),
      edges,
      unresolvedDependencies,
    }) as NexysCapabilityGraphSnapshot;
  }
}

function cloneCapability(capability: NexysCapabilityDefinition): NexysCapabilityDefinition {
  return {
    ...capability,
    owner: { ...capability.owner },
    actions: capability.actions.map((action) => ({
      ...action,
      metadata: action.metadata ? { ...action.metadata } : undefined,
    })),
    dependencies: capability.dependencies.map((dependency) => ({ ...dependency })),
    permissions: capability.permissions.map((permission) => ({ ...permission })),
    searchable: {
      ...capability.searchable,
      terms: [...capability.searchable.terms],
      aliases: [...capability.searchable.aliases],
    },
    metadata: { ...capability.metadata },
  };
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
