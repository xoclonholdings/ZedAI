import type {
  NexusCapabilityAction,
  NexusCapabilityDefinition,
  NexusCapabilityDependency,
  NexusCapabilityPermission,
  NexusCapabilityStatus,
} from "../capabilities/types";
import type {
  NexusCommunicationModeDefinition,
  NexusCommunicationModeId,
  PersistentCommunicationManifest,
} from "./types";

export const PERSISTENT_COMMUNICATION_LAYER_ID = "persistent-communication";

export const NEXUS_COMMUNICATION_MODE_IDS = [
  "text",
  "talk",
  "image",
  "draw",
  "doc",
  "upload",
] as const satisfies readonly NexusCommunicationModeId[];

export const PERSISTENT_COMMUNICATION_MANIFEST: PersistentCommunicationManifest = {
  id: PERSISTENT_COMMUNICATION_LAYER_ID,
  label: "Persistent Communication Layer",
  route: "/chat",
  stateNamespace: "nexus.communication",
  modes: [
    mode("text", "Text", "create.text", "available", "/chat", [
      "client/src/nexus/components/communication/NexusMessageComposer.tsx",
    ]),
    mode("talk", "Talk", "create.talk", "available", "/chat", [
      "client/src/nexus/components/communication/NexusVoiceDock.tsx",
      "client/src/nexus/communication/useNexusDictation.ts",
    ]),
    mode("image", "Image", "create.image", "available", "/chat", [
      "client/src/nexus/components/communication/NexusFileUpload.tsx",
    ]),
    mode("draw", "Draw", "create.draw", "scaffolded", null, []),
    mode("doc", "Doc", "create.document", "available", "/chat", [
      "client/src/nexus/components/communication/NexusFileUpload.tsx",
    ]),
    mode("upload", "Upload", "create.upload", "available", "/chat", [
      "client/src/nexus/components/communication/NexusFileUpload.tsx",
    ]),
  ],
  capabilities: [
    communicationCapability("text", "create.text", "Text Communication", "Send text through the existing chat composer.", {
      actionKind: "write",
      actionRoute: "/chat",
      dependencies: coreCreationDependencies(),
      terms: ["create", "text", "message", "chat", "conversation"],
      replacesCapabilityIds: ["create.conversation"],
    }),
    communicationCapability("talk", "create.talk", "Talk Communication", "Dictate spoken input into the existing chat composer where browser support exists.", {
      actionKind: "write",
      actionRoute: "/chat",
      dependencies: [dependency("create.text", "Dictation writes into the text composer.")],
      terms: ["create", "talk", "voice", "dictation", "speech"],
    }),
    communicationCapability("image", "create.image", "Image Communication", "Attach image files through the existing conversation upload surface.", {
      actionKind: "upload",
      actionRoute: "/chat",
      dependencies: [dependency("create.upload", "Image communication uses the upload surface.")],
      terms: ["create", "image", "picture", "visual", "attach"],
    }),
    communicationCapability("draw", "create.draw", "Draw Communication", "Reserve drawing input as a future global communication mode.", {
      actionKind: "write",
      actionRoute: null,
      dependencies: [dependency("create.image", "Future drawing output should behave as visual input.")],
      status: "scaffolded",
      terms: ["create", "draw", "sketch", "canvas"],
    }),
    communicationCapability("doc", "create.document", "Document Communication", "Attach document files through the existing conversation upload surface.", {
      actionKind: "upload",
      actionRoute: "/chat",
      dependencies: [dependency("create.upload", "Document communication uses the upload surface.")],
      terms: ["create", "doc", "document", "pdf", "file"],
      aliases: ["create.doc"],
      replacesCapabilityIds: ["create.draft-work"],
    }),
    communicationCapability("upload", "create.upload", "Upload Communication", "Attach supported files through the existing conversation upload surface.", {
      actionKind: "upload",
      actionRoute: "/chat",
      dependencies: [
        dependency("identity.current-principal", "Uploads belong to the authenticated user."),
        dependency("tools.execution-policy", "Uploaded content must remain governed by execution policy."),
      ],
      terms: ["create", "upload", "attach", "file", "source"],
    }),
  ],
  metadata: {
    globalAcrossNexusRoots: true,
    navigationalNode: false,
  },
};

export const PERSISTENT_COMMUNICATION_CAPABILITIES = PERSISTENT_COMMUNICATION_MANIFEST.capabilities;

export function getCommunicationMode(modeId: NexusCommunicationModeId): NexusCommunicationModeDefinition {
  const modeDefinition = PERSISTENT_COMMUNICATION_MANIFEST.modes.find((candidate) => candidate.id === modeId);
  if (!modeDefinition) throw new Error(`Missing Nexus communication mode: ${modeId}`);
  return modeDefinition;
}

function mode(
  id: NexusCommunicationModeId,
  label: string,
  capabilityId: string,
  status: NexusCommunicationModeDefinition["status"],
  surfacePath: string | null,
  existingSurfaceReferences: readonly string[],
): NexusCommunicationModeDefinition {
  return {
    id,
    label,
    capabilityId,
    status,
    surfacePath,
    existingSurfaceReferences,
    metadata: {
      persistentAcrossRootNavigation: true,
    },
  };
}

function communicationCapability(
  modeId: NexusCommunicationModeId,
  id: string,
  label: string,
  summary: string,
  options: {
    readonly actionKind: NexusCapabilityAction["kind"];
    readonly actionRoute: string | null;
    readonly dependencies?: readonly NexusCapabilityDependency[];
    readonly status?: NexusCapabilityStatus;
    readonly terms: readonly string[];
    readonly aliases?: readonly string[];
    readonly replacesCapabilityIds?: readonly string[];
  },
): NexusCapabilityDefinition {
  return {
    id,
    owner: {
      kind: "communication-layer",
      id: PERSISTENT_COMMUNICATION_LAYER_ID,
    },
    owningNodeId: null,
    label,
    category: "communication",
    status: options.status ?? "available",
    actions: [
      {
        id: `${id}.primary`,
        label,
        kind: options.actionKind,
        route: options.actionRoute,
        enabled: Boolean(options.actionRoute),
      },
    ],
    dependencies: options.dependencies ?? [],
    permissions: [authenticatedPermission()],
    searchable: {
      summary,
      terms: [...options.terms],
      aliases: options.aliases ?? [],
    },
    metadata: {
      communicationLayerId: PERSISTENT_COMMUNICATION_LAYER_ID,
      communicationModeId: modeId,
      persistentAcrossRootNavigation: true,
      replacesCapabilityIds: options.replacesCapabilityIds ?? [],
    },
  };
}

function coreCreationDependencies(): readonly NexusCapabilityDependency[] {
  return [
    dependency("identity.collaboration-context", "Confirmed collaboration context guides creation."),
    dependency("memory.relevant-context", "Relevant retained memory can support continuity."),
    dependency("knowledge.relevant-sources", "Source-backed knowledge can support grounded creation."),
    dependency("tools.execution-policy", "Execution policy governs tool-capable creation."),
  ];
}

function dependency(capabilityId: string, reason: string): NexusCapabilityDependency {
  return {
    capabilityId,
    required: true,
    reason,
  };
}

function authenticatedPermission(): NexusCapabilityPermission {
  return {
    id: "kernel.authenticated",
    label: "Authenticated user",
    source: "kernel",
    required: true,
  };
}
