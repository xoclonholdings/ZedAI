import type { NexusNodeId } from "../graph/types";
import type {
  NexusCapabilityDefinition,
  NexusCapabilityGraphEdge,
  NexusCapabilityGraphSnapshot,
  NexusCapabilityId,
  NexusUnresolvedCapabilityDependency,
} from "./types";

export class NexusCapabilityRegistry {
  private readonly capabilityById = new Map<NexusCapabilityId, NexusCapabilityDefinition>();
  private readonly capabilityIdsByNodeOwner = new Map<NexusNodeId, Set<NexusCapabilityId>>();
  private readonly capabilityIdsByCommunicationLayer = new Map<string, Set<NexusCapabilityId>>();

  constructor(capabilities: readonly NexusCapabilityDefinition[] = []) {
    for (const capability of capabilities) this.register(capability);
  }

  register(capability: NexusCapabilityDefinition): this {
    if (this.capabilityById.has(capability.id)) {
      throw new Error(`Nexus capability already registered: ${capability.id}`);
    }

    this.capabilityById.set(capability.id, deepFreeze(cloneCapability(capability)));
    if (capability.owner.kind === "node") {
      if (!capability.owningNodeId || capability.owningNodeId !== capability.owner.id) {
        throw new Error(`Nexus capability ${capability.id} has inconsistent node ownership.`);
      }
      const ownerCapabilities = this.capabilityIdsByNodeOwner.get(capability.owningNodeId) ?? new Set<NexusCapabilityId>();
      ownerCapabilities.add(capability.id);
      this.capabilityIdsByNodeOwner.set(capability.owningNodeId, ownerCapabilities);
    } else {
      if (capability.owningNodeId !== null) {
        throw new Error(`Nexus communication capability ${capability.id} cannot have a node owner.`);
      }
      const layerCapabilities = this.capabilityIdsByCommunicationLayer.get(capability.owner.id) ?? new Set<NexusCapabilityId>();
      layerCapabilities.add(capability.id);
      this.capabilityIdsByCommunicationLayer.set(capability.owner.id, layerCapabilities);
    }
    return this;
  }

  get(capabilityId: NexusCapabilityId): NexusCapabilityDefinition | null {
    return this.capabilityById.get(capabilityId) ?? null;
  }

  byOwner(nodeId: NexusNodeId): readonly NexusCapabilityDefinition[] {
    const ids = this.capabilityIdsByNodeOwner.get(nodeId) ?? new Set<NexusCapabilityId>();
    return this.capabilitiesForIds(ids);
  }

  byCommunicationLayer(layerId: string): readonly NexusCapabilityDefinition[] {
    const ids = this.capabilityIdsByCommunicationLayer.get(layerId) ?? new Set<NexusCapabilityId>();
    return this.capabilitiesForIds(ids);
  }

  capabilitiesForIds(ids: ReadonlySet<NexusCapabilityId>): readonly NexusCapabilityDefinition[] {
    return [...ids]
      .map((id) => this.capabilityById.get(id))
      .filter((capability): capability is NexusCapabilityDefinition => Boolean(capability));
  }

  all(): readonly NexusCapabilityDefinition[] {
    return [...this.capabilityById.values()];
  }

  search(query: string): readonly NexusCapabilityDefinition[] {
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

  graphSnapshot(): NexusCapabilityGraphSnapshot {
    const edges: NexusCapabilityGraphEdge[] = [];
    const unresolvedDependencies: NexusUnresolvedCapabilityDependency[] = [];

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
    }) as NexusCapabilityGraphSnapshot;
  }
}

function cloneCapability(capability: NexusCapabilityDefinition): NexusCapabilityDefinition {
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
