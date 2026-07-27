import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";

import { useAuth } from "@/components/auth/UseAuth";
import { ConsoleShell } from "@/console/ConsoleShell";
import { ZAR_NEXUS_CONSOLE } from "@/console/consoleIdentity";
import NexusCore from "../components/NexusCore";
import { NexusDeveloperInspector } from "../components/NexusDeveloperInspector";
import { NexusHubOverlay } from "../components/NexusHubOverlay";
import type { NexusDomain } from "../components/NexusCore";
import { isNexusRootNodeId, routeForNexusNode } from "../graph/rootConstellation";
import { nexusDomainsFromRootNodes } from "../scene/nexusDomainAdapter";
import { canUseNexusWebgl, type NexusInteractionStage } from "../scene/nexusSceneContract";
import { useNexus } from "../state/NexusProvider";
import { createFocusedNodeView, shouldShowNexusDeveloperInspector } from "../viewport/NexusViewportModel";
import { resolveNexusEnterAction, resolveNexusStageOnRouteChange } from "./nexusInteractionStageModel";

/** How long the "target" beat holds before Orbit's camera movement begins - brief but real, not instant. */
const TARGET_BEAT_MS = 16;
/**
 * NexusCore's own camera dolly doesn't expose a settle callback (it's the
 * official Emergent scene behavior - not something this pass alters), so
 * Orbit -> Hub advances on a bounded timer matched to the rig's own easing
 * (Math.min(1, 4.5*delta), which is visually settled well within this window).
 */
const ORBIT_SETTLE_MS = 900;
/** How long Warp plays before the real workspace route loads. */
const WARP_DURATION_MS = 380;

