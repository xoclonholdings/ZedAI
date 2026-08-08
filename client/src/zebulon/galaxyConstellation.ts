/**
 * Authoritative ZEBULON constellation chart.
 *
 * These are deliberately observed, irregular world-space coordinates, not
 * positions derived from a ring, shared radius, or equal-angle menu. The
 * reference viewport is recorded here so camera framing and visual checks
 * have one stable authority without changing the underlying constellation.
 */
export type GalaxyNebulaCharacter = "intelligence" | "structured" | "creative" | "beacon" | "binary" | "frontier" | "logos" | "prosper";

export interface GalaxyStar {
  /** Top-level ZCOS application entrance; planets/hubs live inside it. */
  readonly level: "application-galaxy";
  readonly id: string;
  readonly name: "ZAR" | "ZETA" | "ZYNC" | "ZYLO" | "ZENO" | "ZWAP!" | "ZENITH" | "ZILLION";
  readonly console: "NΞXYS" | "SENTRY" | "CANVAS" | "COMPASS" | "UNITE" | "DISCOVERY" | "LOGOS" | "PROSPER";
  /** One-line galaxy summary shown in the focused star detail card. */
  readonly description: string;
  readonly accent: string;
  readonly accentSoft: string;
  /** Genuine 3D chart coordinates. Z varies independently for visible depth. */
  readonly position: readonly [number, number, number];
  readonly radius: number;
  readonly haloRadius: number;
  readonly brightness: number;
  readonly stellarDensity: number;
  readonly nebula: GalaxyNebulaCharacter;
  readonly dustStretch: readonly [number, number];
  readonly labelOffset: readonly [number, number];
  readonly hitRadius: number;
  readonly companion?: Readonly<{
    position: readonly [number, number, number];
    radius: number;
    intensity: number;
  }>;
  readonly route: string | null;
}

export const ZEBULON_REFERENCE_VIEWPORT = Object.freeze({ width: 853, height: 1280 });

export const ZEBULON_HOME_CAMERA = Object.freeze({
  position: [0.15, 0.3, 20.5] as const,
  target: [0, -0.55, -0.4] as const,
  fov: 48,
  near: 0.1,
  far: 120,
  maximumYaw: 0.24,
  minimumPitch: -0.18,
  maximumPitch: 0.18,
});

export const ZEBULON_VESSEL_ROUTE = "/nexys";

