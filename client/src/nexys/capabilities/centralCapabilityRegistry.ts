import { PERSISTENT_COMMUNICATION_CAPABILITIES } from "../communication/persistentCommunication";
import { nexysRootManifestRegistry } from "../manifests/rootManifests";
import { NexysCapabilityRegistry } from "./NexysCapabilityRegistry";

export const nexysCapabilityRegistry = new NexysCapabilityRegistry([
  ...nexysRootManifestRegistry.capabilities().all(),
  ...PERSISTENT_COMMUNICATION_CAPABILITIES,
]);
