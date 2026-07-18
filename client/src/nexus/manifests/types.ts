import type { NexusApplicationBoundary } from "../apps/types";
import type { NexusCapabilityDefinition } from "../capabilities/types";
import type { NexusNodeId, NexusNodeKind } from "../graph/types";

export interface NexusManifestVisual {
  readonly icon: string;
  readonly color: string;
  readonly orbit: number;
}

export interface NexusManifestDiscovery {
  readonly summary: string;
  readonly tags: readonly string[];
  readonly searchableTerms: readonly string[];
}

export interface NexusNodeManifest {
  readonly id: NexusNodeId;
  readonly label: string;
  readonly kind: NexusNodeKind;
  readonly parentId: NexusNodeId | null;
  readonly application: NexusApplicationBoundary;
  readonly discovery: NexusManifestDiscovery;
  readonly visual: NexusManifestVisual;
  readonly defaultExpanded?: boolean;
  readonly capabilities: readonly NexusCapabilityDefinition[];
  readonly metadata: Readonly<Record<string, unknown>>;
}
