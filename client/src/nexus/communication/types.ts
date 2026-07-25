import type { NexusCapabilityDefinition } from "../capabilities/types";

export type NexusCommunicationLayerId = string;

export type NexusCommunicationModeId =
  | "text"
  | "talk"
  | "image"
  | "draw"
  | "doc"
  | "upload";

export type NexusCommunicationModeStatus = "available" | "scaffolded" | "planned";

export interface NexusCommunicationModeDefinition {
  readonly id: NexusCommunicationModeId;
  readonly label: string;
  readonly capabilityId: string;
  readonly status: NexusCommunicationModeStatus;
  readonly surfacePath: string | null;
  readonly existingSurfaceReferences: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface PersistentCommunicationManifest {
  readonly id: NexusCommunicationLayerId;
  readonly label: string;
  readonly route: string;
  readonly stateNamespace: string;
  readonly modes: readonly NexusCommunicationModeDefinition[];
  readonly capabilities: readonly NexusCapabilityDefinition[];
  readonly metadata: Readonly<Record<string, unknown>>;
}
