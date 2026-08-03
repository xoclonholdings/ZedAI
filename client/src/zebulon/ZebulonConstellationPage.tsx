import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import * as THREE from "three";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { useReducedMotion } from "framer-motion";

import { ConsoleLogoutButton } from "@/console/ConsoleLogoutButton";
import { canUseNexusWebgl } from "@/nexus/scene/nexusSceneContract";
import { GALAXY_CONSTELLATION, SKY_RADIUS, galaxyStarPosition, type GalaxyStar } from "./galaxyConstellation";

const WARP_DURATION_MS = 620;
/** Per-second camera-slew rate when centering on a tapped star - brisk but not instant. */
const FOCUS_SLEW_RATE = 3.4;
/** Per-second fade rate for a star's own glow/label opacity as focus changes. */
const FADE_RATE = 3.2;
const SKY_FOV = 64;

/* ------------------------------------------------------------------ */
/* Shaders & texture helpers - the same GPU point-cloud technique      */
/* NexusCore's own ambient star field uses, reused verbatim so this    */
/* screen (which renders before any galaxy is entered) matches its     */
/* visual quality exactly rather than a cheaper approximation.         */
/* ------------------------------------------------------------------ */

const galaxyVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  attribute float aScale;
  attribute float aRand;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.62 + 0.38 * sin(uTime * (1.2 + aRand * 3.5) + aRand * 43.7);
    gl_PointSize = uSize * aScale * twinkle * (7.0 / -mv.z);
    vColor = aColor;
    vAlpha = twinkle;
  }
`;

const galaxyFragment = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    float strength = pow(1.0 - clamp(d * 2.0, 0.0, 1.0), 3.0);
    if (strength < 0.001) discard;
    gl_FragColor = vec4(vColor, strength * vAlpha * uOpacity);
  }
`;

function buildScatterGeometry(
  count: number,
  minR: number,
  maxR: number,
  yFlatten: number,
  palette: string[],
): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const rands = new Float32Array(count);
  const cols = palette.map((p) => new THREE.Color(p));

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const dir = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
    const r = minR + Math.pow(Math.random(), 0.5) * (maxR - minR);
    positions[i3] = dir.x * r;
    positions[i3 + 1] = dir.y * r * yFlatten;
    positions[i3 + 2] = dir.z * r;
    const c = cols[Math.floor(Math.random() * cols.length)];
    colors[i3] = c.r;
    colors[i3 + 1] = c.g;
    colors[i3 + 2] = c.b;
    scales[i] = 0.3 + Math.random() * 0.7;
    rands[i] = Math.random();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geo.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
  geo.setAttribute("aRand", new THREE.BufferAttribute(rands, 1));
  return geo;
}

