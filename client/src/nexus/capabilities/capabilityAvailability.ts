import type { NexusCapabilityDefinition } from "./types";

export function isNexusCapabilityActionAvailable(capability: NexusCapabilityDefinition): boolean {
  if (capability.status !== "available" && capability.status !== "external") return false;
  return capability.actions.some((action) => action.enabled && Boolean(action.route));
}
