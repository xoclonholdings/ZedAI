import type {
  NexysCapabilityAction,
  NexysCapabilityDefinition,
  NexysCapabilityDependency,
  NexysCapabilityPermission,
  NexysCapabilityStatus,
} from "../capabilities/types";
import type {
  NexysCommunicationModeDefinition,
  NexysCommunicationModeId,
  PersistentCommunicationManifest,
} from "./types";

export const PERSISTENT_COMMUNICATION_LAYER_ID = "persistent-communication";

export const NEXYS_COMMUNICATION_MODE_IDS = [
  "text",
  "talk",
  "image",
  "chat",
  "doc",
  "upload",
] as const satisfies readonly NexysCommunicationModeId[];

export const PERSISTENT_COMMUNICATION_MANIFEST: PersistentCommunicationManifest = {
  id: PERSISTENT_COMMUNICATION_LAYER_ID,
  label: "Persistent Communication Layer",
  route: "/chat",
  stateNamespace: "nexys.communication",
  modes: [
    mode("text", "Text", "access.sms", "available", "/nexys", [
      "client/src/nexys/components/communication/NexysSmsSettings.tsx",
    ]),
    mode("talk", "Talk", "create.talk", "available", "/chat", [
      "client/src/nexys/components/communication/NexysVoiceDock.tsx",
      "client/src/nexys/communication/useNexysDictation.ts",
    ]),
    mode("image", "Image", "create.image", "available", "/chat", [
      "client/src/nexys/components/communication/NexysFileUpload.tsx",
    ]),
    mode("chat", "Chat", "create.text", "available", "/chat", [
      "client/src/nexys/components/communication/NexysMessageComposer.tsx",
    ]),
    mode("doc", "Doc", "create.document", "available", "/chat", [
      "client/src/components/research/ResearchDocuments.tsx",
    ]),
    mode("upload", "Upload", "create.upload", "available", "/chat", [
      "client/src/nexys/components/communication/NexysMemoryUpload.tsx",
    ]),
  ],
  capabilities: [
    communicationCapability("text", "access.sms", "ZAR by Text", "Connect and manage secure SMS access to the existing ZAR relationship.", {
      actionKind: "write",
      actionRoute: "/nexys",
      dependencies: [dependency("identity.current-principal", "Phone access must belong to the authenticated user.")],
      terms: ["text", "sms", "phone", "connect", "message"],
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
    communicationCapability("chat", "create.text", "Chat Communication", "Send written messages through the existing ZAR conversation surface.", {
      actionKind: "write",
      actionRoute: "/chat",
      dependencies: coreCreationDependencies(),
      terms: ["create", "text", "message", "chat", "conversation"],
      replacesCapabilityIds: ["create.conversation"],
    }),
    communicationCapability("doc", "create.document", "Document Communication", "Write up and file a new document through the existing research document authoring surface.", {
      actionKind: "write",
      actionRoute: "/chat",
      dependencies: coreCreationDependencies(),
      terms: ["create", "doc", "document", "write", "draft", "file"],
      aliases: ["create.doc"],
      replacesCapabilityIds: ["create.draft-work"],
    }),
    communicationCapability("upload", "create.upload", "Upload Communication", "Teach ZAR from files - zips, datasets, documents - through the existing memory upload surface, independent of any conversation.", {
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
    globalAcrossNexysRoots: true,
    navigationalNode: false,
  },
};

export const PERSISTENT_COMMUNICATION_CAPABILITIES = PERSISTENT_COMMUNICATION_MANIFEST.capabilities;

export function getCommunicationMode(modeId: NexysCommunicationModeId): NexysCommunicationModeDefinition {
  const modeDefinition = PERSISTENT_COMMUNICATION_MANIFEST.modes.find((candidate) => candidate.id === modeId);
  if (!modeDefinition) throw new Error(`Missing Nexys communication mode: ${modeId}`);
  return modeDefinition;
}

function mode(
  id: NexysCommunicationModeId,
  label: string,
  capabilityId: string,
  status: NexysCommunicationModeDefinition["status"],
  surfacePath: string | null,
  existingSurfaceReferences: readonly string[],
): NexysCommunicationModeDefinition {
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
  modeId: NexysCommunicationModeId,
  id: string,
  label: string,
  summary: string,
  options: {
    readonly actionKind: NexysCapabilityAction["kind"];
    readonly actionRoute: string | null;
    readonly dependencies?: readonly NexysCapabilityDependency[];
    readonly status?: NexysCapabilityStatus;
    readonly terms: readonly string[];
    readonly aliases?: readonly string[];
    readonly replacesCapabilityIds?: readonly string[];
  },
): NexysCapabilityDefinition {
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

function coreCreationDependencies(): readonly NexysCapabilityDependency[] {
  return [
    dependency("identity.collaboration-context", "Confirmed collaboration context guides creation."),
    dependency("memory.relevant-context", "Relevant retained memory can support continuity."),
    dependency("knowledge.relevant-sources", "Source-backed knowledge can support grounded creation."),
    dependency("tools.execution-policy", "Execution policy governs tool-capable creation."),
  ];
}

function dependency(capabilityId: string, reason: string): NexysCapabilityDependency {
  return {
    capabilityId,
    required: true,
    reason,
  };
}

function authenticatedPermission(): NexysCapabilityPermission {
  return {
    id: "kernel.authenticated",
    label: "Authenticated user",
    source: "kernel",
    required: true,
  };
}
