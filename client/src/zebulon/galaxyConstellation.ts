/**
 * The six ZEBULON application galaxies, plotted on a sky dome the same way
 * a planetarium plots a constellation - angular position (yaw/pitch from
 * dead-ahead), not a flat 2D layout. ZAR sits near the center (it's the
 * platform's Universal Intelligence as well as its own galaxy), with the
 * other five arranged around it. Only ZAR/NEXUS has a real application
 * behind it today - the rest are plotted but not yet reachable
 * (`route: null`), so the map is honest about what's actually live without
 * hiding where the platform is headed.
 */
export interface GalaxyStar {
  readonly id: string;
  readonly name: string;
  readonly console: string | null;
  readonly accent: string;
  /** Degrees from dead-ahead - yaw around the vertical axis, pitch up/down. */
  readonly yaw: number;
  readonly pitch: number;
  /** Relative brightness/size - ZAR reads as the dominant hub star. */
  readonly magnitude: number;
  readonly route: string | null;
}

export const GALAXY_CONSTELLATION: readonly GalaxyStar[] = [
  { id: "zar", name: "ZAR", console: "NEXUS", accent: "#a78bfa", yaw: 0, pitch: 2, magnitude: 1.7, route: "/nexus" },
  { id: "zeta", name: "ZETA", console: "SENTRY", accent: "#38bdf8", yaw: 0, pitch: 30, magnitude: 1, route: null },
  { id: "zync", name: "ZYNC", console: "CANVAS", accent: "#f472b6", yaw: 12, pitch: 9, magnitude: 1, route: null },
  { id: "zwap", name: "ZWAP!", console: "DISCOVERY", accent: "#fb7185", yaw: 9, pitch: -26, magnitude: 1, route: null },
  { id: "zylo", name: "ZYLO", console: "COMPASS", accent: "#facc15", yaw: -9, pitch: -26, magnitude: 1, route: null },
  { id: "zeno", name: "ZENO", console: "UNITE", accent: "#4ade80", yaw: -12, pitch: 9, magnitude: 1, route: null },
];

export const SKY_RADIUS = 16;

export function galaxyStarPosition(star: GalaxyStar): readonly [number, number, number] {
  const yawRad = (star.yaw * Math.PI) / 180;
  const pitchRad = (star.pitch * Math.PI) / 180;
  const x = SKY_RADIUS * Math.sin(yawRad) * Math.cos(pitchRad);
  const y = SKY_RADIUS * Math.sin(pitchRad);
  const z = -SKY_RADIUS * Math.cos(yawRad) * Math.cos(pitchRad);
  return [x, y, z] as const;
}
