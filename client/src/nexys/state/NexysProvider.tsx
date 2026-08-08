import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

import { NexysCapabilityRegistry } from "../capabilities/NexysCapabilityRegistry";
import { nexysCapabilityRegistry } from "../capabilities/centralCapabilityRegistry";
import { PERSISTENT_COMMUNICATION_MANIFEST } from "../communication/persistentCommunication";
import type { PersistentCommunicationManifest } from "../communication/types";
import { NexysConstellationEngine } from "../graph/NexysConstellationEngine";
import { nexysConstellationEngine } from "../graph/rootConstellation";
import type { NexysGraphSnapshot, NexysGraphState, NexysNodeId } from "../graph/types";
import {
  clearNexysViewportFocus,
  createNexysViewportState,
  focusNexysViewportNode,
  getAdjacentNexysNode,
  getNexysViewportSnapshot,
  panNexysViewport,
  type NexysViewportNavigationSource,
  type NexysViewportSnapshot,
  type NexysViewportState,
} from "../viewport/NexysViewportModel";

type NexysAction =
  | { type: "activate"; nodeId: NexysNodeId };

type NexysViewportAction =
  | { type: "focus"; nodeId: NexysNodeId; source: NexysViewportNavigationSource }
  | { type: "pan"; deltaX: number; deltaY: number; source: NexysViewportNavigationSource }
  | { type: "unfocus"; source: NexysViewportNavigationSource };

interface NexysContextValue {
  readonly engine: NexysConstellationEngine;
  readonly capabilityRegistry: NexysCapabilityRegistry;
  readonly communicationLayer: PersistentCommunicationManifest;
  readonly state: NexysGraphState;
  readonly snapshot: NexysGraphSnapshot;
  readonly viewport: NexysViewportState;
  readonly viewportSnapshot: NexysViewportSnapshot;
  readonly activateNode: (nodeId: NexysNodeId) => void;
  readonly focusNode: (nodeId: NexysNodeId, source?: NexysViewportNavigationSource) => void;
  /** Home must be a truly neutral state - clears visual focus without touching activeNodeId. */
  readonly clearFocus: (source?: NexysViewportNavigationSource) => void;
  readonly focusAdjacentNode: (direction: "previous" | "next", source?: NexysViewportNavigationSource) => NexysNodeId | null;
  readonly navigateToNode: (nodeId: NexysNodeId, source?: NexysViewportNavigationSource) => void;
  readonly panViewport: (deltaX: number, deltaY: number, source?: NexysViewportNavigationSource) => void;
}

const NexysContext = createContext<NexysContextValue | null>(null);

export function NexysProvider({
  children,
  engine = nexysConstellationEngine,
  capabilityRegistry = nexysCapabilityRegistry,
  communicationLayer = PERSISTENT_COMMUNICATION_MANIFEST,
}: {
  readonly children: ReactNode;
  readonly engine?: NexysConstellationEngine;
  readonly capabilityRegistry?: NexysCapabilityRegistry;
  readonly communicationLayer?: PersistentCommunicationManifest;
}) {
  const initialGraphState = useMemo(() => engine.createInitialState(), [engine]);

  const reducer = useCallback((state: NexysGraphState, action: NexysAction): NexysGraphState => {
    switch (action.type) {
      case "activate":
        return engine.activateNode(state, action.nodeId);
      default:
        return state;
    }
  }, [engine]);

  const viewportReducer = useCallback((state: NexysViewportState, action: NexysViewportAction): NexysViewportState => {
    switch (action.type) {
      case "focus":
        return focusNexysViewportNode(state, action.nodeId, action.source);
      case "pan":
        return panNexysViewport(state, { x: action.deltaX, y: action.deltaY }, action.source);
      case "unfocus":
        return clearNexysViewportFocus(state, action.source);
      default:
        return state;
    }
  }, []);

  const [state, dispatch] = useReducer(reducer, initialGraphState);
  const [viewport, dispatchViewport] = useReducer(
    viewportReducer,
    createNexysViewportState(initialGraphState.activeNodeId),
  );
  const snapshot = useMemo(() => engine.snapshot(state), [engine, state]);
  const viewportSnapshot = useMemo(
    () => getNexysViewportSnapshot(snapshot, viewport),
    [snapshot, viewport],
  );

  const focusNode = useCallback((
    nodeId: NexysNodeId,
    source: NexysViewportNavigationSource = "programmatic",
  ) => {
    dispatch({ type: "activate", nodeId });
    dispatchViewport({ type: "focus", nodeId, source });
  }, []);

  const clearFocus = useCallback((source: NexysViewportNavigationSource = "route") => {
    dispatchViewport({ type: "unfocus", source });
  }, []);

  const focusAdjacentNode = useCallback((
    direction: "previous" | "next",
    source: NexysViewportNavigationSource = "keyboard",
  ): NexysNodeId | null => {
    const currentNodeId = viewport.focusedNodeId ?? snapshot.activeNode?.id ?? null;
    const nextNode = getAdjacentNexysNode(snapshot, currentNodeId, direction);
    if (!nextNode) return null;
    focusNode(nextNode.id, source);
    return nextNode.id;
  }, [focusNode, snapshot, viewport.focusedNodeId]);

  const value = useMemo<NexysContextValue>(() => ({
    engine,
    capabilityRegistry,
    communicationLayer,
    state,
    snapshot,
    viewport,
    viewportSnapshot,
    activateNode: (nodeId) => focusNode(nodeId, "programmatic"),
    focusNode,
    clearFocus,
    focusAdjacentNode,
    navigateToNode: (nodeId, source = "zar") => focusNode(nodeId, source),
    panViewport: (deltaX, deltaY, source = "touch") => dispatchViewport({ type: "pan", deltaX, deltaY, source }),
  }), [
    capabilityRegistry,
    clearFocus,
    communicationLayer,
    engine,
    focusAdjacentNode,
    focusNode,
    snapshot,
    state,
    viewport,
    viewportSnapshot,
  ]);

  return <NexysContext.Provider value={value}>{children}</NexysContext.Provider>;
}

export function useNexys(): NexysContextValue {
  const value = useContext(NexysContext);
  if (!value) throw new Error("useNexys must be used inside NexysProvider.");
  return value;
}
