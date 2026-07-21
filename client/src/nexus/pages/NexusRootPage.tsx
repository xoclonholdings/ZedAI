import { useEffect, useMemo } from "react";
import { useLocation, useParams } from "wouter";

import { useAuth } from "@/components/auth/UseAuth";
import { NexusCommunicationDock } from "../components/NexusCommunicationDock";
import { NexusConstellation } from "../components/NexusConstellation";
import { NexusDeveloperInspector } from "../components/NexusDeveloperInspector";
import { NexusFocusedNodePanel } from "../components/NexusFocusedNodePanel";
import { isNexusRootNodeId } from "../graph/rootConstellation";
import { useNexus } from "../state/NexusProvider";
import { shouldShowNexusDeveloperInspector } from "../viewport/NexusViewportModel";

interface NexusRootPageProps {
  readonly communicationConversationId?: string | null;
}

export default function NexusRootPage({
  communicationConversationId,
}: NexusRootPageProps = {}) {
  const params = useParams<{ nodeId?: string }>();
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { focusNode } = useNexus();
  const routeNodeId = isNexusRootNodeId(params.nodeId) ? params.nodeId : null;
  const hasUnknownRouteNode = Boolean(params.nodeId && !routeNodeId);
  const displayName = user?.personalization?.displayName ?? user?.displayName ?? user?.firstName ?? user?.username ?? "there";
  const showInspector = useMemo(() => shouldShowNexusDeveloperInspector({
    isDevelopment: Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV),
    queryString: typeof window === "undefined" ? "" : window.location.search,
  }), [location]);

  useEffect(() => {
    if (routeNodeId) focusNode(routeNodeId, "route");
  }, [focusNode, routeNodeId]);

  useEffect(() => {
    if (hasUnknownRouteNode) navigate("/nexus");
  }, [hasUnknownRouteNode, navigate]);

  return (
    <div className="min-h-screen bg-[#02030a] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(180deg,rgba(8,13,28,0.82),rgba(0,0,0,1)_58%),linear-gradient(120deg,rgba(34,211,238,0.11),transparent_32%,rgba(244,114,182,0.08)_72%,transparent)]" />

      <header className="px-4 pt-safe-sm sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 py-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/58">
              ZAR
            </div>
            <h1 className="mt-1 truncate text-xl font-semibold text-white sm:text-2xl">
              Welcome back, {displayName}
            </h1>
          </div>
          <div className="hidden rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-[12px] text-white/58 backdrop-blur-md sm:block">
            Nexus Home
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pb-safe sm:px-6">
        <div className="nexus-home-grid">
          <div data-nexus-region="constellation">
            <NexusConstellation />
          </div>
          <div data-nexus-region="communication">
            <NexusCommunicationDock conversationId={communicationConversationId} />
          </div>
          <div data-nexus-region="focused" className="lg:pt-8">
            <NexusFocusedNodePanel />
          </div>
        </div>

        {showInspector && <NexusDeveloperInspector />}
      </main>
    </div>
  );
}
