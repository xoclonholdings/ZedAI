/**
 * Shared contract between the lazily loaded WebGL scene and its DOM host.
 * Deliberately free of three.js imports so the host chunk stays light.
 */

export interface NexusSceneNode {
  readonly id: string;
  /** Percent position within the region, matching the HTML label overlay. */
  readonly x: number;
  readonly y: number;
  readonly color: string;
  readonly focused: boolean;
}

export interface NexusDriftState {
  /** Current drift offset in CSS px (applied to both scene and label overlay). */
  x: number;
  y: number;
  /** Drift target (set by drag handlers, decays to 0 on release). */
  tx: number;
  ty: number;
  /** Pointer parallax, normalized -1..1. */
  px: number;
  py: number;
}

export function createNexusDriftState(): NexusDriftState {
  return { x: 0, y: 0, tx: 0, ty: 0, px: 0, py: 0 };
}

/** True when a WebGL context can actually be created (not just declared). */
export function canUseNexusWebgl(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") ?? probe.getContext("webgl"));
  } catch {
    return false;
  }
}
