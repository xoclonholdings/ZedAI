import { describe, expect, test } from "vitest";

import {
  GALAXY_CONSTELLATION,
  ZEBULON_HOME_CAMERA,
  ZEBULON_REFERENCE_VIEWPORT,
  ZEBULON_VESSEL_ROUTE,
} from "./galaxyConstellation";

describe("Zebulon constellation authority", () => {
  test("defines the exact eight Galaxy gateways and subtitles", () => {
    expect(GALAXY_CONSTELLATION.every((galaxy) => galaxy.level === "application-galaxy")).toBe(true);
    expect(GALAXY_CONSTELLATION.map(({ name, console }) => [name, console])).toEqual([
      ["ZAR", "NΞXYS"],
      ["ZETA", "SENTRY"],
      ["ZYNC", "CANVAS"],
      ["ZYLO", "COMPASS"],
      ["ZENO", "UNITE"],
      ["ZWAP!", "DISCOVERY"],
      ["ZENITH", "LOGOS"],
      ["ZILLION", "PROSPER"],
    ]);
  });

  test("stores real depth and distinct stellar identities instead of equal menu icons", () => {
    expect(new Set(GALAXY_CONSTELLATION.map((star) => star.position[2])).size).toBe(8);
    expect(new Set(GALAXY_CONSTELLATION.map((star) => star.radius)).size).toBe(8);
    expect(new Set(GALAXY_CONSTELLATION.map((star) => star.haloRadius)).size).toBe(8);
    expect(new Set(GALAXY_CONSTELLATION.map((star) => star.brightness)).size).toBe(8);
    expect(new Set(GALAXY_CONSTELLATION.map((star) => star.stellarDensity)).size).toBe(8);
    expect(new Set(GALAXY_CONSTELLATION.map((star) => star.nebula)).size).toBe(8);
  });

  test("keeps the observed chart asymmetric and off a shared radius", () => {
    const zar = GALAXY_CONSTELLATION.find((star) => star.id === "zar")!;
    const radialDistances = GALAXY_CONSTELLATION
      .filter((star) => star.id !== "zar")
      .map((star) => Math.hypot(star.position[0] - zar.position[0], star.position[1] - zar.position[1]))
      .map((distance) => distance.toFixed(2));

    expect(new Set(radialDistances).size).toBe(radialDistances.length);

    const zeno = GALAXY_CONSTELLATION.find((star) => star.id === "zeno")!;
    const zync = GALAXY_CONSTELLATION.find((star) => star.id === "zync")!;
    const zylo = GALAXY_CONSTELLATION.find((star) => star.id === "zylo")!;
    const zwap = GALAXY_CONSTELLATION.find((star) => star.id === "zwap")!;

    expect(Math.abs(zeno.position[0])).not.toBeCloseTo(Math.abs(zync.position[0]), 1);
    expect(zeno.position[1]).not.toBeCloseTo(zync.position[1], 1);
    expect(Math.abs(zylo.position[0])).not.toBeCloseTo(Math.abs(zwap.position[0]), 1);
    expect(zylo.position[1]).not.toBeCloseTo(zwap.position[1], 1);
  });

  test("exposes only the existing vessel destination and a perspective home camera", () => {
    expect(GALAXY_CONSTELLATION.filter((star) => star.route)).toEqual([
      expect.objectContaining({ id: "zar", route: ZEBULON_VESSEL_ROUTE }),
    ]);
    expect(ZEBULON_VESSEL_ROUTE).toBe("/nexys");
    expect(ZEBULON_HOME_CAMERA.fov).toBeGreaterThan(35);
    expect(ZEBULON_HOME_CAMERA.fov).toBeLessThan(60);
    expect(ZEBULON_REFERENCE_VIEWPORT).toEqual({ width: 853, height: 1280 });
  });
});