function makePointsMaterial(size: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: galaxyVertex,
    fragmentShader: galaxyFragment,
    uniforms: { uTime: { value: 0 }, uSize: { value: size }, uOpacity: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function makeGlowTexture(inner: string, mid: string): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, mid);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/**
 * ZAR gets the same branded wordmark treatment as the sun it becomes once
 * you warp in - rendered straight to canvas (no troika/drei <Text> CDN
 * dependency) so the two screens read as literally the same object at two
 * distances, not a placeholder standing in for it.
 */
const WORDMARK_CANVAS_WIDTH = 512;
const WORDMARK_CANVAS_HEIGHT = 176;

function makeWordmarkTexture(text: string): THREE.CanvasTexture {
  const width = WORDMARK_CANVAS_WIDTH;
  const height = WORDMARK_CANVAS_HEIGHT;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const spaced = text.split("").join(" ");
  const cx = width / 2;
  const cy = height / 2;

  const targetWidth = width * 0.86;
  let fontSize = 120;
  let fontSpec = "";
  do {
    fontSpec = `800 ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.font = fontSpec;
    if (ctx.measureText(spaced).width <= targetWidth) break;
    fontSize -= 2;
  } while (fontSize > 24);
  ctx.font = fontSpec;

  ctx.shadowColor = "rgba(5,2,14,0.95)";
  ctx.shadowBlur = 22;
  ctx.fillStyle = "rgba(6,3,16,0.9)";
  ctx.fillText(spaced, cx, cy);
  ctx.shadowBlur = 0;

  const gradient = ctx.createLinearGradient(cx - targetWidth / 2, 0, cx + targetWidth / 2, 0);
  gradient.addColorStop(0, "#c4b5fd");
  gradient.addColorStop(0.5, "#f0abfc");
  gradient.addColorStop(1, "#a5f3fc");
  ctx.fillStyle = gradient;
  ctx.fillText(spaced, cx, cy);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Every other galaxy gets this simpler generated name/console label. */
const STAR_LABEL_WIDTH = 340;
const STAR_LABEL_HEIGHT = 150;

function makeStarLabelTexture(name: string, consoleName: string | null): THREE.CanvasTexture {
  const width = STAR_LABEL_WIDTH;
  const height = STAR_LABEL_HEIGHT;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.shadowColor = "rgba(4,2,12,0.95)";
  ctx.shadowBlur = 14;

  ctx.font = "700 54px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(name.split("").join(" "), width / 2, consoleName ? height * 0.4 : height * 0.5);

  if (consoleName) {
    ctx.shadowBlur = 8;
    ctx.font = "600 30px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(consoleName.split("").join(" "), width / 2, height * 0.74);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* ------------------------------------------------------------------ */
/* Ambient backdrop - the same twinkling scatter field NexusCore uses,  */
/* just this scene's whole sky rather than a ring around one galaxy.   */
/* ------------------------------------------------------------------ */

function SkyBackdrop() {
  const geometry = useMemo(() => buildScatterGeometry(4200, 14, 34, 1, ["#ffffff", "#bfe8ff", "#d9c8ff", "#22d3ee"]), []);
  const material = useMemo(() => makePointsMaterial(4.2), []);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
  });

  return <points geometry={geometry} material={material} />;
}

/* ------------------------------------------------------------------ */
/* Constellation lines - ZAR (the hub) connected to every other galaxy  */
/* ------------------------------------------------------------------ */

function ConstellationLines({ stars, zar }: { readonly stars: readonly GalaxyStar[]; readonly zar: GalaxyStar }) {
  const zarPos = useMemo(() => galaxyStarPosition(zar), [zar]);
  return (
    <>
      {stars.map((star) => {
        const pos = galaxyStarPosition(star);
        const positions = new Float32Array([...zarPos, ...pos]);
        return (
          <line key={star.id}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[positions, 3]} />
            </bufferGeometry>
            <lineBasicMaterial color={star.accent} transparent opacity={0.32} blending={THREE.AdditiveBlending} />
          </line>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* A single galaxy - glow + core + label, fading/brightening with focus */
/* ------------------------------------------------------------------ */

function GalaxyStarObject({
  star,
  isZar,
  focusedId,
  warpingId,
  onSelect,
  reducedMotion,
}: {
  readonly star: GalaxyStar;
  readonly isZar: boolean;
  readonly focusedId: string | null;
  readonly warpingId: string | null;
  readonly onSelect: (star: GalaxyStar) => void;
  readonly reducedMotion: boolean;
}) {
  const position = useMemo(() => galaxyStarPosition(star), [star]);
  const haloTexture = useMemo(
    () => makeGlowTexture("rgba(255,255,255,0.95)", `${star.accent}88`),
    [star.accent],
  );
  const coreTexture = useMemo(() => makeGlowTexture("#ffffff", `${star.accent}cc`), [star.accent]);
  const labelTexture = useMemo(
    () => (isZar ? makeWordmarkTexture(star.name) : makeStarLabelTexture(star.name, star.console)),
    [isZar, star.name, star.console],
  );

  useEffect(
    () => () => {
      haloTexture.dispose();
      coreTexture.dispose();
      labelTexture.dispose();
    },
    [haloTexture, coreTexture, labelTexture],
  );

  const haloRef = useRef<THREE.Sprite>(null);
  const haloMatRef = useRef<THREE.SpriteMaterial>(null);
  const coreMatRef = useRef<THREE.SpriteMaterial>(null);
  const labelMatRef = useRef<THREE.SpriteMaterial>(null);

  const haloScale = isZar ? 1.85 : 1.15;
  const coreScale = isZar ? 0.34 : 0.22;
  const labelWidth = isZar ? 1.5 : 1.35;
  const labelAspect = isZar ? WORDMARK_CANVAS_HEIGHT / WORDMARK_CANVAS_WIDTH : STAR_LABEL_HEIGHT / STAR_LABEL_WIDTH;
  const labelY = -(haloScale * 0.62 + labelWidth * labelAspect * 0.5 + 0.12);

  const focused = focusedId === star.id;
  const warping = warpingId === star.id;
  const dimmed = (focusedId !== null && !focused) || (warpingId !== null && !warping);

  useFrame(({ clock }, delta) => {
    const rate = reducedMotion ? 1 : Math.min(1, FADE_RATE * delta);
    const breathe = 1 + Math.sin(clock.elapsedTime * (isZar ? 1.4 : 1.9) + star.yaw) * (isZar ? 0.05 : 0.08);
    const targetOpacity = dimmed ? 0.12 : 1;
    const targetScale = (focused || warping ? 1.22 : 1) * breathe;

    if (haloRef.current) {
      const nextScale = haloRef.current.scale.x + (haloScale * targetScale - haloRef.current.scale.x) * rate;
      haloRef.current.scale.setScalar(nextScale);
    }
    if (haloMatRef.current) haloMatRef.current.opacity += (targetOpacity * 0.85 - haloMatRef.current.opacity) * rate;
    if (coreMatRef.current) coreMatRef.current.opacity += (targetOpacity - coreMatRef.current.opacity) * rate;
    if (labelMatRef.current) {
      const labelTarget = dimmed ? 0 : 1;
      labelMatRef.current.opacity += (labelTarget - labelMatRef.current.opacity) * rate;
    }
  });

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      onSelect(star);
    },
    [onSelect, star],
  );

  return (
    <group
      position={position}
      onClick={handleClick}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "")}
    >
      <sprite ref={haloRef} scale={[haloScale, haloScale, 1]} renderOrder={1}>
        <spriteMaterial
          ref={haloMatRef}
          map={haloTexture}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.85}
        />
      </sprite>
      <sprite scale={[coreScale, coreScale, 1]} renderOrder={2}>
        <spriteMaterial
          ref={coreMatRef}
          map={coreTexture}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </sprite>
      <sprite
        renderOrder={3}
        position={[0, labelY, 0]}
        scale={[labelWidth, labelWidth * labelAspect, 1]}
      >
        <spriteMaterial
          ref={labelMatRef}
          map={labelTexture}
          transparent
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </sprite>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Camera - slews to look at whatever's focused; punches through on     */
/* warp. Stars are placed as if at infinity, so "zooming in" on one is  */
/* a camera turn (how real planetarium apps center an object), and only */
/* the final commit (warp) is an actual dolly-through.                  */
/* ------------------------------------------------------------------ */

function CameraRig({
  lookTarget,
  warping,
  reducedMotion,
}: {
  readonly lookTarget: THREE.Vector3;
  readonly warping: boolean;
  readonly reducedMotion: boolean;
}) {
  // A plain Object3D's lookAt() uses reversed (non-camera) facing semantics;
  // THREE.Camera.isCamera makes it take the eye->target branch that actually
  // matches this rig's intent (camera's local -Z points at the target).
  const aimRef = useRef(new THREE.Camera());
  const warpStartRef = useRef<number | null>(null);

  useFrame(({ camera, clock }, delta) => {
    const rate = reducedMotion ? 1 : Math.min(1, FOCUS_SLEW_RATE * delta);
    aimRef.current.position.copy(camera.position);
    aimRef.current.lookAt(lookTarget);
    camera.quaternion.slerp(aimRef.current.quaternion, rate);

    const perspective = camera as THREE.PerspectiveCamera;
    if (warping) {
      if (warpStartRef.current === null) warpStartRef.current = clock.elapsedTime;
      const elapsed = clock.elapsedTime - warpStartRef.current;
      const t = Math.min(1, elapsed / (WARP_DURATION_MS / 1000));
      perspective.fov = SKY_FOV + (8 - SKY_FOV) * (t * t);
      perspective.updateProjectionMatrix();
    } else {
      warpStartRef.current = null;
      if (Math.abs(perspective.fov - SKY_FOV) > 0.01) {
        perspective.fov += (SKY_FOV - perspective.fov) * rate;
        perspective.updateProjectionMatrix();
      }
    }
  });

  return null;
}

function ConstellationScene({
  focusedId,
  warpingId,
  onSelect,
  onMissed,
  reducedMotion,
}: {
  readonly focusedId: string | null;
  readonly warpingId: string | null;
  readonly onSelect: (star: GalaxyStar) => void;
  readonly onMissed: () => void;
  readonly reducedMotion: boolean;
}) {
  const zar = useMemo(() => GALAXY_CONSTELLATION.find((star) => star.id === "zar")!, []);
  const others = useMemo(() => GALAXY_CONSTELLATION.filter((star) => star.id !== "zar"), []);

  const overviewTarget = useMemo(() => new THREE.Vector3(0, 1.1, -SKY_RADIUS), []);
  const focusTarget = useMemo(() => {
    const focused = GALAXY_CONSTELLATION.find((star) => star.id === (warpingId ?? focusedId));
    if (!focused) return overviewTarget;
    return new THREE.Vector3(...galaxyStarPosition(focused));
  }, [focusedId, warpingId, overviewTarget]);

  return (
    <>
      <SkyBackdrop />
      <ConstellationLines stars={others} zar={zar} />
      {GALAXY_CONSTELLATION.map((star) => (
        <GalaxyStarObject
          key={star.id}
          star={star}
          isZar={star.id === "zar"}
          focusedId={focusedId}
          warpingId={warpingId}
          onSelect={onSelect}
          reducedMotion={reducedMotion}
        />
      ))}
      <CameraRig lookTarget={focusTarget} warping={warpingId !== null} reducedMotion={reducedMotion} />
      {/*
        A fully transparent backstop the size of the whole sky: a star's own
        onClick calls stopPropagation so this never sees that tap, but a tap
        on empty sky hits only this and zooms back out. Kept opacity 0
        (rather than `visible={false}`) so it stays a normal raycast target.
      */}
      <mesh onClick={onMissed}>
        <sphereGeometry args={[SKY_RADIUS * 1.5, 8, 8]} />
        <meshBasicMaterial side={THREE.BackSide} transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  );
}

/**
 * The platform-level landing screen: a 3D sky where every ZEBULON
 * application galaxy is a star, ZAR at the hub connected to the rest like
 * a constellation. Tapping a star centers the camera on it (how a real
 * planetarium app "selects" an object at effectively infinite distance);
 * tapping it again while it's already centered commits to a warp - only
 * for ZAR today, since it's the only galaxy with a real application behind
 * it. Tapping a galaxy with nowhere to go is silently inert, same as every
 * other not-yet-built destination in this app - no explanatory copy.
 */
export default function ZebulonConstellationPage() {
  const [, navigate] = useLocation();
  const reducedMotion = Boolean(useReducedMotion());
  const [webgl, setWebgl] = useState(true);
  useEffect(() => setWebgl(canUseNexusWebgl()), []);

  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [warpingId, setWarpingId] = useState<string | null>(null);
  const warpTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (warpTimerRef.current !== null) window.clearTimeout(warpTimerRef.current);
    },
    [],
  );

  const handleSelect = useCallback(
    (star: GalaxyStar) => {
      if (warpingId) return;
      if (focusedId !== star.id) {
        setFocusedId(star.id);
        return;
      }
      if (!star.route) return;
      setWarpingId(star.id);
      warpTimerRef.current = window.setTimeout(() => navigate(star.route!), reducedMotion ? 0 : WARP_DURATION_MS);
    },
    [focusedId, warpingId, navigate, reducedMotion],
  );

  const handleMissed = useCallback(() => {
    if (warpingId) return;
    setFocusedId(null);
  }, [warpingId]);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[radial-gradient(ellipse_90%_70%_at_50%_35%,#0b0620_0%,#050211_55%,#010005_100%)] text-white">
      <div className="absolute inset-0" data-testid="zebulon-constellation-canvas">
        {webgl ? (
          <Canvas
            dpr={[1, 2]}
            gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
            camera={{ position: [0, 0, 0], fov: SKY_FOV, near: 0.1, far: 100 }}
            onPointerMissed={handleMissed}
          >
            <ConstellationScene
              focusedId={focusedId}
              warpingId={warpingId}
              onSelect={handleSelect}
              onMissed={handleMissed}
              reducedMotion={reducedMotion}
            />
          </Canvas>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center">
            {GALAXY_CONSTELLATION.map((star) => (
              <button
                key={star.id}
                type="button"
                onClick={() => star.route && navigate(star.route)}
                disabled={!star.route}
                className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-white/80 disabled:opacity-30"
              >
                {star.name}
              </button>
            ))}
          </div>
        )}
      </div>

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

      <div
        className="pointer-events-none absolute inset-0 z-30 bg-white"
        style={{
          opacity: 0,
          animation:
            warpingId && !reducedMotion ? `zebulon-warp-flash ${WARP_DURATION_MS}ms ease-in-out forwards` : undefined,
        }}
      />
      <style>{`
        @keyframes zebulon-warp-flash {
          0% { opacity: 0; }
          55% { opacity: 0.9; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
