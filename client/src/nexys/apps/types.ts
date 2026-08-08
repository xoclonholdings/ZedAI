import type { NexysApplicationId, NexysNodeId } from "../graph/types";

export type NexysApplicationStatus = "scaffolded" | "active" | "external";

export interface NexysApplicationBoundary {
  readonly id: NexysApplicationId;
  readonly nodeId: NexysNodeId;
  readonly label: string;
  readonly basePath: string;
  readonly routePattern: string;
  readonly stateNamespace: string;
  readonly ownsState: true;
  readonly status: NexysApplicationStatus;
  readonly consumes: readonly string[];
  readonly currentSurfacePath: string | null;
  readonly notes: readonly string[];
}
