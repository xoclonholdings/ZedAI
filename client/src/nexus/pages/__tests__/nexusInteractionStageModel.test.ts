import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveNexusEnterAction,
  resolveNexusStageOnRouteChange,
  shouldAcceptNexusOrbitSettle,
} from "../nexusInteractionStageModel";

test("Home (no route node) always resolves to the home stage", () => {
  const result = resolveNexusStageOnRouteChange({
    routeNodeId: null,
    reducedMotion: false,
    isFirstRenderForMount: false,
  });
  assert.deepEqual(result, { stage: "home", awaitsTargetBeat: false });
});

test("a tap while already mounted begins with a brief Target beat before Orbit", () => {
  const result = resolveNexusStageOnRouteChange({
    routeNodeId: "memory",
    reducedMotion: false,
    isFirstRenderForMount: false,
  });
  assert.deepEqual(result, { stage: "target", awaitsTargetBeat: true });
});

test("direct loading of /nexus/:nodeId (or Back from a workspace) skips Target and resolves straight to Orbit", () => {
  const result = resolveNexusStageOnRouteChange({
    routeNodeId: "memory",
    reducedMotion: false,
    isFirstRenderForMount: true,
  });
  assert.deepEqual(result, { stage: "orbit", awaitsTargetBeat: false });
});

test("swiping to a new planet while already focused lands straight on Hub - no Target/Orbit replay", () => {
  const result = resolveNexusStageOnRouteChange({
    routeNodeId: "projects",
    reducedMotion: false,
    isFirstRenderForMount: false,
    wasAlreadyFocused: true,
  });
  assert.deepEqual(result, { stage: "hub", awaitsTargetBeat: false });
});

test("reduced motion reaches a usable Hub immediately, whether tapped or directly loaded", () => {
  const tapped = resolveNexusStageOnRouteChange({
    routeNodeId: "memory",
    reducedMotion: true,
    isFirstRenderForMount: false,
  });
  const direct = resolveNexusStageOnRouteChange({
    routeNodeId: "memory",
    reducedMotion: true,
    isFirstRenderForMount: true,
  });
  assert.deepEqual(tapped, { stage: "hub", awaitsTargetBeat: false });
  assert.deepEqual(direct, { stage: "hub", awaitsTargetBeat: false });
});

test("an orbit settle is only accepted for the currently-targeted node while still in orbit", () => {
  assert.equal(shouldAcceptNexusOrbitSettle("memory", "memory", "orbit"), true);
  assert.equal(
    shouldAcceptNexusOrbitSettle("memory", "projects", "orbit"),
    false,
    "stale settle for a node the user already navigated away from must be ignored",
  );
  assert.equal(
    shouldAcceptNexusOrbitSettle("memory", "memory", "hub"),
    false,
    "already-settled (Hub) must not re-accept a late/duplicate settle event",
  );
  assert.equal(shouldAcceptNexusOrbitSettle("memory", "memory", "target"), false);
  assert.equal(shouldAcceptNexusOrbitSettle("memory", null, "orbit"), false);
});

test("Warp only fires for a real external workspace route", () => {
  assert.deepEqual(resolveNexusEnterAction("/learning", false), { kind: "warp", route: "/learning" });
});

test("internal /nexus/... actions navigate directly and never Warp", () => {
  assert.deepEqual(
    resolveNexusEnterAction("/nexus/memory", false),
    { kind: "navigate-internal", route: "/nexus/memory" },
  );
  assert.deepEqual(
    resolveNexusEnterAction("/nexus/memory", true),
    { kind: "navigate-internal", route: "/nexus/memory" },
    "internal navigation isn't gated by the warping flag - it never warps in the first place",
  );
});

test("a route-less action is a no-op and never Warps", () => {
  assert.deepEqual(resolveNexusEnterAction(null, false), { kind: "noop" });
});

test("a duplicate click while already warping is ignored, so only one navigation can fire", () => {
  assert.deepEqual(resolveNexusEnterAction("/learning", true), { kind: "noop" });
});
