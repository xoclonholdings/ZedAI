import type { NexusApplicationBoundary } from "./types";
import type { NexusRootNodeId } from "../manifests/rootManifests";
import { nexusRootManifestRegistry } from "../manifests/rootManifests";

export const NEXUS_ROOT_APPLICATIONS: readonly NexusApplicationBoundary[] =
  nexusRootManifestRegistry.applications();

export function getNexusApplicationBoundary(nodeId: NexusRootNodeId): NexusApplicationBoundary {
  const boundary = NEXUS_ROOT_APPLICATIONS.find((app) => app.nodeId === nodeId);
  if (!boundary) throw new Error(`Missing Nexus application boundary for ${nodeId}`);
  return boundary;
}
