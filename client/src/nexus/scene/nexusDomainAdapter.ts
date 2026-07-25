import type { NexusDomain } from "../components/NexusCore";
import { resolveNexusIconComponent } from "../components/NexusIcon";
import type { NexusNodeDefinition } from "../graph/types";

/**
 * Translates real root-node manifest data into the shape NexusCore's scene
 * expects (id/label/color/size/radius/inclination/angle/icon). No hardcoded
 * per-domain values from the prototype (DEFAULT_DOMAINS) - size/radius/
 * inclination are deterministically derived from each node's own id, so the
 * scene stays visually varied without inventing anything: same input always
 * produces the same layout, and a manifest change is the only thing that can
 * change it.
 */
export function nexusDomainsFromRootNodes(nodes: readonly NexusNodeDefinition[]): NexusDomain[] {
  return nodes.map((node) => {
    const sizeSeed = hashUnit(`${node.id}:size`);
    const radiusSeed = hashUnit(`${node.id}:radius`);
    const inclinationSeed = hashUnit(`${node.id}:inclination`);
    return {
      id: node.id,
      label: node.label.toUpperCase(),
      color: node.metadata.visual.color,
      size: 0.18 + sizeSeed * 0.14,
      radius: 2.6 + radiusSeed * 2.1,
      inclination: (inclinationSeed - 0.5) * 0.5,
      angle: node.metadata.visual.angle,
      icon: resolveNexusIconComponent(node.metadata.visual.icon),
    };
  });
}

function hashUnit(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) % 997;
  return h / 997;
}
