# ZAR Nexus Manifest and Capability Graph

## Purpose

Nexus is the root navigation architecture for ZAR. It presents permanent root applications while keeping navigation, application discovery, capability discovery, and communication modes separate.

The Nexus layer does not own ZAR Core identity, memory, knowledge, Constitution, response policy, or learning behavior. Nexus consumes ZAR Core through declared metadata and capability contracts.

## Signed-In Nexus Home

The signed-in home route renders the Nexus as a user-facing constellation viewport, not a registry inspector.

The home page is composed from existing Nexus authorities:

- root nodes from `NexusManifestRegistry`
- graph relationships from `NexusConstellationEngine`
- focused-node state from `NexusProvider`
- visible-node selection from the viewport model
- actions from `NexusCapabilityRegistry`
- communication modes from `PersistentCommunicationManifest`

The normal user experience must not duplicate the root application list or expose route values, state namespaces, scaffold statuses, graph counts, registry details, or application-boundary contracts.

The viewport intentionally shows only the focused node, nearby nodes, and edge nodes. The remaining registered nodes stay outside the visible field and are reached through touch, keyboard controls, direct routes, or ZAR-directed navigation.

Developer graph diagnostics are preserved only through a development-gated inspector. The default signed-in route must remain the user-facing Nexus home.

## Permanent Root Applications

The permanent Nexus root applications are:

- Identity
- Memory
- Knowledge
- Workspaces
- Projects
- Tools
- Connect
- Settings

Create is not a root application. It is not a constellation node, root route, root state namespace, or root application shell.

Each root application is defined by a `NexusNodeManifest` in `client/src/nexus/manifests/rootManifests.ts`.

## Persistent Communication Layer

Create is the persistent multimodal communication and creation layer through which the user communicates and creates across Nexus.

The approved modes are:

- Text
- Talk
- Image
- Chat
- Doc
- Upload

These modes are defined by `PersistentCommunicationManifest` in `client/src/nexus/communication/persistentCommunication.ts`.

Communication modes are not:

- root applications
- constellation nodes
- workspace nodes
- application shells

They remain globally available regardless of the active root node. Text manages ZAR by Text/SMS access, Chat opens the existing written conversation, and the remaining modes point to Nexus-native communication primitives for browser dictation and file upload.

The persistent communication layer now consumes the existing conversation system directly through the Nexus-owned communication surface. Text prompts, conversation creation, direct conversation loading, message dispatch, file upload, browser dictation, assistant responses, errors, aborts, and cache invalidation remain backed by the existing chat APIs and reusable operational chat utilities.

The visible communication body is owned by Nexus:

- `NexusConversationSurface` owns the communication shell and ZAR-directed action handling.
- `useNexusConversationController` owns runtime conversation mechanics without JSX.
- `NexusConversationRuntime` and its message, composer, upload, attachment, and header primitives own presentation.

Nexus routes must not render the legacy `ChatArea` presentation. The old chat page shell, sidebar, page header, empty-state presentation, legacy composer shell, and legacy framed chat body are not Nexus authorities and are no longer routed as the signed-in experience.

The retained files under `client/src/components/chat/chat-area` are operational utilities, not user-facing shells.

## Node Manifests

`NexusNodeManifest` is the reusable declaration for navigational applications. It includes:

- node identity
- node kind and optional parent
- application boundary
- discovery metadata
- visual metadata
- default expansion state
- node-owned capabilities
- extension metadata

Manifests are registered through `NexusManifestRegistry`. Duplicate node IDs are rejected during registration.

## Application Boundaries

Each root manifest includes an application boundary:

- `basePath`
- `routePattern`
- `stateNamespace`
- `ownsState`
- `status`
- consumed ZAR Core capabilities
- optional current legacy surface route

Application discovery returns only the eight root applications. Communication modes do not appear in root application discovery.

## Navigation Graph

The navigation graph is owned by `NexusConstellationEngine`.

Its responsibilities are:

- registered navigation nodes
- parent-child relationships
- active node state
- expansion and collapse
- navigation trail
- visual connection rendering
- future 2D and 3D positioning metadata

Navigation nodes are generated from root manifests through `NexusManifestRegistry.toNavigationNodes(...)`. The communication layer is not passed to the navigation engine.

## Viewport Model

The constellation viewport is separate from the navigation graph. It does not create nodes or own applications.

The viewport model tracks:

