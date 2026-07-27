import type { NexusInteractionStage } from "../scene/nexusSceneContract";

/**
 * Pure decision logic for NexusRootPage's target/orbit/hub/enter sequence,
 * pulled out of the component so it's directly unit-testable without a
 * jsdom/timer-simulation harness (this project's Nexus tests render via
 * react-dom/server's renderToStaticMarkup, which never runs effects).
 * NexusRootPage is the thin React glue: it calls these, then owns the
 * actual timers/refs.
 */

/**
 * STATE 0/1/2 entry: what stage should a route change to a node land on,
 * and does it need to wait through a brief Target beat first?
 *
 * - Home (routeNodeId null): stage is "home", nothing to wait on.
 * - Reduced motion: straight to "hub" - no camera animation to wait through.
 * - Already focused on a (possibly different) node - a swipe committing to
 *   the next planet while already zoomed in: straight to "hub", no
 *   re-entrance replay. The camera's already there; only the focused node
 *   (and its Hub content) changes.
 * - First render for this mount (direct load of /nexus/:nodeId, including
 *   Back from a workspace): straight to "orbit" with a short entrance
 *   settle - nothing was just tapped, so Target would just replay an
 *   transition that didn't happen.
 * - Otherwise (an actual tap while already mounted, from Home): "target"
 *   first, brief but real, before Orbit's camera movement begins.
 */
export function resolveNexusStageOnRouteChange(input: {
  readonly routeNodeId: string | null;
  readonly reducedMotion: boolean;
  readonly isFirstRenderForMount: boolean;
  readonly wasAlreadyFocused?: boolean;
}): { readonly stage: NexusInteractionStage; readonly awaitsTargetBeat: boolean } {
  if (!input.routeNodeId) return { stage: "home", awaitsTargetBeat: false };
  if (input.reducedMotion) return { stage: "hub", awaitsTargetBeat: false };
  if (input.wasAlreadyFocused) return { stage: "hub", awaitsTargetBeat: false };
  if (input.isFirstRenderForMount) return { stage: "orbit", awaitsTargetBeat: false };
  return { stage: "target", awaitsTargetBeat: true };
}

/**
 * STATE 2 -> 3 gate: a camera-settle event (or the bounded fallback timer)
 * only advances to Hub when it's still for the currently-targeted node and
 * we're still actually waiting in "orbit" - otherwise it's stale (the user
 * retargeted, or we already arrived) and must be ignored.
 */
export function shouldAcceptNexusOrbitSettle(
  settledNodeId: string,
  routeNodeId: string | null,
  currentStage: NexusInteractionStage,
): boolean {
  return currentStage === "orbit" && settledNodeId === routeNodeId;
}

export type NexusEnterDecision =
  | { readonly kind: "noop" }
  | { readonly kind: "navigate-internal"; readonly route: string }
  | { readonly kind: "warp"; readonly route: string };

/**
 * STATE 4 (Enter) gate: only a real external workspace route triggers
 * Warp. A route-less action is a no-op (nothing to fabricate). An
 * internal /nexus/... action navigates directly - it never left Nexus, so
 * there's nothing to warp from. A second call while already warping is
 * ignored so duplicate clicks can't queue a second navigation.
 */
export function resolveNexusEnterAction(route: string | null, alreadyWarping: boolean): NexusEnterDecision {
  if (!route) return { kind: "noop" };
  if (route.startsWith("/nexus")) return { kind: "navigate-internal", route };
  if (alreadyWarping) return { kind: "noop" };
  return { kind: "warp", route };
}
