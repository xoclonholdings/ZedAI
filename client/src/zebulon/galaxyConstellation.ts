/**
 * The six ZEBULON application galaxies, plotted as a star map. ZAR sits at
 * the hub (it's the platform's Universal Intelligence as well as its own
 * galaxy), with the other five arranged around it like a constellation.
 * Only ZAR/NEXUS has a real application behind it today - the rest are
 * plotted but not yet reachable (`route: null`), so the map is honest about
 * what's actually live without hiding where the platform is headed.
 */
export interface GalaxyStar {
  readonly id: string;
  readonly name: string;
  readonly console: string | null;
  readonly accent: string;
  /** Position as a percentage of the star map's width/height. */
  readonly x: number;
  readonly y: number;
  /** Rest-state star diameter in px. */
  readonly size: number;
  readonly route: string | null;
}

export const GALAXY_CONSTELLATION: readonly GalaxyStar[] = [
  { id: "zar", name: "ZAR", console: "NEXUS", accent: "#a78bfa", x: 50, y: 46, size: 26, route: "/nexus" },
  { id: "zeta", name: "ZETA", console: "SENTRY", accent: "#38bdf8", x: 50, y: 18, size: 15, route: null },
  { id: "zync", name: "ZYNC", console: "CANVAS", accent: "#f472b6", x: 79, y: 37, size: 15, route: null },
  { id: "zwap", name: "ZWAP!", console: "DISCOVERY", accent: "#fb7185", x: 68, y: 68, size: 15, route: null },
  { id: "zylo", name: "ZYLO", console: null, accent: "#facc15", x: 32, y: 68, size: 15, route: null },
  { id: "zeno", name: "ZENO", console: "UNITE", accent: "#4ade80", x: 21, y: 37, size: 15, route: null },
];
