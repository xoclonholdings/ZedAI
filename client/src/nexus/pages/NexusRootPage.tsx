import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
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
  const greeting = useMemo(() => timeOfDayGreeting(new Date().getHours()), []);
  const showInspector = useMemo(() => shouldShowNexusDeveloperInspector({
    isDevelopment: Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV),
    queryString: typeof window === "undefined" ? "" : window.location.search,
  }), [location]);

  // STATE 0 (Home) vs STATE 2/3 (Orbit/Hub) is derived from the route itself -
  // /nexus is Home, /nexus/:nodeId is Orbit/Hub for that node. No separate
  // client state to drift out of sync, and it's what makes "workspace back ->
  // resumes the Hub, not Home" fall out of ordinary browser back navigation.
  const stage = routeNodeId ? "hub" : "home";
  const [warping, setWarping] = useState(false);

  useEffect(() => {
    if (routeNodeId) focusNode(routeNodeId, "route");
  }, [focusNode, routeNodeId]);

  useEffect(() => {
    if (hasUnknownRouteNode) navigate("/nexus");
  }, [hasUnknownRouteNode, navigate]);

  // STATE 4 (Enter): only trigger Warp when the action actually leaves Nexus for
  // a real workspace. Some capability actions still route back into /nexus/...
  // (their workspace isn't built yet) - those are internal, so skip the warp
  // theater and just navigate; nothing to fabricate a transition for.
  function enterWorkspace(route: string | null) {
    if (!route) return;
    if (route.startsWith("/nexus")) {
      navigate(route);
      return;
    }
    setWarping(true);
    window.setTimeout(() => navigate(route), 380);
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#02030a] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(180deg,rgba(8,13,28,0.85),rgba(0,0,0,1)_60%),radial-gradient(circle_at_20%_0%,rgba(167,139,250,0.1),transparent_40%),radial-gradient(circle_at_85%_10%,rgba(34,211,238,0.1),transparent_38%),radial-gradient(circle_at_75%_90%,rgba(251,146,60,0.05),transparent_32%)]" />
      <div
        className="nexus-particle-field pointer-events-none fixed inset-0 -z-10 opacity-40 motion-safe:animate-[nexus-twinkle_9s_ease-in-out_infinite] motion-reduce:animate-none"
        aria-hidden="true"
      />

      <header className="shrink-0 px-4 pt-safe-sm sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 py-4 sm:py-5">
          <div className="min-w-0">
            <div className="bg-gradient-to-r from-violet-400 via-fuchsia-300 to-cyan-300 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent sm:text-3xl">
              ZAR
            </div>
            <h1 className="mt-1 truncate text-base font-medium text-white sm:text-lg">
              {greeting}, {displayName}
            </h1>
            <p className="truncate text-[13px] text-white/45">How can I assist you today?</p>
          </div>
          <button
            type="button"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.03] text-violet-200 shadow-[0_0_18px_rgba(167,139,250,0.25)] transition hover:border-violet-300/50 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-200/50"
            aria-label="Ask ZAR"
          >
            <Sparkles size={18} />
          </button>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-3 overflow-hidden px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="nexus-home-grid">
          <div data-nexus-region="constellation">
            <NexusConstellation stage={stage} warping={warping} />
          </div>
          <div data-nexus-region="communication">
            <NexusCommunicationDock conversationId={communicationConversationId} />
          </div>
          {stage === "hub" && (
            <div data-nexus-region="focused">
              <NexusFocusedNodePanel variant="compact" className="lg:hidden" onEnterAction={enterWorkspace} onBack={() => navigate("/nexus")} />
              <NexusFocusedNodePanel variant="panel" className="hidden lg:block" onEnterAction={enterWorkspace} onBack={() => navigate("/nexus")} />
            </div>
          )}
        </div>
      </main>

      {showInspector && <NexusDeveloperInspector />}
    </div>
  );
}

function timeOfDayGreeting(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