export default function NexusRootPage() {
  const params = useParams<{ nodeId?: string }>();
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const { focusNode, clearFocus, snapshot, viewportSnapshot, capabilityRegistry } = useNexus();
  const routeNodeId = isNexusRootNodeId(params.nodeId) ? params.nodeId : null;
  const hasUnknownRouteNode = Boolean(params.nodeId && !routeNodeId);
  const displayName = user?.personalization?.displayName ?? user?.displayName ?? user?.firstName ?? user?.username ?? "there";
  const greeting = useMemo(() => timeOfDayGreeting(new Date().getHours()), []);
  const showInspector = useMemo(() => shouldShowNexusDeveloperInspector({
    isDevelopment: Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV),
    queryString: typeof window === "undefined" ? "" : window.location.search,
  }), [location]);

  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(media.matches);
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const [webgl, setWebgl] = useState(true);
  useEffect(() => setWebgl(canUseNexusWebgl()), []);

  const [dockPowered, setDockPowered] = useState(false);

  // Real manifest nodes -> the official scene's domain shape. No prototype
  // DEFAULT_DOMAINS anywhere in the production path.
  const domains = useMemo(() => nexusDomainsFromRootNodes(snapshot.rootNodes), [snapshot.rootNodes]);

  // Ambient "nearest while rotating" indicator - Emergent's own onFocusChange
  // concept, distinct from a deliberate tap. Purely local/visual; does not
  // touch routing or the provider's focus. Shown next to the header (where a
  // raw heading-degree readout used to be) since the planet's name is what's
  // actually useful there - the numeric heading isn't.
  const [ambientDomain, setAmbientDomain] = useState<NexusDomain | null>(null);

  // Route only decides Home vs. a selected node. target/orbit/hub/enter is
  // transient client state layered on top here, so route state and
  // animation-timing state stay clearly separated (provider owns
  // selected/focused node data; this page owns the transition sequence).
  const [stage, setStage] = useState<NexusInteractionStage>(
    () => resolveNexusStageOnRouteChange({ routeNodeId, reducedMotion: false, isFirstRenderForMount: true }).stage,
  );
  const [warping, setWarping] = useState(false);

  const isFirstRouteEffect = useRef(true);
  const targetTimerRef = useRef<number | null>(null);
  const orbitTimerRef = useRef<number | null>(null);
  const warpTimerRef = useRef<number | null>(null);
  const warpingRef = useRef(false);

  const clearTargetTimer = useCallback(() => {
    if (targetTimerRef.current !== null) {
      window.clearTimeout(targetTimerRef.current);
      targetTimerRef.current = null;
    }
  }, []);
  const clearOrbitTimer = useCallback(() => {
    if (orbitTimerRef.current !== null) {
      window.clearTimeout(orbitTimerRef.current);
      orbitTimerRef.current = null;
    }
  }, []);
  const clearWarpTimer = useCallback(() => {
    if (warpTimerRef.current !== null) {
      window.clearTimeout(warpTimerRef.current);
      warpTimerRef.current = null;
    }
    warpingRef.current = false;
  }, []);

  useEffect(() => {
    if (hasUnknownRouteNode) navigate("/nexus");
  }, [hasUnknownRouteNode, navigate]);

  // The core STATE 0/1/2/3 sequence. Re-runs whenever the selected node
  // changes (a fresh tap, a different node, or Back to Home) - each run
  // cancels whatever the previous run was waiting on, so rapid re-targeting
  // can never reveal stale Hub data or leave a stray timer behind.
  useEffect(() => {
    const wasFirstRun = isFirstRouteEffect.current;
    isFirstRouteEffect.current = false;
    // A swipe committing to a new planet while already zoomed in re-runs
    // this effect (routeNodeId changes) same as a tap does - this is what
    // tells it "skip the re-entrance, we're already there."
    const wasAlreadyFocused = stage !== "home";

    clearTargetTimer();
    clearOrbitTimer();
    clearWarpTimer();
    setWarping(false);

    if (!routeNodeId) {
      // STATE 0 (Home): must be truly neutral - no stale focus, no Hub reveal,
      // full official universe composition restored.
      clearFocus("route");
      setStage("home");
      return;
    }

    focusNode(routeNodeId, "route");

    const decision = resolveNexusStageOnRouteChange({
      routeNodeId,
      reducedMotion,
      isFirstRenderForMount: wasFirstRun,
      wasAlreadyFocused,
    });
    setStage(decision.stage);
    if (decision.stage === "orbit") {
      orbitTimerRef.current = window.setTimeout(() => setStage("hub"), ORBIT_SETTLE_MS);
    }
    if (decision.awaitsTargetBeat) {
      // STATE 1 (Target): brief but real - acknowledge the tap for one
      // paint before Orbit's camera movement begins.
      targetTimerRef.current = window.setTimeout(() => {
        setStage("orbit");
        orbitTimerRef.current = window.setTimeout(() => setStage("hub"), ORBIT_SETTLE_MS);
      }, TARGET_BEAT_MS);
    }

    return () => {
      clearTargetTimer();
      clearOrbitTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeNodeId, reducedMotion]);

  // Cancel every pending timer on unmount (e.g. the user navigates away
  // through some other path while Target/Orbit/Warp is mid-flight).
  useEffect(() => () => {
    clearTargetTimer();
    clearOrbitTimer();
    clearWarpTimer();
  }, [clearTargetTimer, clearOrbitTimer, clearWarpTimer]);

  // STATE 1 (Target): a deliberate tap on a celestial hub - never an
  // immediate workspace open. Ambient rotation (onFocusChange) does not
  // reach here at all.
  const handleDomainSelect = useCallback((domain: NexusDomain) => {
    navigate(routeForNexusNode(domain.id));
  }, [navigate]);

  const goHome = useCallback(() => navigate("/nexus"), [navigate]);

  // STATE 4 (Enter): only trigger Warp when the action actually leaves Nexus for
  // a real workspace. Some capability actions still route back into /nexus/...
  // (their workspace isn't built yet) - those are internal, so skip the warp
  // theater and just navigate; nothing to fabricate a transition for.
  const enterWorkspace = useCallback((route: string | null) => {
    const decision = resolveNexusEnterAction(route, warpingRef.current);
    if (decision.kind === "noop") return;
    if (decision.kind === "navigate-internal") {
      navigate(decision.route);
      return;
    }
    warpingRef.current = true;
    setStage("enter");
    setWarping(true);
    warpTimerRef.current = window.setTimeout(() => {
      warpTimerRef.current = null;
      navigate(decision.route);
    }, reducedMotion ? 0 : WARP_DURATION_MS);
  }, [navigate, reducedMotion]);

  // A direct tap on the planet that's already front-and-center (already
  // zoomed in) activates Warp straight away - there's no separate action
  // row to choose from, so this is the only way in. Self-loop actions
  // (a node with no real page yet) are skipped in favor of its first real
  // external destination.
  const handleFocusedTap = useCallback((domain: NexusDomain) => {
    const node = viewportSnapshot.focusedNode;
    if (!node || node.id !== domain.id) return;
    const view = createFocusedNodeView(node, capabilityRegistry);
    const selfLoop = `/nexus/${domain.id}`;
    const realAction = view.actions.find((action) => action.route && action.route !== selfLoop);
    if (!realAction) return;
    enterWorkspace(realAction.route);
  }, [viewportSnapshot.focusedNode, capabilityRegistry, enterWorkspace]);

  const focusedNode = viewportSnapshot.focusedNode;
  const focusMode = stage !== "home";
  const atmosphereColor = focusMode ? focusedNode?.metadata.visual.color ?? null : null;
  const showHub = stage === "hub" || stage === "enter";

  return (
    <ConsoleShell
      identity={ZAR_NEXUS_CONSOLE}
      dockPowered={dockPowered}
      onDockPowerChange={setDockPowered}
      headerLeft={
        <div className="min-w-0">
          <div className="bg-gradient-to-r from-violet-400 via-fuchsia-300 to-cyan-300 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent sm:text-3xl">
            ZAR
          </div>
          <h1
            className="mt-1 truncate text-base font-medium text-white transition-opacity duration-300 sm:text-lg"
            style={{ opacity: stage === "home" ? 1 : 0 }}
          >
            {greeting}, {displayName}
          </h1>
          <p
            className="truncate text-[13px] text-white/45 transition-opacity duration-300"
            style={{ opacity: stage === "home" ? 1 : 0 }}
          >
            How can I assist you today?
          </p>
        </div>
      }
      headerRightExtra={
        stage === "home" && ambientDomain ? (
          <div
            className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 backdrop-blur"
            style={{ animation: "nexus-settle 300ms ease both" }}
          >
            <span
              className="block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: ambientDomain.color, boxShadow: `0 0 8px 2px ${ambientDomain.color}88` }}
              aria-hidden="true"
            />
            <span className="text-[10px] font-medium tracking-[0.2em] text-white/70">
              {ambientDomain.label}
            </span>
          </div>
        ) : undefined
      }
    >
      {/* Celestial system - fills the entire viewport. This IS the application screen. */}
      <div className="absolute inset-0" data-nexus-region="scene">
        {webgl ? (
          <NexusCore
            domains={domains}
            onFocusChange={setAmbientDomain}
            onDomainSelect={handleDomainSelect}
            onCoreTap={goHome}
            zoom={focusMode ? 1.8 : 1}
            warp={stage === "enter"}
            atmosphere={atmosphereColor}
            focusMode={focusMode}
            onSwipeCommit={handleDomainSelect}
            onFocusedTap={handleFocusedTap}
            focusedDomainId={focusMode ? focusedNode?.id ?? null : null}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-white/50">
            Nexus needs a WebGL-capable browser to render the universe.
          </div>
        )}
      </div>

      {/* Atmospheric tint - each hub subtly shifts the environment on entry. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: atmosphereColor
            ? `radial-gradient(ellipse 85% 70% at 50% 45%, ${atmosphereColor}26 0%, ${atmosphereColor}10 40%, transparent 75%)`
            : "transparent",
          opacity: atmosphereColor ? 1 : 0,
          transition: "opacity 700ms ease",
        }}
        aria-hidden="true"
      />

      {/* STATE 3 (Hub): the gateway reveal, still inside Nexus. */}
      {showHub && <NexusHubOverlay onBack={goHome} />}

      {showInspector && <NexusDeveloperInspector />}

      <style>{`
        @keyframes nexus-settle { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      `}</style>
    </ConsoleShell>
  );
}

function timeOfDayGreeting(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
