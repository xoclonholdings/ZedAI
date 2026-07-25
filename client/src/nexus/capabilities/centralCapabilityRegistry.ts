import { PERSISTENT_COMMUNICATION_CAPABILITIES } from "../communication/persistentCommunication";
import { nexusRootManifestRegistry } from "../manifests/rootManifests";
import { NexusCapabilityRegistry } from "./NexusCapabilityRegistry";

export const nexusCapabilityRegistry = new NexusCapabilityRegistry([
  ...nexusRootManifestRegistry.capabilities().all(),
  ...PERSISTENT_COMMUNICATION_CAPABILITIES,
]);
