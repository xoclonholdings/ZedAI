import type { NexysCapabilityDefinition } from "./types";

export function isNexysCapabilityActionAvailable(capability: NexysCapabilityDefinition): boolean {
  if (capability.status !== "available" && capability.status !== "external") return false;
  return capability.actions.some((action) => action.enabled && Boolean(action.route));
}