- focused node
- previous node
- viewport offset from touch movement
- navigation source, such as route, touch, keyboard, ZAR, or programmatic
- transition serial for deterministic visual updates

Visible nodes are derived from the graph and current focus. The current implementation renders the focused node, adjacent nodes, and partial edge nodes. This keeps the home extensible when more Nexus nodes are registered later.

## Capability Graph

The capability graph is separate from the navigation graph.

`NexusCapabilityRegistry` owns capability registration and lookup. It supports:

- lookup by capability ID
- lookup by owning root node ID
- lookup by communication-layer ID
- searchable metadata
- actions
- permissions
- dependencies
- graph snapshots
- unresolved dependency reporting

Root application capabilities are node-owned.

Communication capabilities are owned by `persistent-communication`, not by a Nexus node.

Current communication capability IDs are:

- `create.text`
- `create.talk`
- `create.image`
- `create.draw`
- `create.document`
- `create.upload`

The former root-owned creation ideas are represented by communication capabilities now. `create.text` replaces the previous conversation-creation root capability, and `create.document` carries the previous draft/document creation intent. Create-owned root capabilities must not be added back to `NexusNodeManifest`.

## Dependency Handling

Capability dependencies are graph edges between capabilities, not navigation links between nodes.

Unknown capability dependencies are retained as unresolved graph metadata. They do not crash registration, do not create navigation links, and do not fabricate missing capabilities.

## Duplicate Protection

The registries enforce:

- duplicate node manifest ID rejection
- duplicate capability ID rejection
- node capability ownership consistency
- communication capability ownership consistency

This prevents two applications or communication modes from silently claiming the same Nexus capability identity.

## Route Behavior

Valid root application routes follow:

- `/nexus`
- `/nexus/:nodeId`
- `/nexus/:nodeId/:view?`

`nodeId` must be one of the eight permanent roots.

`/nexus/create` is not a root application route. The current compatibility behavior redirects unknown Nexus node routes, including `/nexus/create`, back to `/nexus`.

The existing chat route remains separate:

- `/chat`
- `/chat/:id?`

That route is a compatibility route into the Nexus persistent communication surface, not a separate application shell and not a Nexus root application. `/chat/:id` means "open this conversation inside Nexus communication state." It does not render legacy navigation, legacy branding, or a root application.

Feature routes such as `/projects`, `/workspace`, `/learning`, `/flows`, and `/history` remain existing product surfaces. A Nexus root focus route such as `/nexus/projects` means "Projects is the current Nexus focus." It is not the same thing as the existing Projects feature route and does not imply that the native Projects root application has been implemented.

## ZAR-Directed Navigation

The home exposes a typed programmatic navigation contract through the viewport model, Nexus provider, and `NexusClientAction` validation boundary.

ZAR-directed navigation may resolve:

- a root node by manifest ID, label, tags, or description
- a node-owned capability through the central capability registry
- a communication capability through the persistent communication layer

Supported client actions are:

- `focus-node`
- `open-capability`
- `open-communication`
- `navigate-route`

Each action is validated against the manifest registry, capability registry, communication manifest, and safe internal route rules before it can update Nexus state. Invalid or unavailable actions are ignored safely and do not discard the conversational response.

Resolution focuses the node and uses the existing Nexus route. Communication capability resolution opens the Nexus-owned communication surface, currently `/chat`.

The deterministic local resolver is intentionally narrow. It is only a shortcut for exact commands such as "Open Memory." Ambiguous or substantive requests go through the real conversation pipeline so the original prompt is preserved.

The resolver does not create AI intent logic, does not implement root applications, and does not make provider adapters aware of Nexus internals.

## Extension Model

New Nexus navigational applications can be added by registering a new `NexusNodeManifest`. The constellation engine does not need to be modified when a manifest is added.

New communication modes can be represented by communication-layer capabilities without registering navigation nodes and without modifying `NexusConstellationEngine`.

## Non-Goals

This architecture does not:

- implement root applications
- redesign Nexus UI
- replace the existing conversation engine
- add contextual composer behavior
- duplicate ZAR Core
- create backend persistence
- modify Identity, Memory, Knowledge, Workspaces, Projects, Tools, Connect, or Settings behavior
- make the capability graph authoritative for runtime permissions

Runtime security and user understanding remain owned by the existing ZAR Kernel and ZAR Core backend boundaries.