export const GALAXY_CONSTELLATION: readonly GalaxyStar[] = Object.freeze([
  {
    level: "application-galaxy",
    id: "zar",
    name: "ZAR",
    console: "NΞXYS",
    description: "Command nexus — every galaxy, memory, and mission converges here.",
    accent: "#a78bfa",
    accentSoft: "#ddd6fe",
    position: [0.35, -0.25, 0.9],
    radius: 1.18,
    haloRadius: 2.25,
    brightness: 1,
    stellarDensity: 430,
    nebula: "intelligence",
    dustStretch: [1.05, 0.9],
    labelOffset: [0.4, -1.55],
    hitRadius: 1.25,
    route: ZEBULON_VESSEL_ROUTE,
  },
  {
    level: "application-galaxy",
    id: "zeta",
    name: "ZETA",
    console: "SENTRY",
    description: "Vigilant watch — monitoring, alerts, and system defense.",
    accent: "#60a5fa",
    accentSoft: "#bfdbfe",
    position: [1.05, 5.15, -1.65],
    radius: 0.7,
    haloRadius: 1.25,
    brightness: 0.94,
    stellarDensity: 150,
    nebula: "structured",
    dustStretch: [0.78, 1.18],
    labelOffset: [1.05, -0.65],
    hitRadius: 0.92,
    route: "/galaxy/zeta",
  },
  {
    level: "application-galaxy",
    id: "zync",
    name: "ZYNC",
    console: "CANVAS",
    description: "Creative studio — design, imagery, and visual synthesis.",
    accent: "#f472b6",
    accentSoft: "#fbcfe8",
    position: [5.15, 1.75, -0.55],
    radius: 0.94,
    haloRadius: 1.8,
    brightness: 0.86,
    stellarDensity: 310,
    nebula: "creative",
    dustStretch: [1.35, 0.9],
    labelOffset: [1.15, -0.7],
    hitRadius: 1.05,
    route: "/galaxy/zync",
  },
  {
    level: "application-galaxy",
    id: "zylo",
    name: "ZYLO",
    console: "COMPASS",
    description: "Wayfinding — planning, direction, and decision routing.",
    accent: "#f6c85f",
    accentSoft: "#fde68a",
    position: [-3.75, -4.05, 1.55],
    radius: 0.82,
    haloRadius: 1.38,
    brightness: 0.82,
    stellarDensity: 190,
    nebula: "beacon",
    dustStretch: [1.05, 0.74],
    labelOffset: [0.7, -0.75],
    hitRadius: 0.96,
    route: "/galaxy/zylo",
  },
  {
    level: "application-galaxy",
    id: "zeno",
    name: "ZENO",
    console: "UNITE",
    description: "Connection hub — people, teams, and shared presence.",
    accent: "#86efac",
    accentSoft: "#dcfce7",
    position: [-5.55, 2.25, 0.45],
    radius: 0.74,
    haloRadius: 1.3,
    brightness: 0.78,
    stellarDensity: 175,
    nebula: "binary",
    dustStretch: [1.15, 0.84],
    labelOffset: [0.7, -0.78],
    hitRadius: 1.02,
    companion: {
      position: [0.94, -0.34, -0.12],
      radius: 0.26,
      intensity: 0.48,
    },
    route: "/galaxy/zeno",
  },
  {
    level: "application-galaxy",
    id: "zwap",
    name: "ZWAP!",
    console: "DISCOVERY",
    description: "Frontier lab — research, experiments, and new signals.",
    accent: "#fb755f",
    accentSoft: "#fecaca",
    position: [5.85, -4.55, -2.35],
    radius: 0.88,
    haloRadius: 1.9,
    brightness: 0.88,
    stellarDensity: 285,
    nebula: "frontier",
    dustStretch: [1.5, 0.76],
    labelOffset: [1.12, -0.76],
    hitRadius: 1.08,
    route: "/galaxy/zwap",
  },
  {
    level: "application-galaxy",
    id: "zenith",
    name: "ZENITH",
    console: "LOGOS",
    description: "Knowledge core — reasoning, language, and living truth.",
    accent: "#7dd3fc",
    accentSoft: "#e0f2fe",
    position: [-2.4, 4.2, 2.6],
    radius: 0.79,
    haloRadius: 1.55,
    brightness: 0.96,
    stellarDensity: 205,
    nebula: "logos",
    dustStretch: [0.95, 1.12],
    labelOffset: [0.8, -0.75],
    hitRadius: 0.98,
    route: "/galaxy/zenith",
  },
  {
    level: "application-galaxy",
    id: "zillion",
    name: "ZILLION",
    console: "PROSPER",
    description: "Wealth engine — markets, growth, and abundance.",
    accent: "#34d399",
    accentSoft: "#a7f3d0",
    position: [3.4, -3.1, -3.4],
    radius: 1.02,
    haloRadius: 2.05,
    brightness: 0.8,
    stellarDensity: 355,
    nebula: "prosper",
    dustStretch: [1.3, 0.85],
    labelOffset: [1.1, -0.72],
    hitRadius: 1.1,
    route: "/galaxy/zillion",
  },
]);

export function galaxyStarPosition(star: GalaxyStar): readonly [number, number, number] {
  return star.position;
}

export function galaxyById(id: string | null | undefined): GalaxyStar | null {
  if (!id) return null;
  return GALAXY_CONSTELLATION.find((star) => star.id === id) ?? null;
}
