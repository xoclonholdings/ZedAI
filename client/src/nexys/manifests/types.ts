import type { NexysApplicationBoundary } from "../apps/types";
import type { NexysCapabilityDefinition } from "../capabilities/types";
import type { NexysNodeId, NexysNodeKind } from "../graph/types";

export interface NexysManifestVisual {
  readonly icon: string;
  readonly color: string;
  readonly orbit: number;
}

export interface NexysManifestDiscovery {
  readonly summary: string;
  readonly tags: readonly string[];
  readonly searchableTerms: readonly string[];
}

export interface NexysNodeManifest {
  readonly id: NexysNodeId;
  readonly label: string;
  readonly kind: NexysNodeKind;
  readonly parentId: NexysNodeId | null;
  readonly application: NexysApplicationBoundary;
  readonly discovery: NexysManifestDiscovery;
  readonly visual: NexysManifestVisual;
  readonly defaultExpanded?: boolean;
  readonly capabilities: readonly NexysCapabilityDefinition[];
  readonly metadata: Readonly<Record<string, unknown>>;
}
