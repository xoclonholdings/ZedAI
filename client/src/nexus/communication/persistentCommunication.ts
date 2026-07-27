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
    mode("draw", "Draw", "create.draw", "available", "/chat", [
      "client/src/nexus/components/communication/NexusDrawCanvas.tsx",
    ]),
    mode("doc", "Doc", "create.document", "available", "/chat", [
      "client/src/components/research/ResearchDocuments.tsx",
    ]),
    mode("upload", "Upload", "create.upload", "available", "/chat", [
      "client/src/nexus/components/communication/NexusMemoryUpload.tsx",
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
    communicationCapability("draw", "create.draw", "Draw Communication", "Sketch quick markup and send it as a real attachment through the existing upload surface.", {
      actionKind: "upload",
      actionRoute: "/chat",
      dependencies: [dependency("create.image", "Drawing output behaves as visual input.")],
      terms: ["create", "draw", "sketch", "canvas", "markup"],
    }),
    communicationCapability("doc", "create.document", "Document Communication", "Write up and file a new document through the existing research document authoring surface.", {
      actionKind: "write",
      actionRoute: "/chat",
      dependencies: coreCreationDependencies(),
      terms: ["create", "doc", "document", "write", "draft", "file"],
      aliases: ["create.doc"],
      replacesCapabilityIds: ["create.draft-work"],
    }),
    communicationCapability("upload", "create.upload", "Upload Communication", "Teach Zed from files - zips, datasets, documents - through the existing memory upload surface, independent of any conversation.", {
      actionKind: "upload",
      actionRoute: "/chat",
      dependencies: [
        dependency("identity.current-principal", "Uploads belong to the authenticated user."),
        dependency("memory.relevant-context", "Uploaded content merges into the user's retained memory."),
      ],
      terms: ["create", "upload", "learn", "teach", "memory", "zip", "dataset"],
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
