/**
 * Shared contract between the WebGL scene and its DOM host. Deliberately
 * free of three.js imports so the host chunk stays light.
 */

/**
 * The five interaction states (see NexysRootPage for the full state machine):
 *
 * "home"   - nothing targeted, camera holds the overview framing.
 * "target" - a hub was just tapped; acknowledged but the camera hasn't
 *            moved yet and the Hub reveal is still hidden.
 * "orbit"  - the camera is dollying toward the targeted hub; still inside
 *            Nexys, rest of the universe stays visible, Hub still hidden.
 * "hub"    - the camera has arrived; the Hub's gateway actions are
 *            revealed. Still inside Nexys - no workspace has loaded.
 * "enter"  - a gateway action to a real external workspace was chosen;
 *            Warp plays before navigating away from Nexys.
 *
 * Route only distinguishes Home from a selected node - target/orbit/hub/
 * enter are transient client state layered on top by NexysRootPage.
 */
export type NexysInteractionStage = "home" | "target" | "orbit" | "hub" | "enter";

/** True when a WebGL context can actually be created (not just declared). */
export function canUseNexysWebgl(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") ?? probe.getContext("webgl"));
  } catch {
    return false;
  }
}
