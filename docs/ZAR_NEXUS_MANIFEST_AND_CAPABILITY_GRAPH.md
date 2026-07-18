# ZAR Nexus Manifest and Capability Graph

## Purpose

Nexus is the root navigation architecture for ZAR. It presents permanent root applications while keeping navigation, application discovery, capability discovery, and communication modes separate.

The Nexus layer does not own ZAR Core identity, memory, knowledge, Constitution, response policy, or learning behavior. Nexus consumes ZAR Core through declared metadata and capability contracts.

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
- Draw
- Doc
- Upload

These modes are defined by `PersistentCommunicationManifest` in `client/src/nexus/communication/persistentCommunication.ts`.

Communication modes are not:

- root applications
- constellation nodes
- workspace nodes
- application shells

They remain globally available regardless of the active root node. The current implementation points to existing chat, dictation, and file-upload surfaces where those surfaces already exist. Draw is represented as a scaffolded communication capability only; this slice does not implement drawing UI.

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

That route is an existing communication surface, not a Nexus root application.

## Extension Model

New Nexus navigational applications can be added by registering a new `NexusNodeManifest`. The constellation engine does not need to be modified when a manifest is added.

New communication modes can be represented by communication-layer capabilities without registering navigation nodes and without modifying `NexusConstellationEngine`.

## Non-Goals

This architecture does not:

- implement root applications
- redesign Nexus UI
- implement a new composer
- add contextual composer behavior
- duplicate ZAR Core
- create backend persistence
- modify Identity, Memory, Knowledge, Workspaces, Projects, Tools, Connect, or Settings behavior
- make the capability graph authoritative for runtime permissions

Runtime security and user understanding remain owned by the existing ZAR Kernel and ZAR Core backend boundaries.
