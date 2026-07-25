import type { NexusDomain } from "../components/NexusCore";
import { resolveNexusIconComponent } from "../components/NexusIcon";
import type { NexusNodeDefinition } from "../graph/types";

/**
 * Translates real root-node manifest data into the shape NexusCore's scene
 * expects (id/label/color/size/radius/inclination/angle/icon). No hardcoded
 * per-domain values from the prototype (DEFAULT_DOMAINS) - size/radius/
 * inclination/angle are deterministically derived from each node's own id,
 * so the scene stays visually varied without inventing anything: same input
 * always produces the same layout, and a manifest change is the only thing
 * that can change it.
 *
 * `angle` is derived here, not reused from `node.metadata.visual.angle` -
 * that field is the old flat 2D wheel-grid's evenly-spaced placement angle
 * (-90 + index * 360/total), and feeding it straight into the 3D scene
 * reproduces exactly the evenly-spaced "wheel" arrangement the official
 * composition explicitly rules out. Each planet needs its own independent
 * orbit (distinct radius, inclination, and angular position), the way a
 * real solar system has near and far bodies on different planes, not one
 * that reads as a flat ring or a single line.
 */
export function nexusDomainsFromRootNodes(nodes: readonly NexusNodeDefinition[]): NexusDomain[] {
  return nodes.map((node) => {
    const sizeSeed = hashUnit(`${node.id}:size`);
    const radiusSeed = hashUnit(`${node.id}:radius`);
    const inclinationSeed = hashUnit(`${node.id}:inclination`);
    const angleSeed = hashUnit(`${node.id}:angle`);
    return {
      id: node.id,
      label: node.label.toUpperCase(),
      color: node.metadata.visual.color,
      size: 0.16 + sizeSeed * 0.18,
      radius: 2.2 + radiusSeed * 4.2,
      inclination: (inclinationSeed - 0.5) * 1.1,
      angle: angleSeed * Math.PI * 2,
      icon: resolveNexusIconComponent(node.metadata.visual.icon),
    };
  });
}

function hashUnit(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) % 997;
  return h / 997;
}
