import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveNexysEnterAction,
  resolveNexysStageOnRouteChange,
  shouldAcceptNexysOrbitSettle,
} from "../nexysInteractionStageModel";

test("Home (no route node) always resolves to the home stage", () => {
  const result = resolveNexysStageOnRouteChange({
    routeNodeId: null,
    reducedMotion: false,
    isFirstRenderForMount: false,
  });
  assert.deepEqual(result, { stage: "home", awaitsTargetBeat: false });
});

test("a tap while already mounted begins with a brief Target beat before Orbit", () => {
  const result = resolveNexysStageOnRouteChange({
    routeNodeId: "memory",
    reducedMotion: false,
    isFirstRenderForMount: false,
  });
  assert.deepEqual(result, { stage: "target", awaitsTargetBeat: true });
});

test("direct loading of /nexys/:nodeId (or Back from a workspace) skips Target and resolves straight to Orbit", () => {
  const result = resolveNexysStageOnRouteChange({
    routeNodeId: "memory",
    reducedMotion: false,
    isFirstRenderForMount: true,
  });
  assert.deepEqual(result, { stage: "orbit", awaitsTargetBeat: false });
});

test("swiping to a new planet while already focused lands straight on Hub - no Target/Orbit replay", () => {
  const result = resolveNexysStageOnRouteChange({
    routeNodeId: "projects",
    reducedMotion: false,
    isFirstRenderForMount: false,
    wasAlreadyFocused: true,
  });
  assert.deepEqual(result, { stage: "hub", awaitsTargetBeat: false });
});

test("reduced motion reaches a usable Hub immediately, whether tapped or directly loaded", () => {
  const tapped = resolveNexysStageOnRouteChange({
    routeNodeId: "memory",
    reducedMotion: true,
    isFirstRenderForMount: false,
  });
  const direct = resolveNexysStageOnRouteChange({
    routeNodeId: "memory",
    reducedMotion: true,
    isFirstRenderForMount: true,
  });
  assert.deepEqual(tapped, { stage: "hub", awaitsTargetBeat: false });
  assert.deepEqual(direct, { stage: "hub", awaitsTargetBeat: false });
});

test("an orbit settle is only accepted for the currently-targeted node while still in orbit", () => {
  assert.equal(shouldAcceptNexysOrbitSettle("memory", "memory", "orbit"), true);
  assert.equal(
    shouldAcceptNexysOrbitSettle("memory", "projects", "orbit"),
    false,
    "stale settle for a node the user already navigated away from must be ignored",
  );
  assert.equal(
    shouldAcceptNexysOrbitSettle("memory", "memory", "hub"),
    false,
    "already-settled (Hub) must not re-accept a late/duplicate settle event",
  );
  assert.equal(shouldAcceptNexysOrbitSettle("memory", "memory", "target"), false);
  assert.equal(shouldAcceptNexysOrbitSettle("memory", null, "orbit"), false);
});

test("Warp only fires for a real external workspace route", () => {
  assert.deepEqual(resolveNexysEnterAction("/learning", false), { kind: "warp", route: "/learning" });
});

test("internal /nexys/... actions navigate directly and never Warp", () => {
  assert.deepEqual(
    resolveNexysEnterAction("/nexys/memory", false),
    { kind: "navigate-internal", route: "/nexys/memory" },
  );
  assert.deepEqual(
    resolveNexysEnterAction("/nexys/memory", true),
    { kind: "navigate-internal", route: "/nexys/memory" },
    "internal navigation isn't gated by the warping flag - it never warps in the first place",
  );
});

test("a route-less action is a no-op and never Warps", () => {
  assert.deepEqual(resolveNexysEnterAction(null, false), { kind: "noop" });
});

test("a duplicate click while already warping is ignored, so only one navigation can fire", () => {
  assert.deepEqual(resolveNexysEnterAction("/learning", true), { kind: "noop" });
});
