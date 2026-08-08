import type { NexysCapabilityDefinition } from "../capabilities/types";

export type NexysCommunicationLayerId = string;

export type NexysCommunicationModeId =
  | "text"
  | "talk"
  | "image"
  | "draw"
  | "doc"
  | "upload";

export type NexysCommunicationModeStatus = "available" | "scaffolded" | "planned";

export interface NexysCommunicationModeDefinition {
  readonly id: NexysCommunicationModeId;
  readonly label: string;
  readonly capabilityId: string;
  readonly status: NexysCommunicationModeStatus;
  readonly surfacePath: string | null;
  readonly existingSurfaceReferences: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface PersistentCommunicationManifest {
  readonly id: NexysCommunicationLayerId;
  readonly label: string;
  readonly route: string;
  readonly stateNamespace: string;
  readonly modes: readonly NexysCommunicationModeDefinition[];
  readonly capabilities: readonly NexysCapabilityDefinition[];
  readonly metadata: Readonly<Record<string, unknown>>;
}
