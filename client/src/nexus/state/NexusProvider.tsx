import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

import { NexusCapabilityRegistry } from "../capabilities/NexusCapabilityRegistry";
import { nexusCapabilityRegistry } from "../capabilities/centralCapabilityRegistry";
import { PERSISTENT_COMMUNICATION_MANIFEST } from "../communication/persistentCommunication";
import type { PersistentCommunicationManifest } from "../communication/types";
import { NexusConstellationEngine } from "../graph/NexusConstellationEngine";
import { nexusConstellationEngine } from "../graph/rootConstellation";
import type { NexusGraphSnapshot, NexusGraphState, NexusNodeId } from "../graph/types";
import {
  createNexusViewportState,
  focusNexusViewportNode,
  getAdjacentNexusNode,
  getNexusViewportSnapshot,
  panNexusViewport,
  type NexusViewportNavigationSource,
  type NexusViewportSnapshot,
  type NexusViewportState,
} from "../viewport/NexusViewportModel";

type NexusAction =
  | { type: "activate"; nodeId: NexusNodeId }
  | { type: "expand"; nodeId: NexusNodeId }
  | { type: "collapse"; nodeId: NexusNodeId }
  | { type: "toggle"; nodeId: NexusNodeId };

type NexusViewportAction =
  | { type: "focus"; nodeId: NexusNodeId; source: NexusViewportNavigationSource }
  | { type: "pan"; deltaX: number; deltaY: number; source: NexusViewportNavigationSource };

interface NexusContextValue {
  readonly engine: NexusConstellationEngine;
  readonly capabilityRegistry: NexusCapabilityRegistry;
  readonly communicationLayer: PersistentCommunicationManifest;
  readonly state: NexusGraphState;
  readonly snapshot: NexusGraphSnapshot;
  readonly viewport: NexusViewportState;
  readonly viewportSnapshot: NexusViewportSnapshot;
  readonly activateNode: (nodeId: NexusNodeId) => void;
  readonly focusNode: (nodeId: NexusNodeId, source?: NexusViewportNavigationSource) => void;
  readonly focusAdjacentNode: (direction: "previous" | "next", source?: NexusViewportNavigationSource) => NexusNodeId | null;
  readonly navigateToNode: (nodeId: NexusNodeId, source?: NexusViewportNavigationSource) => void;
  readonly panViewport: (deltaX: number, deltaY: number, source?: NexusViewportNavigationSource) => void;
  readonly expandNode: (nodeId: NexusNodeId) => void;
  readonly collapseNode: (nodeId: NexusNodeId) => void;
  readonly toggleNode: (nodeId: NexusNodeId) => void;
}

const NexusContext = createContext<NexusContextValue | null>(null);

export function NexusProvider({
  children,
  engine = nexusConstellationEngine,
  capabilityRegistry = nexusCapabilityRegistry,
  communicationLayer = PERSISTENT_COMMUNICATION_MANIFEST,
}: {
  readonly children: ReactNode;
  readonly engine?: NexusConstellationEngine;
  readonly capabilityRegistry?: NexusCapabilityRegistry;
  readonly communicationLayer?: PersistentCommunicationManifest;
}) {
  const initialGraphState = useMemo(() => engine.createInitialState(), [engine]);

  const reducer = useCallback((state: NexusGraphState, action: NexusAction): NexusGraphState => {
    switch (action.type) {
      case "activate":
        return engine.activateNode(state, action.nodeId);
      case "expand":
        return engine.expandNode(state, action.nodeId);
      case "collapse":
        return engine.collapseNode(state, action.nodeId);
      case "toggle":
        return engine.toggleNode(state, action.nodeId);
      default:
        return state;
    }
  }, [engine]);

  const viewportReducer = useCallback((state: NexusViewportState, action: NexusViewportAction): NexusViewportState => {
    switch (action.type) {
      case "focus":
        return focusNexusViewportNode(state, action.nodeId, action.source);
      case "pan":
        return panNexusViewport(state, { x: action.deltaX, y: action.deltaY }, action.source);
      default:
        return state;
    }
  }, []);

  const [state, dispatch] = useReducer(reducer, initialGraphState);
  const [viewport, dispatchViewport] = useReducer(
    viewportReducer,
    createNexusViewportState(initialGraphState.activeNodeId),
  );
  const snapshot = useMemo(() => engine.snapshot(state), [engine, state]);
  const viewportSnapshot = useMemo(
    () => getNexusViewportSnapshot(snapshot, viewport),
    [snapshot, viewport],
  );

  const focusNode = useCallback((
    nodeId: NexusNodeId,
    source: NexusViewportNavigationSource = "programmatic",
  ) => {
    dispatch({ type: "activate", nodeId });
    dispatchViewport({ type: "focus", nodeId, source });
  }, []);

  const focusAdjacentNode = useCallback((
    direction: "previous" | "next",
    source: NexusViewportNavigationSource = "keyboard",
  ): NexusNodeId | null => {
    const currentNodeId = viewport.focusedNodeId ?? snapshot.activeNode?.id ?? null;
    const nextNode = getAdjacentNexusNode(snapshot, currentNodeId, direction);
    if (!nextNode) return null;
    focusNode(nextNode.id, source);
    return nextNode.id;
  }, [focusNode, snapshot, viewport.focusedNodeId]);

  const value = useMemo<NexusContextValue>(() => ({
    engine,
    capabilityRegistry,
    communicationLayer,
    state,
    snapshot,
    viewport,
    viewportSnapshot,
    activateNode: (nodeId) => focusNode(nodeId, "programmatic"),
    focusNode,
    focusAdjacentNode,
    navigateToNode: (nodeId, source = "zar") => focusNode(nodeId, source),
    panViewport: (deltaX, deltaY, source = "touch") => dispatchViewport({ type: "pan", deltaX, deltaY, source }),
    expandNode: (nodeId) => dispatch({ type: "expand", nodeId }),
    collapseNode: (nodeId) => dispatch({ type: "collapse", nodeId }),
    toggleNode: (nodeId) => dispatch({ type: "toggle", nodeId }),
  }), [
    capabilityRegistry,
    communicationLayer,
    engine,
    focusAdjacentNode,
    focusNode,
    snapshot,
    state,
    viewport,
    viewportSnapshot,
  ]);

  return <NexusContext.Provider value={value}>{children}</NexusContext.Provider>;
}

export function useNexus(): NexusContextValue {
  const value = useContext(NexusContext);
  if (!value) throw new Error("useNexus must be used inside NexusProvider.");
  return value;
}
