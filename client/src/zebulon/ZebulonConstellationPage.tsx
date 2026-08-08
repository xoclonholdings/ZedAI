import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowRight, BookOpen, Crosshair, Database, FolderOpen, Navigation, Orbit, RotateCcw, Rocket } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useLocation } from "wouter";
import * as THREE from "three";

import { ConsoleShell } from "@/console/ConsoleShell";
import { ZAR_NEXYS_CONSOLE } from "@/console/consoleIdentity";
import { NexysConsoleHeaderBrand, NexysConsoleHeaderTelemetry } from "@/nexys/components/NexysConsoleHeader";
import { canUseNexysWebgl } from "@/nexys/scene/nexysSceneContract";
import {
  GALAXY_CONSTELLATION,
  ZEBULON_HOME_CAMERA,
  ZEBULON_REFERENCE_VIEWPORT,
  ZEBULON_VESSEL_ROUTE,
  galaxyById,
  galaxyStarPosition,
  type GalaxyStar,
} from "./galaxyConstellation";

const WARP_DURATION_MS = 760;
const FOCUS_SLEW_RATE = 3.8;
const FADE_RATE = 4.2;

const pointVertex = /* glsl */ `
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
    float twinkle = 0.78 + 0.22 * sin(uTime * (0.24 + aRand * 0.55) + aRand * 39.0);
    gl_PointSize = uSize * aScale * twinkle * (9.0 / max(1.0, -mv.z));
    vColor = aColor;
    vAlpha = twinkle;
  }
`;

const pointFragment = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    float strength = pow(1.0 - clamp(d * 2.0, 0.0, 1.0), 2.8);
    if (strength < 0.008) discard;
    gl_FragColor = vec4(vColor, strength * vAlpha * uOpacity);
  }
