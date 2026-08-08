import { NexysConstellationEngine } from "./NexysConstellationEngine";
import type { NexysConnectionDefinition, NexysNodeDefinition, NexysNodeId } from "./types";
import {
  NEXYS_ROOT_NODE_IDS,
  isNexysRootNodeId,
  nexysRootManifestRegistry,
  type NexysRootNodeId,
} from "../manifests/rootManifests";
import type { NexysNodeManifest } from "../manifests/types";

export { NEXYS_ROOT_NODE_IDS, isNexysRootNodeId, nexysRootManifestRegistry };
export type { NexysRootNodeId };

export const NEXYS_ROOT_NODES: readonly NexysNodeDefinition[] =
  nexysRootManifestRegistry.toNavigationNodes(rootVisualMetadata);

export const NEXYS_ROOT_CONNECTIONS: readonly NexysConnectionDefinition[] = NEXYS_ROOT_NODE_IDS.map((id, index) => {
  const next = NEXYS_ROOT_NODE_IDS[(index + 1) % NEXYS_ROOT_NODE_IDS.length];
  return {
    id: `root-orbit:${id}:${next}`,
    sourceId: id,
    targetId: next,
    kind: "orbit",
    label: "root constellation",
  };
});

export const nexysConstellationEngine = new NexysConstellationEngine(
  NEXYS_ROOT_NODES,
  NEXYS_ROOT_CONNECTIONS,
);

export function routeForNexysNode(nodeId: NexysNodeId): string {
  return nexysConstellationEngine.getNode(nodeId)?.metadata.route ?? "/nexys";
}

function rootVisualMetadata(manifest: NexysNodeManifest, index: number, total: number) {
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
