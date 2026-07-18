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

type NexusAction =
  | { type: "activate"; nodeId: NexusNodeId }
  | { type: "expand"; nodeId: NexusNodeId }
  | { type: "collapse"; nodeId: NexusNodeId }
  | { type: "toggle"; nodeId: NexusNodeId };

interface NexusContextValue {
  readonly engine: NexusConstellationEngine;
  readonly capabilityRegistry: NexusCapabilityRegistry;
  readonly communicationLayer: PersistentCommunicationManifest;
  readonly state: NexusGraphState;
  readonly snapshot: NexusGraphSnapshot;
  readonly activateNode: (nodeId: NexusNodeId) => void;
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

  const [state, dispatch] = useReducer(reducer, engine.createInitialState());
  const snapshot = useMemo(() => engine.snapshot(state), [engine, state]);

  const value = useMemo<NexusContextValue>(() => ({
    engine,
    capabilityRegistry,
    communicationLayer,
    state,
    snapshot,
    activateNode: (nodeId) => dispatch({ type: "activate", nodeId }),
    expandNode: (nodeId) => dispatch({ type: "expand", nodeId }),
    collapseNode: (nodeId) => dispatch({ type: "collapse", nodeId }),
    toggleNode: (nodeId) => dispatch({ type: "toggle", nodeId }),
  }), [capabilityRegistry, communicationLayer, engine, snapshot, state]);

  return <NexusContext.Provider value={value}>{children}</NexusContext.Provider>;
}

export function useNexus(): NexusContextValue {
  const value = useContext(NexusContext);
  if (!value) throw new Error("useNexus must be used inside NexusProvider.");
  return value;
}