`;

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function makePointMaterial(size: number, opacity: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: pointVertex,
    fragmentShader: pointFragment,
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: size },
      uOpacity: { value: opacity },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function buildStarLayerGeometry(input: {
  readonly count: number;
  readonly width: number;
  readonly height: number;
  readonly zNear: number;
  readonly zFar: number;
  readonly seed: string;
  readonly palette: readonly string[];
  readonly clusters: number;
}): THREE.BufferGeometry {
  const random = seededRandom(hashSeed(input.seed));
  const positions = new Float32Array(input.count * 3);
  const colors = new Float32Array(input.count * 3);
  const scales = new Float32Array(input.count);
  const rands = new Float32Array(input.count);
  const palette = input.palette.map((color) => new THREE.Color(color));
  const centers = Array.from({ length: input.clusters }, () => ({
    x: (random() - 0.5) * input.width,
    y: (random() - 0.5) * input.height,
  }));

  for (let i = 0; i < input.count; i += 1) {
    const index = i * 3;
    const clustered = random() < 0.64;
    const center = centers[Math.floor(random() * centers.length)];
    const spread = 0.08 + random() * 0.2;
    positions[index] = clustered
      ? center.x + (random() + random() - 1) * input.width * spread
      : (random() - 0.5) * input.width;
    positions[index + 1] = clustered
      ? center.y + (random() + random() - 1) * input.height * spread
      : (random() - 0.5) * input.height;
    positions[index + 2] = THREE.MathUtils.lerp(input.zNear, input.zFar, random());
    const color = palette[Math.floor(random() * palette.length)];
    colors[index] = color.r;
    colors[index + 1] = color.g;
    colors[index + 2] = color.b;
    scales[i] = random() < 0.025 ? 1.45 + random() : 0.3 + random() * 0.72;
    rands[i] = random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
  geometry.setAttribute("aRand", new THREE.BufferAttribute(rands, 1));
  return geometry;
}

function buildLocalDustGeometry(star: GalaxyStar): THREE.BufferGeometry {
  const random = seededRandom(hashSeed(`dust-${star.id}`));
  const positions = new Float32Array(star.stellarDensity * 3);
  const colors = new Float32Array(star.stellarDensity * 3);
  const scales = new Float32Array(star.stellarDensity);
  const rands = new Float32Array(star.stellarDensity);
  const accent = new THREE.Color(star.accent);
  const white = new THREE.Color(star.accentSoft);

  for (let i = 0; i < star.stellarDensity; i += 1) {
    const index = i * 3;
    const angle = random() * Math.PI * 2;
    const radius = star.haloRadius * (0.48 + Math.pow(random(), 0.62) * 1.45);
    const arm = Math.sin(angle * (star.nebula === "creative" ? 3 : 2) + radius * 2.4) * 0.22;
    positions[index] = Math.cos(angle + arm) * radius * star.dustStretch[0];
    positions[index + 1] = Math.sin(angle + arm) * radius * star.dustStretch[1];
    positions[index + 2] = (random() - 0.5) * star.haloRadius * 0.72;
    const color = random() > 0.24 ? accent : white;
    colors[index] = color.r;
    colors[index + 1] = color.g;
    colors[index + 2] = color.b;
    scales[i] = 0.25 + random() * (random() < 0.05 ? 1.35 : 0.72);
    rands[i] = random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
  geometry.setAttribute("aRand", new THREE.BufferAttribute(rands, 1));
  return geometry;
}

function makeStarburstTexture(accent: string, seed: string, sharp: boolean): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d")!;
  const center = size / 2;
  const random = seededRandom(hashSeed(seed));

  const glow = context.createRadialGradient(center, center, 0, center, center, center);
  glow.addColorStop(0, "rgba(255,255,255,1)");
  glow.addColorStop(0.055, "rgba(255,255,255,0.98)");
  glow.addColorStop(sharp ? 0.16 : 0.22, `${accent}e8`);
  glow.addColorStop(0.5, `${accent}3b`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, size, size);

  context.save();
  context.translate(center, center);
  context.globalCompositeOperation = "screen";
  const rayCount = sharp ? 18 : 13;
  for (let i = 0; i < rayCount; i += 1) {
    context.rotate((Math.PI * 2) / rayCount + random() * 0.035);
    const length = size * (0.22 + random() * (sharp ? 0.33 : 0.22));
    const gradient = context.createLinearGradient(0, 0, length, 0);
    gradient.addColorStop(0, "rgba(255,255,255,0.72)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.strokeStyle = gradient;
    context.lineWidth = random() < 0.18 ? 1.3 : 0.45;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(length, 0);
    context.stroke();
  }
  context.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeNebulaTexture(star: GalaxyStar): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d")!;
  const random = seededRandom(hashSeed(`nebula-${star.id}`));
  context.globalCompositeOperation = "screen";

  const cloudCount = star.nebula === "structured" ? 13 : 25;
  for (let i = 0; i < cloudCount; i += 1) {
    const x = size * (0.22 + random() * 0.56);
    const y = size * (0.22 + random() * 0.56);
    const radius = size * (0.07 + random() * 0.22);
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    const alpha = star.nebula === "structured" ? 0.08 : 0.05 + random() * 0.08;
    gradient.addColorStop(0, `${star.accent}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`);
    gradient.addColorStop(0.48, `${star.accent}10`);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = gradient;
    context.save();
    context.translate(x, y);
    context.rotate((random() - 0.5) * 1.4);
    context.scale(0.65 + random() * 1.3, 0.35 + random() * 0.7);
    context.translate(-x, -y);
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    context.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeNavigationTexture(accent: string, seed: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d")!;
  const random = seededRandom(hashSeed(`nav-${seed}`));
  const center = size / 2;
  context.translate(center, center);
  context.strokeStyle = `${accent}56`;
  context.lineWidth = 0.8;

  [42, 66, 91].forEach((radius, index) => {
    context.setLineDash(index === 1 ? [2, 6] : index === 2 ? [13, 12] : []);
    context.beginPath();
    context.arc(0, 0, radius, random() * 1.2, Math.PI * (1.25 + random() * 0.55));
    context.stroke();
  });
  context.setLineDash([]);
  for (let i = 0; i < 12; i += 1) {
    const angle = (Math.PI * 2 * i) / 12;
    context.beginPath();
    context.moveTo(Math.cos(angle) * 77, Math.sin(angle) * 77);
    context.lineTo(Math.cos(angle) * (i % 3 === 0 ? 92 : 85), Math.sin(angle) * (i % 3 === 0 ? 92 : 85));
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function drawTrackedText(
  context: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  tracking: number,
): void {
  const widths = [...text].map((character) => context.measureText(character).width);
  const total = widths.reduce((sum, width) => sum + width, 0) + tracking * Math.max(0, text.length - 1);
  let x = centerX - total / 2;
  [...text].forEach((character, index) => {
    context.fillText(character, x, y);
    x += widths[index] + tracking;
  });
}

function makeLabelTexture(star: GalaxyStar): THREE.CanvasTexture {
  const width = 512;
  const height = 196;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  context.textBaseline = "middle";
  context.shadowColor = "rgba(1,1,8,0.98)";
  context.shadowBlur = 18;
  context.font = "700 61px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  context.fillStyle = star.accentSoft;
  drawTrackedText(context, star.name, width / 2, 70, 11);
  context.shadowBlur = 10;
  context.font = "600 26px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  context.fillStyle = `${star.accent}d8`;
  drawTrackedText(context, star.console, width / 2, 135, 12);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function StarLayer({
  count,
  width,
  height,
  zNear,
  zFar,
  size,
  opacity,
  seed,
  clusters,
}: {
  readonly count: number;
  readonly width: number;
  readonly height: number;
  readonly zNear: number;
  readonly zFar: number;
  readonly size: number;
  readonly opacity: number;
  readonly seed: string;
  readonly clusters: number;
}) {
  const geometry = useMemo(
    () => buildStarLayerGeometry({
      count,
      width,
      height,
      zNear,
      zFar,
      seed,
      clusters,
      palette: ["#ffffff", "#dbeafe", "#bae6fd", "#ddd6fe"],
    }),
    [clusters, count, height, seed, width, zFar, zNear],
  );
  const material = useMemo(() => makePointMaterial(size, opacity), [opacity, size]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
  });

  return <points geometry={geometry} material={material} />;
}

function LocalDust({ star, active, dimmed, reducedMotion }: {
  readonly star: GalaxyStar;
  readonly active: boolean;
  readonly dimmed: boolean;
  readonly reducedMotion: boolean;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const geometry = useMemo(() => buildLocalDustGeometry(star), [star]);
  const material = useMemo(
    () => makePointMaterial(star.nebula === "structured" ? 4.4 : 5.2, 0.72),
    [star.nebula],
  );

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame(({ clock }, delta) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uOpacity.value = THREE.MathUtils.damp(
      material.uniforms.uOpacity.value,
      dimmed ? 0.13 : active ? 0.96 : 0.68,
      FADE_RATE,
      delta,
    );
    if (pointsRef.current && !reducedMotion) {
      const direction = star.id === "zwap" || star.id === "zync" ? -1 : 1;
      pointsRef.current.rotation.z += delta * 0.006 * direction;
    }
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

function GalaxyStarObject({
  star,
  focusedId,
  activeId,
  warpingId,
  onSelect,
  onHover,
  reducedMotion,
}: {
  readonly star: GalaxyStar;
  readonly focusedId: string | null;
  readonly activeId: string | null;
  readonly warpingId: string | null;
  readonly onSelect: (star: GalaxyStar) => void;
  readonly onHover: (id: string | null) => void;
  readonly reducedMotion: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Sprite>(null);
  const haloMaterialRef = useRef<THREE.SpriteMaterial>(null);
  const coreMaterialRef = useRef<THREE.SpriteMaterial>(null);
  const labelMaterialRef = useRef<THREE.SpriteMaterial>(null);
  const nebulaMaterialRef = useRef<THREE.SpriteMaterial>(null);
  const position = useMemo(() => galaxyStarPosition(star), [star]);
  const starTexture = useMemo(
    () => makeStarburstTexture(star.accent, star.id, star.nebula === "structured"),
    [star.accent, star.id, star.nebula],
  );
  const nebulaTexture = useMemo(() => makeNebulaTexture(star), [star]);
  const navigationTexture = useMemo(() => makeNavigationTexture(star.accent, star.id), [star.accent, star.id]);
  const labelTexture = useMemo(() => makeLabelTexture(star), [star]);

  useEffect(() => () => {
    starTexture.dispose();
    nebulaTexture.dispose();
    navigationTexture.dispose();
    labelTexture.dispose();
  }, [labelTexture, navigationTexture, nebulaTexture, starTexture]);

  const focused = focusedId === star.id;
  const active = activeId === star.id;
  const warping = warpingId === star.id;
  const dimmed = Boolean((focusedId || warpingId) && !focused && !warping);
  const labelWidth = star.id === "zar" ? 2.25 : 1.92;
  const labelHeight = labelWidth * (196 / 512);

  useFrame(({ clock }, delta) => {
    const pulse = reducedMotion
      ? 1
      : 1 + Math.sin(clock.elapsedTime * (0.55 + star.brightness * 0.32) + hashSeed(star.id)) * 0.025;
    const activeScale = active || focused || warping ? 1.1 : 1;
    const targetScale = pulse * activeScale;
    if (groupRef.current) {
      groupRef.current.scale.setScalar(THREE.MathUtils.damp(groupRef.current.scale.x, targetScale, FADE_RATE, delta));
    }
    if (haloRef.current) {
      haloRef.current.material.rotation += reducedMotion ? 0 : delta * (star.id === "zync" ? -0.018 : 0.009);
    }
    if (haloMaterialRef.current) {
      haloMaterialRef.current.opacity = THREE.MathUtils.damp(
        haloMaterialRef.current.opacity,
        dimmed ? 0.12 : active ? 0.92 : 0.66 * star.brightness,
        FADE_RATE,
        delta,
      );
    }
    if (coreMaterialRef.current) {
      coreMaterialRef.current.opacity = THREE.MathUtils.damp(
        coreMaterialRef.current.opacity,
        dimmed ? 0.24 : 0.92 + star.brightness * 0.08,
        FADE_RATE,
        delta,
      );
    }
    if (nebulaMaterialRef.current) {
      nebulaMaterialRef.current.opacity = THREE.MathUtils.damp(
        nebulaMaterialRef.current.opacity,
        dimmed ? 0.035 : active ? 0.34 : star.nebula === "structured" ? 0.1 : 0.2,
        FADE_RATE,
        delta,
      );
    }
    if (labelMaterialRef.current) {
      labelMaterialRef.current.opacity = THREE.MathUtils.damp(
        labelMaterialRef.current.opacity,
        dimmed ? 0.18 : active || focused ? 1 : 0.82,
        FADE_RATE,
        delta,
      );
    }
  });

  const handleClick = useCallback((event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(star);
  }, [onSelect, star]);

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={handleClick}
      onPointerOver={(event) => {
        event.stopPropagation();
        onHover(star.id);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        onHover(null);
        document.body.style.cursor = "";
      }}
    >
      <LocalDust star={star} active={active} dimmed={dimmed} reducedMotion={reducedMotion} />
      <sprite scale={[star.haloRadius * 4.15 * star.dustStretch[0], star.haloRadius * 4.15 * star.dustStretch[1], 1]} renderOrder={0}>
        <spriteMaterial
          ref={nebulaMaterialRef}
          map={nebulaTexture}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.2}
          rotation={hashSeed(star.id) % 4}
        />
      </sprite>
      <sprite scale={[star.haloRadius * 2.15, star.haloRadius * 2.15, 1]} renderOrder={1}>
        <spriteMaterial
          ref={haloMaterialRef}
          map={starTexture}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.7}
          toneMapped={false}
        />
      </sprite>
      <sprite ref={haloRef} scale={[star.haloRadius * 2.55, star.haloRadius * 2.55, 1]} renderOrder={1}>
        <spriteMaterial
          map={navigationTexture}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={star.id === "zar" ? 0.52 : 0.24}
          toneMapped={false}
        />
      </sprite>
      <sprite scale={[star.radius * 1.62, star.radius * 1.62, 1]} renderOrder={2}>
        <spriteMaterial
          ref={coreMaterialRef}
          map={starTexture}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={1}
          toneMapped={false}
        />
      </sprite>
      {star.companion ? (
        <sprite position={star.companion.position} scale={[star.companion.radius, star.companion.radius, 1]} renderOrder={2}>
          <spriteMaterial
            map={starTexture}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            opacity={star.companion.intensity}
            toneMapped={false}
          />
        </sprite>
      ) : null}
      <sprite
        position={[star.labelOffset[0], star.labelOffset[1], 0.08]}
        scale={[labelWidth, labelHeight, 1]}
        renderOrder={5}
      >
        <spriteMaterial
          ref={labelMaterialRef}
          map={labelTexture}
          transparent
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
          opacity={0.82}
        />
      </sprite>
      <mesh onClick={handleClick}>
        <sphereGeometry args={[star.hitRadius, 14, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function ChartArc({ radius, rotation, opacity = 0.1 }: {
  readonly radius: number;
  readonly rotation: readonly [number, number, number];
  readonly opacity?: number;
}) {
  const geometry = useMemo(() => {
    const points = new THREE.EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2, false, 0)
      .getPoints(128)
      .map((point) => new THREE.Vector3(point.x, point.y, 0));
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineLoop geometry={geometry} rotation={[...rotation]}>
      <lineBasicMaterial color="#8bb7d9" transparent opacity={opacity} depthWrite={false} />
    </lineLoop>
  );
}

function CelestialChart() {
  const catalogLines = useMemo(() => [
    [[-8.2, 5.8, -8], [-6.6, 4.3, -8], [-7.4, 2.9, -8]],
    [[6.7, 6.2, -10], [8.1, 5.15, -10], [7.35, 3.7, -10], [9.1, 2.65, -10]],
    [[-9.2, -1.2, -9], [-7.2, -2.8, -9], [-8.4, -4.8, -9], [-6.1, -6.1, -9]],
    [[2.2, -6.5, -11], [3.7, -7.3, -11], [5.0, -6.4, -11]],
  ].map((segment) => {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      segment.map((point) => new THREE.Vector3(point[0], point[1], point[2])),
    );
    const material = new THREE.LineBasicMaterial({
      color: "#8db7d7",
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    return new THREE.Line(geometry, material);
  }), []);

  useEffect(() => () => catalogLines.forEach((line) => {
    line.geometry.dispose();
    (line.material as THREE.Material).dispose();
  }), [catalogLines]);

  return (
    <group>
      <ChartArc radius={8.9} rotation={[0, 0, 0]} opacity={0.075} />
      <ChartArc radius={11.8} rotation={[0.52, 0.08, -0.2]} opacity={0.055} />
      <ChartArc radius={14.4} rotation={[0.16, 0.64, 0.5]} opacity={0.04} />
      {catalogLines.map((line, index) => (
        <primitive key={index} object={line} />
      ))}
    </group>
  );
}

function ActiveRoute({ star, reducedMotion }: { readonly star: GalaxyStar; readonly reducedMotion: boolean }) {
  const geometry = useMemo(() => {
    const start = new THREE.Vector3(-0.2, -7.3, 3.6);
    const end = new THREE.Vector3(...galaxyStarPosition(star));
    const midpoint = start.clone().lerp(end, 0.52);
    midpoint.z += 1.4;
    midpoint.x += star.position[0] > 0 ? -0.55 : 0.55;
    const curve = new THREE.QuadraticBezierCurve3(start, midpoint, end);
    return new THREE.BufferGeometry().setFromPoints(curve.getPoints(56));
  }, [star]);
  const material = useMemo(() => new THREE.LineBasicMaterial({
    color: star.accent,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [star.accent]);
  const routeLine = useMemo(() => {
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 4;
    return line;
  }, [geometry, material]);
  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);
  useFrame(({ clock }) => {
    material.opacity = reducedMotion
      ? 0.3
      : 0.22 + Math.sin(clock.elapsedTime * 1.5) * 0.08;
  });
  return <primitive object={routeLine} />;
}

function CameraRig({
  focusedStar,
  warping,
  resetSerial,
  reducedMotion,
  onExplorationChange,
}: {
  readonly focusedStar: GalaxyStar | null;
  readonly warping: boolean;
  readonly resetSerial: number;
  readonly reducedMotion: boolean;
  readonly onExplorationChange: (exploring: boolean) => void;
}) {
  const { camera, gl, size } = useThree();
  const aimCamera = useRef(new THREE.PerspectiveCamera());
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const dragRef = useRef({ active: false, pointerId: -1, x: 0, y: 0, moved: 0 });

  useEffect(() => {
    yawRef.current = 0;
    pitchRef.current = 0;
  }, [resetSerial]);

  useEffect(() => {
    if (warping) return;
    const element = gl.domElement;
    const previousTouchAction = element.style.touchAction;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      dragRef.current = { active: true, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: 0 };
      element.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag.active || drag.pointerId !== event.pointerId || focusedStar) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      drag.x = event.clientX;
      drag.y = event.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      yawRef.current = THREE.MathUtils.clamp(
        yawRef.current - dx * 0.0015,
        -ZEBULON_HOME_CAMERA.maximumYaw,
        ZEBULON_HOME_CAMERA.maximumYaw,
      );
      pitchRef.current = THREE.MathUtils.clamp(
        pitchRef.current + dy * 0.00125,
        ZEBULON_HOME_CAMERA.minimumPitch,
        ZEBULON_HOME_CAMERA.maximumPitch,
      );
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!dragRef.current.active || dragRef.current.pointerId !== event.pointerId) return;
      const explored = dragRef.current.moved > 5;
      dragRef.current.active = false;
      if (explored) onExplorationChange(true);
      element.releasePointerCapture?.(event.pointerId);
    };

    element.style.touchAction = "none";
    element.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      element.style.touchAction = previousTouchAction;
      element.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [focusedStar, gl, onExplorationChange, warping]);

  useFrame((_, delta) => {
    const aspect = size.width / Math.max(size.height, 1);
    const portraitPullback = aspect < 0.78 ? 2.15 : 0;
    const widePullback = aspect > 1.25 ? Math.min(3.2, (aspect - 1.25) * 3.7) : 0;
    const homePosition = new THREE.Vector3(
      ZEBULON_HOME_CAMERA.position[0],
      ZEBULON_HOME_CAMERA.position[1],
      ZEBULON_HOME_CAMERA.position[2] + portraitPullback + widePullback,
    );
    const homeTarget = new THREE.Vector3(...ZEBULON_HOME_CAMERA.target);
    const targetPosition = homePosition.clone();

    if (focusedStar) {
      const focusPoint = new THREE.Vector3(...galaxyStarPosition(focusedStar));
      const approach = focusPoint.clone().sub(homePosition).normalize();
      targetPosition.addScaledVector(approach, warping ? 6.5 : 1.35);
    }

    const dampRate = reducedMotion ? 24 : warping ? 5.4 : FOCUS_SLEW_RATE;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, targetPosition.x, dampRate, delta);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetPosition.y, dampRate, delta);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetPosition.z, dampRate, delta);

    let lookTarget: THREE.Vector3;
    if (focusedStar) {
      lookTarget = new THREE.Vector3(...galaxyStarPosition(focusedStar));
    } else {
      const direction = homeTarget.sub(homePosition).normalize();
      direction.applyEuler(new THREE.Euler(pitchRef.current, yawRef.current, 0, "YXZ"));
      lookTarget = camera.position.clone().addScaledVector(direction, 20);
    }

    aimCamera.current.position.copy(camera.position);
    aimCamera.current.lookAt(lookTarget);
    camera.quaternion.slerp(aimCamera.current.quaternion, Math.min(1, dampRate * delta));

    const perspective = camera as THREE.PerspectiveCamera;
    const baseFov = ZEBULON_HOME_CAMERA.fov + (aspect < 0.78 ? 3 : 0);
    const targetFov = warping ? 15 : focusedStar ? 39 : baseFov;
    perspective.fov = THREE.MathUtils.damp(perspective.fov, targetFov, dampRate, delta);
    perspective.updateProjectionMatrix();
  });

  return null;
}

function ConstellationScene({
  focusedId,
  hoveredId,
  warpingId,
  resetSerial,
  onSelect,
  onHover,
  onMissed,
  onExplorationChange,
  reducedMotion,
}: {
  readonly focusedId: string | null;
  readonly hoveredId: string | null;
  readonly warpingId: string | null;
  readonly resetSerial: number;
  readonly onSelect: (star: GalaxyStar) => void;
  readonly onHover: (id: string | null) => void;
  readonly onMissed: () => void;
  readonly onExplorationChange: (exploring: boolean) => void;
  readonly reducedMotion: boolean;
}) {
  const activeId = warpingId ?? focusedId ?? hoveredId;
  const activeStar = galaxyById(activeId);
  const focusedStar = galaxyById(warpingId ?? focusedId);

  return (
    <>
      <fog attach="fog" args={["#01020a", 34, 92]} />
      <StarLayer count={2200} width={64} height={46} zNear={-30} zFar={-62} size={3.3} opacity={0.78} seed="catalog" clusters={11} />
      <StarLayer count={780} width={38} height={28} zNear={-8} zFar={-27} size={4.8} opacity={0.72} seed="navigation" clusters={7} />
      <CelestialChart />
      {GALAXY_CONSTELLATION.map((star) => (
        <GalaxyStarObject
          key={star.id}
          star={star}
          focusedId={focusedId}
          activeId={activeId}
          warpingId={warpingId}
          onSelect={onSelect}
          onHover={onHover}
          reducedMotion={reducedMotion}
        />
      ))}
      {activeStar ? <ActiveRoute star={activeStar} reducedMotion={reducedMotion} /> : null}
      <StarLayer count={92} width={26} height={20} zNear={7} zFar={2.5} size={7.2} opacity={0.28} seed="foreground" clusters={4} />
      <CameraRig
        focusedStar={focusedStar}
        warping={Boolean(warpingId)}
        resetSerial={resetSerial}
        reducedMotion={reducedMotion}
        onExplorationChange={onExplorationChange}
      />
      <mesh onClick={onMissed} position={[0, 0, -18]}>
        <planeGeometry args={[88, 60]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  );
}

const GALAXY_DOCK_TOOLS = [
  { id: "memory", label: "Memory", Icon: Database, route: "/learning/studio" },
  { id: "knowledge", label: "Knowledge", Icon: BookOpen, route: "/knowledge" },
  { id: "projects", label: "Projects", Icon: FolderOpen, route: "/projects" },
] as const;

/** The Image-2 galaxy-map bottom bar: Galaxy Map (admin) · compass dial · NΞXYS Dock tools. */
function GalaxyMapDock({ navigate }: { readonly navigate: (to: string) => void }) {
  return (
    <div
      data-testid="galaxy-map-dock"
      className="flex w-full items-center justify-between gap-2 rounded-2xl border border-violet-300/12 bg-[linear-gradient(105deg,rgba(4,8,20,0.86),rgba(8,6,24,0.88),rgba(3,8,18,0.86))] px-3 py-2.5 shadow-[0_12px_55px_rgba(0,0,0,0.45),0_0_32px_rgba(124,58,237,0.08)] backdrop-blur-2xl sm:px-4"
    >
      <button
        type="button"
        data-testid="galaxy-map-admin-button"
        onClick={() => navigate("/admin")}
        className="flex shrink-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-white/55 transition hover:text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-200/40"
      >
        <Crosshair size={15} />
        <span className="hidden text-[9px] font-medium uppercase tracking-[0.16em] xs:inline sm:inline">Galaxy Map</span>
      </button>

      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-violet-300/25 bg-violet-400/5 shadow-[0_0_22px_rgba(139,92,246,0.22)]" aria-hidden="true">
        <span className="absolute inset-[3px] rounded-full border border-white/10" />
        <span className="absolute inset-[7px] rounded-full border border-violet-200/10" />
        <Navigation size={16} className="-rotate-45 text-violet-100" strokeWidth={1.5} />
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="hidden items-center gap-1.5 sm:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.7)]" />
          <span className="text-[9px] font-medium uppercase tracking-[0.16em] text-emerald-200/70">NΞXYS Dock</span>
        </div>
        {GALAXY_DOCK_TOOLS.map(({ id, label, Icon, route }) => (
          <button
            key={id}
            type="button"
            data-testid={`galaxy-dock-${id}`}
            onClick={() => navigate(route)}
            className="flex min-w-0 flex-col items-center gap-0.5 rounded-lg px-1 py-0.5 text-white/60 transition hover:text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-200/40"
          >
            <Icon size={16} />
            <span className="text-[8px] font-medium uppercase tracking-[0.12em]">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Focused-star info card: name, console, and a one-line galaxy summary. */
function StarDetailCard({
  star,
  reducedMotion,
  warping,
  onEnter,
}: {
  readonly star: GalaxyStar;
  readonly reducedMotion: boolean;
  readonly warping: boolean;
  readonly onEnter: () => void;
}) {
  return (
    <motion.section
      key={`star-card-${star.id}`}
      className="zebulon-vessel-panel absolute inset-x-3 z-20 mx-auto flex max-w-[760px] items-center justify-between gap-4 rounded-2xl border bg-[linear-gradient(105deg,rgba(4,8,20,0.88),rgba(8,6,24,0.9),rgba(3,8,18,0.88))] px-4 py-3 backdrop-blur-2xl sm:px-5"
      style={{ borderColor: `${star.accent}33`, boxShadow: `0 12px 55px rgba(0,0,0,0.45), 0 0 34px ${star.accent}22` }}
      aria-label={`${star.name} galaxy`}
      data-testid="star-detail-card"
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
          style={{ borderColor: `${star.accent}44`, boxShadow: `0 0 24px ${star.accent}33` }}
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: star.accent, boxShadow: `0 0 10px 2px ${star.accent}` }} />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-[12px] font-bold uppercase tracking-[0.16em]" style={{ color: star.accentSoft }}>
            {star.name} <span className="font-medium text-white/45">· {star.console}</span>
          </h2>
          <p className="mt-1 text-[10px] leading-snug text-white/55">{star.description}</p>
        </div>
      </div>
      {star.route ? (
        <button
          type="button"
          data-testid="star-enter-button"
          onClick={onEnter}
          disabled={warping}
          className="flex shrink-0 items-center gap-2 rounded-lg border bg-black/30 px-4 py-2.5 text-[9px] font-medium uppercase tracking-[0.16em] text-white/75 transition hover:text-white focus:outline-none focus:ring-2 disabled:opacity-40 sm:px-5"
          style={{ borderColor: `${star.accent}44` }}
        >
          Enter <ArrowRight size={14} />
        </button>
      ) : (
        <span
          data-testid="star-gateway-forming"
          className="shrink-0 rounded-lg border border-white/12 px-3 py-2 text-center text-[8px] uppercase leading-tight tracking-[0.16em] text-white/40"
        >
          Gateway<br />forming
        </span>
      )}
    </motion.section>
  );
}

export default function ZebulonConstellationPage() {
  const [, navigate] = useLocation();
  const reducedMotion = Boolean(useReducedMotion());
  const [webgl, setWebgl] = useState(true);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [warpingId, setWarpingId] = useState<string | null>(null);
  const [dockPowered, setDockPowered] = useState(false);
  const [exploring, setExploring] = useState(false);
  const [resetSerial, setResetSerial] = useState(0);
  const warpTimerRef = useRef<number | null>(null);

  useEffect(() => setWebgl(canUseNexysWebgl()), []);
  useEffect(() => () => {
    if (warpTimerRef.current !== null) window.clearTimeout(warpTimerRef.current);
    document.body.style.cursor = "";
  }, []);

  const beginWarp = useCallback((starId: string, route: string) => {
    if (warpingId) return;
    setFocusedId(starId);
    setHoveredId(null);
    setWarpingId(starId);
    warpTimerRef.current = window.setTimeout(
      () => navigate(route),
      reducedMotion ? 0 : WARP_DURATION_MS,
    );
  }, [navigate, reducedMotion, warpingId]);

  const handleSelect = useCallback((star: GalaxyStar) => {
    if (warpingId) return;
    if (focusedId !== star.id) {
      setFocusedId(star.id);
      setExploring(false);
      return;
    }
    if (star.route) beginWarp(star.id, star.route);
  }, [beginWarp, focusedId, warpingId]);

  const resetOverview = useCallback(() => {
    if (warpingId) return;
    setFocusedId(null);
    setHoveredId(null);
    setExploring(false);
    setResetSerial((value) => value + 1);
  }, [warpingId]);

  const handleMissed = useCallback(() => {
    if (!warpingId) resetOverview();
  }, [resetOverview, warpingId]);

  const headerGalaxy = galaxyById(warpingId ?? focusedId ?? hoveredId) ?? galaxyById("zar")!;
  const focusedStar = galaxyById(focusedId);

  return (
    <ConsoleShell
      identity={ZAR_NEXYS_CONSOLE}
      dockPowered={dockPowered}
      onDockPowerChange={setDockPowered}
      bottomBar={<GalaxyMapDock navigate={navigate} />}
      headerLeft={
        <NexysConsoleHeaderBrand
          onWordmarkClick={resetOverview}
          wordmarkAriaLabel="Reset the Zebulon Galaxy map"
          context={{ label: headerGalaxy.name, color: headerGalaxy.accent }}
        />
      }
      headerRightExtra={
        <>
          <div
            data-testid="nexys-online-pill"
            className="flex items-center gap-2 rounded-full border border-emerald-300/25 bg-black/40 px-3 py-1 backdrop-blur"
          >
            <span className="block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.7)]" aria-hidden="true" />
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-200/80">NΞXYS Online</span>
          </div>
          <NexysConsoleHeaderTelemetry visible={!warpingId} />
        </>
      }
    >
      <div
        className="absolute inset-0 overflow-hidden bg-[radial-gradient(ellipse_82%_60%_at_50%_40%,#100b34_0%,#0a0722_42%,#050313_76%,#01000a_100%)]"
        data-testid="zebulon-constellation-canvas"
        data-reference-viewport={`${ZEBULON_REFERENCE_VIEWPORT.width}x${ZEBULON_REFERENCE_VIEWPORT.height}`}
      >
        {webgl ? (
          <Canvas
            dpr={[1, 1.8]}
            gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
            camera={{
              position: [...ZEBULON_HOME_CAMERA.position],
              fov: ZEBULON_HOME_CAMERA.fov,
              near: ZEBULON_HOME_CAMERA.near,
              far: ZEBULON_HOME_CAMERA.far,
            }}
            onCreated={({ gl }) => {
              gl.outputColorSpace = THREE.SRGBColorSpace;
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.3;
            }}
            onPointerMissed={handleMissed}
          >
            <ConstellationScene
              focusedId={focusedId}
              hoveredId={hoveredId}
              warpingId={warpingId}
              resetSerial={resetSerial}
              onSelect={handleSelect}
              onHover={setHoveredId}
              onMissed={handleMissed}
              onExplorationChange={setExploring}
              reducedMotion={reducedMotion}
            />
          </Canvas>
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/55">
            A WebGL-capable browser is required to render the Zebulon constellation.
          </div>
        )}
      </div>

      <div className="zebulon-chart-vignette pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="zebulon-chart-orientation pointer-events-none absolute inset-0" aria-hidden="true">
        <span className="zebulon-chart-north">N</span>
        <span className="zebulon-chart-west">W</span>
        <span className="zebulon-chart-east">E</span>
        <span className="zebulon-chart-south">S</span>
      </div>

      <div className="zebulon-catalog-readout pointer-events-none absolute right-5 top-28 hidden text-[8px] uppercase leading-[1.65] tracking-[0.12em] text-cyan-100/35 sm:block sm:right-7 sm:top-28">
        <div>RA&nbsp;&nbsp;&nbsp;&nbsp;08h 47m 12s</div>
        <div>DEC&nbsp;&nbsp;+19° 21′ 07″</div>
        <div>DIST&nbsp;&nbsp;3.21 kpc</div>
      </div>

      <AnimatePresence>
        {(focusedId || exploring) && !warpingId ? (
          <motion.button
            type="button"
            onClick={resetOverview}
            className="absolute right-4 top-40 z-20 flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-2 text-[9px] uppercase tracking-[0.16em] text-white/60 backdrop-blur-xl transition hover:border-cyan-200/25 hover:text-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-200/40 sm:right-6"
            initial={reducedMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            <RotateCcw size={12} /> Reset chart
          </motion.button>
        ) : null}
      </AnimatePresence>

      <div className="zebulon-chart-legend pointer-events-none absolute left-5 z-10 rounded-lg border border-white/10 bg-black/28 px-3 py-2.5 text-[8px] uppercase tracking-[0.16em] text-white/42 backdrop-blur-sm sm:left-7">
        <div className="flex items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full bg-blue-100 shadow-[0_0_8px_2px_rgba(191,219,254,0.7)]" /> Star / Galaxy gateway</div>
        <div className="mt-1.5 flex items-center gap-2.5"><Orbit size={10} /> Nebula</div>
        <div className="mt-1.5 flex items-center gap-2.5"><span className="h-px w-3 bg-cyan-100/30" /> Constellation line</div>
        <div className="mt-1.5 flex items-center gap-2.5"><Crosshair size={10} /> Navigation beacon</div>
      </div>

      <AnimatePresence mode="wait">
        {focusedStar && !warpingId ? (
          <StarDetailCard
            star={focusedStar}
            reducedMotion={reducedMotion}
            warping={Boolean(warpingId)}
            onEnter={() => focusedStar.route && beginWarp(focusedStar.id, focusedStar.route)}
          />
        ) : !dockPowered ? (
          <motion.section
            key="zebulon-vessel"
            className="zebulon-vessel-panel absolute inset-x-3 z-20 mx-auto flex max-w-[760px] items-center justify-between gap-4 rounded-2xl border border-violet-300/15 bg-[linear-gradient(105deg,rgba(4,8,20,0.86),rgba(8,6,24,0.88),rgba(3,8,18,0.86))] px-4 py-3 shadow-[0_12px_55px_rgba(0,0,0,0.45),0_0_32px_rgba(124,58,237,0.08)] backdrop-blur-2xl sm:px-5"
            aria-label="Zebulon Vessel"
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-violet-300/20 bg-violet-400/5 text-violet-200 shadow-[0_0_24px_rgba(139,92,246,0.16)]">
                <Rocket size={19} strokeWidth={1.2} />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-[11px] font-semibold uppercase tracking-[0.17em] text-violet-200 sm:text-[12px]">
                  Zebulon Vessel
                </h2>
                <p className="mt-1 truncate text-[9px] tracking-[0.05em] text-white/44 sm:text-[10px]">
                  Your command center in the stars.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => beginWarp("zar", ZEBULON_VESSEL_ROUTE)}
              disabled={Boolean(warpingId)}
              className="flex shrink-0 items-center gap-4 rounded-lg border border-violet-200/25 bg-black/30 px-4 py-2.5 text-[9px] font-medium uppercase tracking-[0.16em] text-white/70 transition hover:border-violet-200/45 hover:bg-violet-400/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-200/45 disabled:opacity-40 sm:px-6"
            >
              Enter Vessel <ArrowRight size={14} />
            </button>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <div
        className="pointer-events-none absolute inset-0 z-40 bg-white"
        style={{
          opacity: 0,
          animation: warpingId && !reducedMotion
            ? `zebulon-warp-flash ${WARP_DURATION_MS}ms ease-in-out forwards`
            : undefined,
        }}
      />
      <style>{`
        @keyframes zebulon-warp-flash {
          0% { opacity: 0; }
          50% { opacity: 0.08; }
          82% { opacity: 0.88; }
          100% { opacity: 0; }
        }
      `}</style>
    </ConsoleShell>
  );
}
