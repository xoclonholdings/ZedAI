import type { NexysApplicationBoundary } from "./types";
import type { NexysRootNodeId } from "../manifests/rootManifests";
import { nexysRootManifestRegistry } from "../manifests/rootManifests";

export const NEXYS_ROOT_APPLICATIONS: readonly NexysApplicationBoundary[] =
  nexysRootManifestRegistry.applications();

export function getNexysApplicationBoundary(nodeId: NexysRootNodeId): NexysApplicationBoundary {
  const boundary = NEXYS_ROOT_APPLICATIONS.find((app) => app.nodeId === nodeId);
  if (!boundary) throw new Error(`Missing Nexys application boundary for ${nodeId}`);
  return boundary;
}
