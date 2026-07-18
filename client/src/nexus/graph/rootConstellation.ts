import { NexusConstellationEngine } from "./NexusConstellationEngine";
import type { NexusConnectionDefinition, NexusNodeDefinition, NexusNodeId } from "./types";
import {
  NEXUS_ROOT_NODE_IDS,
  isNexusRootNodeId,
  nexusRootManifestRegistry,
  type NexusRootNodeId,
} from "../manifests/rootManifests";
import type { NexusNodeManifest } from "../manifests/types";

export { NEXUS_ROOT_NODE_IDS, isNexusRootNodeId, nexusRootManifestRegistry };
export type { NexusRootNodeId };

export const NEXUS_ROOT_NODES: readonly NexusNodeDefinition[] =
  nexusRootManifestRegistry.toNavigationNodes(rootVisualMetadata);

export const NEXUS_ROOT_CONNECTIONS: readonly NexusConnectionDefinition[] = NEXUS_ROOT_NODE_IDS.map((id, index) => {
  const next = NEXUS_ROOT_NODE_IDS[(index + 1) % NEXUS_ROOT_NODE_IDS.length];
  return {
    id: `root-orbit:${id}:${next}`,
    sourceId: id,
    targetId: next,
    kind: "orbit",
    label: "root constellation",
  };
});

export const nexusConstellationEngine = new NexusConstellationEngine(
  NEXUS_ROOT_NODES,
  NEXUS_ROOT_CONNECTIONS,
);

export function routeForNexusNode(nodeId: NexusNodeId): string {
  return nexusConstellationEngine.getNode(nodeId)?.metadata.route ?? "/nexus";
}

function rootVisualMetadata(manifest: NexusNodeManifest, index: number, total: number) {
  const angle = (-90 + index * (360 / total)) * (Math.PI / 180);
  const radius = 42;
  const x = 50 + Math.cos(angle) * radius;
  const y = 50 + Math.sin(angle) * radius;

  return {
    color: manifest.visual.color,
    icon: manifest.visual.icon,
    orbit: manifest.visual.orbit,
    angle,
    coordinates2d: { x, y },
    coordinates3d: {
      x: x - 50,
      y: y - 50,
      z: index % 2 === 0 ? 8 : -8,
    },
  };
}
