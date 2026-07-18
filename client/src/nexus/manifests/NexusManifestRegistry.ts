import type { NexusApplicationBoundary } from "../apps/types";
import { NexusCapabilityRegistry } from "../capabilities/NexusCapabilityRegistry";
import type { NexusCapabilityDefinition } from "../capabilities/types";
import type { NexusNodeDefinition, NexusNodeId, NexusVisualMetadata } from "../graph/types";
import type { NexusNodeManifest } from "./types";

export class NexusManifestRegistry {
  private readonly manifestById = new Map<NexusNodeId, NexusNodeManifest>();
  private readonly capabilityRegistry = new NexusCapabilityRegistry();

  constructor(manifests: readonly NexusNodeManifest[] = []) {
    for (const manifest of manifests) this.registerManifest(manifest);
  }

  registerManifest(manifest: NexusNodeManifest): this {
    if (this.manifestById.has(manifest.id)) {
      throw new Error(`Nexus node manifest already registered: ${manifest.id}`);
    }

    this.manifestById.set(manifest.id, deepFreeze(cloneManifest(manifest)));
    for (const capability of manifest.capabilities) {
      if (capability.owner.kind !== "node" || capability.owningNodeId !== manifest.id) {
        throw new Error(`Nexus capability ${capability.id} is not owned by node ${manifest.id}`);
      }
      this.capabilityRegistry.register(capability);
    }

    return this;
  }

  getManifest(nodeId: NexusNodeId): NexusNodeManifest | null {
    return this.manifestById.get(nodeId) ?? null;
  }

  manifests(): readonly NexusNodeManifest[] {
    return [...this.manifestById.values()];
  }

  applications(): readonly NexusApplicationBoundary[] {
    return this.manifests().map((manifest) => manifest.application);
  }

  capabilities(): NexusCapabilityRegistry {
    return this.capabilityRegistry;
  }

  capabilitiesForNode(nodeId: NexusNodeId): readonly NexusCapabilityDefinition[] {
    return this.capabilityRegistry.byOwner(nodeId);
  }

  toNavigationNodes(visualForManifest: NexusVisualFactory): readonly NexusNodeDefinition[] {
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
    }) as NexusNodeDefinition);
  }
}

export type NexusVisualFactory = (
  manifest: NexusNodeManifest,
  index: number,
  total: number,
) => NexusVisualMetadata;

function cloneManifest(manifest: NexusNodeManifest): NexusNodeManifest {
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
