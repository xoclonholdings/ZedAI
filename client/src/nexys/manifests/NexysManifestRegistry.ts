import type { NexysApplicationBoundary } from "../apps/types";
import { NexysCapabilityRegistry } from "../capabilities/NexysCapabilityRegistry";
import type { NexysCapabilityDefinition } from "../capabilities/types";
import type { NexysNodeDefinition, NexysNodeId, NexysVisualMetadata } from "../graph/types";
import type { NexysNodeManifest } from "./types";

export class NexysManifestRegistry {
  private readonly manifestById = new Map<NexysNodeId, NexysNodeManifest>();
  private readonly capabilityRegistry = new NexysCapabilityRegistry();

  constructor(manifests: readonly NexysNodeManifest[] = []) {
    for (const manifest of manifests) this.registerManifest(manifest);
  }

  registerManifest(manifest: NexysNodeManifest): this {
    if (this.manifestById.has(manifest.id)) {
      throw new Error(`Nexys node manifest already registered: ${manifest.id}`);
    }

    this.manifestById.set(manifest.id, deepFreeze(cloneManifest(manifest)));
    for (const capability of manifest.capabilities) {
      if (capability.owner.kind !== "node" || capability.owningNodeId !== manifest.id) {
        throw new Error(`Nexys capability ${capability.id} is not owned by node ${manifest.id}`);
      }
      this.capabilityRegistry.register(capability);
    }

    return this;
  }

  getManifest(nodeId: NexysNodeId): NexysNodeManifest | null {
    return this.manifestById.get(nodeId) ?? null;
  }

  manifests(): readonly NexysNodeManifest[] {
    return [...this.manifestById.values()];
  }

  applications(): readonly NexysApplicationBoundary[] {
    return this.manifests().map((manifest) => manifest.application);
  }

  capabilities(): NexysCapabilityRegistry {
    return this.capabilityRegistry;
  }

  capabilitiesForNode(nodeId: NexysNodeId): readonly NexysCapabilityDefinition[] {
    return this.capabilityRegistry.byOwner(nodeId);
  }

  toNavigationNodes(visualForManifest: NexysVisualFactory): readonly NexysNodeDefinition[] {
    const manifests = this.manifests();
    return manifests.map((manifest, index) => deepFreeze({
      id: manifest.id,
      label: manifest.label,
      kind: manifest.kind,
      parentId: manifest.parentId,
      defaultExpanded: manifest.defaultExpanded,
      metadata: {
        title: manifest.label,
        summary: manifest.discovery.summary,
        applicationId: manifest.application.id,
        route: manifest.application.basePath,
        stateNamespace: manifest.application.stateNamespace,
        ownsState: manifest.application.ownsState,
        consumesZarCore: manifest.application.consumes.includes("zar-core"),
        coreCapabilities: manifest.application.consumes,
        tags: manifest.discovery.tags,
        visual: visualForManifest(manifest, index, manifests.length),
      },
    }) as NexysNodeDefinition);
  }
}

export type NexysVisualFactory = (
  manifest: NexysNodeManifest,
  index: number,
  total: number,
) => NexysVisualMetadata;

function cloneManifest(manifest: NexysNodeManifest): NexysNodeManifest {
  return {
    ...manifest,
    application: {
      ...manifest.application,
      consumes: [...manifest.application.consumes],
      notes: [...manifest.application.notes],
    },
    discovery: {
      ...manifest.discovery,
      tags: [...manifest.discovery.tags],
      searchableTerms: [...manifest.discovery.searchableTerms],
    },
    visual: { ...manifest.visual },
    capabilities: manifest.capabilities.map((capability) => ({
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
    })),
    metadata: { ...manifest.metadata },
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
