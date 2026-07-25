import type { NexusApplicationId, NexusNodeId } from "../graph/types";

export type NexusApplicationStatus = "scaffolded" | "active" | "external";

export interface NexusApplicationBoundary {
  readonly id: NexusApplicationId;
  readonly nodeId: NexusNodeId;
  readonly label: string;
  readonly basePath: string;
  readonly routePattern: string;
  readonly stateNamespace: string;
  readonly ownsState: true;
  readonly status: NexusApplicationStatus;
  readonly consumes: readonly string[];
  readonly currentSurfacePath: string | null;
  readonly notes: readonly string[];
}
