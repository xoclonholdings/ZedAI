import { useCallback, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { ConsoleLogoutButton } from "@/console/ConsoleLogoutButton";
import { GALAXY_CONSTELLATION, type GalaxyStar } from "./galaxyConstellation";

const WARP_DURATION_MS = 560;
const DORMANT_TOAST_MS = 1800;
const ZAR_ID = "zar";

interface BackgroundStar {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly delay: number;
  readonly duration: number;
}

/** Deterministic PRNG so the backdrop's scatter is stable across re-renders. */
function mulberry32(seed: number) {
  return function next() {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function useBackgroundStars(count: number): readonly BackgroundStar[] {
  return useMemo(() => {
    const rand = mulberry32(1337);
    return Array.from({ length: count }, () => ({
      x: rand() * 100,
      y: rand() * 100,
      size: 1 + rand() * 1.6,
      delay: rand() * 4,
      duration: 3 + rand() * 3,
    }));
  }, [count]);
}

/**
 * The platform-level landing screen: a zoomed-out star map where every
 * ZEBULON application galaxy is a labeled star, ZAR at the hub connected to
 * the rest like a constellation. Tapping a live galaxy (only ZAR today)
 * warps into it; tapping a plotted-but-not-yet-live one surfaces a small
 * "coming soon" marker instead of navigating anywhere. This is intentionally
 * lighter than NexusCore's WebGL scene - it renders before any galaxy is
 * chosen, so it stays cheap CSS/SVG rather than a second 3D scene to mount.
 */
export default function ZebulonConstellationPage() {
  const [, navigate] = useLocation();
  const reducedMotion = useReducedMotion();
  const backgroundStars = useBackgroundStars(70);
  const [warpingId, setWarpingId] = useState<string | null>(null);
  const [dormantToast, setDormantToast] = useState<GalaxyStar | null>(null);

  const zar = useMemo(() => GALAXY_CONSTELLATION.find((star) => star.id === ZAR_ID)!, []);
  const others = useMemo(() => GALAXY_CONSTELLATION.filter((star) => star.id !== ZAR_ID), []);

  const handleSelect = useCallback((star: GalaxyStar) => {
    if (warpingId) return;
    if (!star.route) {
      setDormantToast(star);
      window.setTimeout(() => {
        setDormantToast((current) => (current?.id === star.id ? null : current));
      }, DORMANT_TOAST_MS);
      return;
    }
    setWarpingId(star.id);
    window.setTimeout(() => navigate(star.route!), reducedMotion ? 0 : WARP_DURATION_MS);
  }, [warpingId, navigate, reducedMotion]);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[radial-gradient(ellipse_90%_70%_at_50%_35%,#0b0620_0%,#050211_55%,#010005_100%)] text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {backgroundStars.map((star, index) => (
          <span
            key={index}
            className="absolute rounded-full bg-white"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: star.size,
              height: star.size,
              opacity: 0.35,
              animation: reducedMotion ? undefined : `nexus-twinkle ${star.duration}s ease-in-out ${star.delay}s infinite`,
            }}
          />
        ))}
      </div>

      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {others.map((star) => (
          <line
            key={star.id}
            x1={zar.x}
            y1={zar.y}
            x2={star.x}
            y2={star.y}
            stroke={`${star.accent}55`}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-4 pt-safe-sm sm:px-6 sm:pt-5">
        <div className="pointer-events-auto min-w-0">
          <div className="flex h-9 items-center gap-2 leading-none">
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-300 to-cyan-300 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent sm:text-3xl">
              ZEBULON
            </span>
            <ConsoleLogoutButton />
          </div>
          <div className="flex h-4 items-center truncate text-[9px] font-medium uppercase tracking-[0.12em] text-white/40">
            Select a galaxy
          </div>
        </div>
      </header>

      {GALAXY_CONSTELLATION.map((star) => (
        <GalaxyStarPoint
          key={star.id}
          star={star}
          isZar={star.id === ZAR_ID}
          warping={warpingId === star.id}
          dimmed={warpingId !== null && warpingId !== star.id}
          onSelect={() => handleSelect(star)}
          reducedMotion={Boolean(reducedMotion)}
        />
      ))}

      <AnimatePresence>
        {dormantToast && (
          <motion.div
            key={dormantToast.id}
            className="pointer-events-none absolute z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-black/70 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-white/70 backdrop-blur"
            style={{ left: `${dormantToast.x}%`, top: `${dormantToast.y + 8}%` }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {dormantToast.name} - coming online soon
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {warpingId && (
          <motion.div
            key="warp-flash"
            className="pointer-events-none absolute inset-0 z-30 bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.85, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: WARP_DURATION_MS / 1000, times: [0, 0.5, 1], ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function GalaxyStarPoint({
  star,
  isZar,
  warping,
  dimmed,
  onSelect,
  reducedMotion,
}: {
  readonly star: GalaxyStar;
  readonly isZar: boolean;
  readonly warping: boolean;
  readonly dimmed: boolean;
  readonly onSelect: () => void;
  readonly reducedMotion: boolean;
}) {
  const available = Boolean(star.route);

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-label={available ? `Warp into ${star.name}` : `${star.name} - not yet available`}
      className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 focus:outline-none"
      style={{ left: `${star.x}%`, top: `${star.y}%` }}
      animate={{ opacity: dimmed ? 0.15 : 1, scale: warping ? 1.6 : 1 }}
      transition={{ duration: warping ? 0.56 : 0.3, ease: warping ? "easeIn" : "easeOut" }}
    >
      <motion.span
        className="block rounded-full"
        style={{
          width: star.size,
          height: star.size,
          background: `radial-gradient(circle, #ffffff 0%, ${star.accent} 55%, transparent 100%)`,
          boxShadow: `0 0 ${star.size * (isZar ? 1.8 : 1.1)}px ${star.size * 0.5}px ${star.accent}${available ? "aa" : "55"}`,
        }}
        animate={
          reducedMotion
            ? undefined
            : { scale: [1, isZar ? 1.12 : 1.08, 1], opacity: available ? [0.85, 1, 0.85] : [0.5, 0.7, 0.5] }
        }
        transition={{ duration: isZar ? 2.6 : 3.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.2em]"
        style={{ color: available ? "#ffffff" : "rgba(255,255,255,0.55)" }}
      >
        {star.name}
      </span>
      {star.console && (
        <span className="text-[8px] font-medium uppercase tracking-[0.18em] text-white/35">{star.console}</span>
      )}
    </motion.button>
  );
}
