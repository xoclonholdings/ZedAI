/**
 * NexysCore V2 — living celestial navigation system.
 *
 * Default export renders its own R3F <Canvas> (transparent, fills container).
 * Named export <NexysCoreScene /> can be dropped into an existing Canvas.
 *
 * V2: domains are planets (unique scale/color/orbit/inclination), no graph
 * lines, snap-to-nearest-domain on release, expanded universe (distant stars,
 * nebulae, dust), NEXYS core tap = home, planet tap = domain select.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ElementType,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as THREE from "three";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";

/* ------------------------------------------------------------------ */
/* Palette & domains                                                    */
/* ------------------------------------------------------------------ */

const CYAN = "#22d3ee";
const PURPLE = "#a855f7";
const MAGENTA = "#ff3ec8";
const CORE_HOT = "#ffe9fb";

/**
 * Shared between RotationRig's camera dolly and Planet's own Y-centering:
 * the camera's framing when a planet is focused, so Planet can compute
 * exactly where its own depth crosses the camera's viewing ray instead of
 * guessing at a single world-Y that only happens to work for some domains.
 */
const FOCUS_CAM_Y = 0.6;
const focusClearance = (portrait: boolean) => (portrait ? 5.6 : 4.3);
const focusLookY = (portrait: boolean) => (portrait ? -1.6 : -0.35);

export interface NexysDomain {
  id: string;
  label: string;
  color: string;
  size: number;
  radius: number;
  inclination: number;
  angle: number;
  ring?: boolean;
  moon?: boolean;
  /** 0..1 — rings appear and grow with node usage */
  usage?: number;
  icon?: ComponentType<{ color?: string; size?: number | string; strokeWidth?: number | string }> | ElementType;
}

const wrapAngle = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));

function domainPosition(d: NexysDomain): THREE.Vector3 {
  return new THREE.Vector3(
    Math.cos(d.angle) * d.radius,
    Math.sin(d.angle) * Math.sin(d.inclination) * d.radius,
    Math.sin(d.angle) * Math.cos(d.inclination) * d.radius,
  );
}

function domainSnapTarget(d: NexysDomain): number {
  // Solve for the Y-axis rig rotation that puts this domain's (x, z) at
  // x=0, z>0 - dead-center, between the camera and the core. A rotation by
  // theta maps (x,z) -> (x*cos(theta)+z*sin(theta), -x*sin(theta)+z*cos(theta));
  // atan2(-x, z) is exactly the theta that zeroes the new x (with the new z
  // positive, i.e. toward the camera, not behind the core).
  const x = Math.cos(d.angle) * d.radius;
  const z = Math.sin(d.angle) * Math.cos(d.inclination) * d.radius;
  return wrapAngle(Math.atan2(-x, z));
}

/* ------------------------------------------------------------------ */
/* Shaders                                                             */
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

const shootingStarVertex = /* glsl */ `
  attribute float aEnd;
  varying float vEnd;
  void main() {
    vEnd = aEnd;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const shootingStarFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vEnd;
  void main() {
    gl_FragColor = vec4(uColor, vEnd * uOpacity);
  }
`;

const coreVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const coreFragment = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float fresnel = pow(1.0 - abs(dot(vNormal, vView)), 2.2);
    float pulse = 0.75 + 0.25 * sin(uTime * 1.6);
    vec3 col = mix(uColorA, uColorB, fresnel);
    gl_FragColor = vec4(col, (0.18 + fresnel * 0.9) * pulse * uOpacity);
  }
`;

const planetVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vUnit;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vUnit = normalize(position);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const planetFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uFocus;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vUnit;
  void main() {
    vec3 n = normalize(vNormal);
    vec3 lightDir = normalize(vec3(0.55, 0.5, 0.72));
    float diff = clamp(dot(n, lightDir), 0.0, 1.0);
    float fresnel = pow(1.0 - abs(dot(n, normalize(vView))), 2.3);
    float bands = 0.5 + 0.5 * sin(vUnit.y * 9.0 + uTime * 0.25 + vUnit.x * 2.0);
    vec3 base = uColor * (0.14 + 0.72 * diff) * (0.86 + bands * 0.14);
    vec3 col = base + uColor * fresnel * (1.05 + uFocus * 0.9) + vec3(1.0) * fresnel * 0.1;
    gl_FragColor = vec4(col, uOpacity);
  }
`;

/* ------------------------------------------------------------------ */
/* Texture helpers                                                     */
/* ------------------------------------------------------------------ */

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
 * Renders text straight to a canvas rather than using drei's <Text>
 * (troika-three-text): troika fetches unicode-fallback font-resolution data
 * from a CDN on first use, and an unreachable/blocked CDN throws unhandled
 * and blanks the whole scene. A plain canvas texture has no such dependency,
 * and a three.js sprite is always camera-facing on its own - no Billboard
 * wrapper needed either.
 */
/** Canvas dims for the core's wordmark texture - kept alongside the sprite scale below so the two stay in the same aspect ratio. */
const LABEL_CANVAS_WIDTH = 512;
const LABEL_CANVAS_HEIGHT = 176;
/** Fraction of the canvas width the glyphs themselves should span - end to end across the orb, per the brand mark. */
const LABEL_FILL_RATIO = 0.94;

function makeLabelTexture(text: string): THREE.CanvasTexture {
  const width = LABEL_CANVAS_WIDTH;
  const height = LABEL_CANVAS_HEIGHT;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const spaced = text.split("").join("\u2009");
  const cx = width / 2;
  const cy = height / 2;

  // Largest font size that still fits the target width, so the wordmark
  // spans end to end across the orb instead of floating with margin.
  const targetWidth = width * LABEL_FILL_RATIO;
  let fontSize = 140;
  let fontSpec = "";
  do {
    fontSpec = `800 ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.font = fontSpec;
    if (ctx.measureText(spaced).width <= targetWidth) break;
    fontSize -= 2;
  } while (fontSize > 24);
  ctx.font = fontSpec;

  // Soft dark backing plate, wide and blurred, so the mark reads as a
  // distinct object sitting on the sun rather than blending into its
  // bright, ever-shifting energy - drawn well oversized via a heavy blur,
  // not a crisp shape.
  ctx.shadowColor = "rgba(5,2,14,0.95)";
  ctx.shadowBlur = 26;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = "rgba(5,2,14,0.95)";
  ctx.fillText(spaced, cx, cy);
  ctx.fillText(spaced, cx, cy);

  // Recessed shadow beneath the glyphs, offset down-right for depth.
  ctx.shadowColor = "rgba(8,3,18,0.9)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "rgba(8,3,18,0.85)";
  ctx.fillText(spaced, cx, cy + 3);

  // Thick dark outline so the mark stays sharply defined against any energy color.
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.lineWidth = 9;
  ctx.strokeStyle = "rgba(5,2,14,0.92)";
  ctx.strokeText(spaced, cx, cy);

  // Brand gradient fill: violet -> blue -> pale cyan (matches the official ZAR wordmark).
  const gradient = ctx.createLinearGradient(width * 0.06, 0, width * 0.94, 0);
  gradient.addColorStop(0, "#8a63f2");
  gradient.addColorStop(0.45, "#5a9bff");
  gradient.addColorStop(1, "#d8faff");
  ctx.shadowColor = "rgba(20,8,40,0.55)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = gradient;
  ctx.fillText(spaced, cx, cy);

  // Bright emboss highlight along the top edge, offset up-left, for the glossy 3D pop.
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.strokeText(spaced, cx - 1.5, cy - 1.5);

  const texture = new THREE.CanvasTexture(canvas);
  // Canvas 2D draws in sRGB; without tagging the texture as such, the
  // renderer's linear pipeline treats these bytes as already-linear and
  // re-applies gamma on output, washing the brand gradient toward white.
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeNebulaTexture(hue: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  for (let i = 0; i < 9; i++) {
    const x = size * (0.22 + Math.random() * 0.56);
    const y = size * (0.22 + Math.random() * 0.56);
    const r = size * (0.12 + Math.random() * 0.24);
    const h = hue + (Math.random() - 0.5) * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `hsla(${h}, 85%, ${55 + Math.random() * 15}%, ${0.16 + Math.random() * 0.14})`);
    g.addColorStop(1, "hsla(0, 0%, 0%, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return new THREE.CanvasTexture(canvas);
}

/* ------------------------------------------------------------------ */
/* Geometry builders                                                   */
/* ------------------------------------------------------------------ */

interface GalaxyOptions {
  count: number;
  radius: number;
  branches: number;
  spin: number;
  randomness: number;
  randomnessPower: number;
}

function buildGalaxyGeometry(opts: GalaxyOptions): THREE.BufferGeometry {
  const { count, radius, branches, spin, randomness, randomnessPower } = opts;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const rands = new Float32Array(count);

  const inside = new THREE.Color(CORE_HOT);
  const mid = new THREE.Color(MAGENTA);
  const midOuter = new THREE.Color(PURPLE);
  const outside = new THREE.Color(CYAN);
  const tmp = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const r = Math.pow(Math.random(), 0.65) * radius;
    const branchAngle = ((i % branches) / branches) * Math.PI * 2;
    const spinAngle = r * spin;

    const rnd = () =>
      Math.pow(Math.random(), randomnessPower) *
      (Math.random() < 0.5 ? 1 : -1) *
      randomness *
      (0.25 + r);

    positions[i3] = Math.cos(branchAngle + spinAngle) * r + rnd();
    positions[i3 + 1] = rnd() * 0.28;
    positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * r + rnd();

    const t = r / radius;
    if (t < 0.25) tmp.copy(inside).lerp(mid, t / 0.25);
    else if (t < 0.6) tmp.copy(mid).lerp(midOuter, (t - 0.25) / 0.35);
    else tmp.copy(midOuter).lerp(outside, (t - 0.6) / 0.4);

    colors[i3] = tmp.r;
    colors[i3 + 1] = tmp.g;
    colors[i3 + 2] = tmp.b;
    scales[i] = 0.4 + Math.random() * (t < 0.2 ? 1.6 : 1.0);
    rands[i] = Math.random();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geo.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
  geo.setAttribute("aRand", new THREE.BufferAttribute(rands, 1));
  return geo;
}

/** A flattened ring band around the Y axis - the meteor belt, sitting between the domains' orbits and the far starfield. */
function buildBeltGeometry(count: number, radius: number, thickness: number, palette: string[]): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const rands = new Float32Array(count);
  const cols = palette.map((p) => new THREE.Color(p));

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const angle = Math.random() * Math.PI * 2;
    const r = radius + (Math.random() - 0.5) * thickness;
    positions[i3] = Math.cos(angle) * r;
    positions[i3 + 1] = (Math.random() - 0.5) * thickness * 0.22;
    positions[i3 + 2] = Math.sin(angle) * r;
    const c = cols[Math.floor(Math.random() * cols.length)];
    colors[i3] = c.r;
    colors[i3 + 1] = c.g;
    colors[i3 + 2] = c.b;
    scales[i] = 0.25 + Math.random() * 0.55;
    rands[i] = Math.random();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geo.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
  geo.setAttribute("aRand", new THREE.BufferAttribute(rands, 1));
  return geo;
}

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
    const dir = new THREE.Vector3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
    ).normalize();
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

/* ------------------------------------------------------------------ */
/* Interaction state shared between rig and clickable objects           */
/* ------------------------------------------------------------------ */

interface InteractionState {
  active: boolean;
  lastX: number;
  lastY: number;
  tilt: number;
  moved: number;
  /** Accumulated horizontal drag since the last committed step - a paging
   *  gesture, not a free-spin. */
  dragAccum: number;
  /** The one authoritative "which planet is front-and-center" index - set by
   *  a step (drag past threshold) or a direct tap, never by raw drag delta. */
  activeIndex: number;
}

type InteractionRef = MutableRefObject<InteractionState>;

const isTap = (d: InteractionState) => d.moved < 8;

/* ------------------------------------------------------------------ */
/* Universe environment (outside the rig)                              */
/* ------------------------------------------------------------------ */

function Universe({ starCount }: { starCount: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const starGeo = useMemo(
    () => buildScatterGeometry(starCount, 18, 36, 1, ["#ffffff", "#bfe8ff", "#d9c8ff", CYAN]),
    [starCount],
  );
  const starMat = useMemo(() => makePointsMaterial(5), []);
  const nebulae = useMemo(
    () => [
      { tex: makeNebulaTexture(275), pos: [-9, 4, -14], scale: 22, opacity: 0.5 },
      { tex: makeNebulaTexture(190), pos: [11, -3, -16], scale: 26, opacity: 0.42 },
      { tex: makeNebulaTexture(315), pos: [4, 7, -18], scale: 20, opacity: 0.38 },
      { tex: makeNebulaTexture(230), pos: [-12, -6, -20], scale: 24, opacity: 0.34 },
    ],
    [],
  );

  useEffect(
    () => () => {
      starGeo.dispose();
      starMat.dispose();
      nebulae.forEach((n) => n.tex.dispose());
    },
    [starGeo, starMat, nebulae],
  );

  useFrame(({ clock }, delta) => {
    starMat.uniforms.uTime.value = clock.elapsedTime;
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.006;
  });

  return (
    <group ref={groupRef}>
      <points geometry={starGeo} material={starMat} />
      {nebulae.map((n, i) => (
        <sprite key={i} position={n.pos as [number, number, number]} scale={[n.scale, n.scale, 1]}>
          <spriteMaterial
            map={n.tex}
            transparent
            opacity={n.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Galaxy (self-spinning, keeps the system alive)                       */
/* ------------------------------------------------------------------ */

function GalaxyField({ count, focused }: { count: number; focused?: boolean }) {
  const spinRef = useRef<THREE.Group>(null);
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const geometry = useMemo(
    () =>
      buildGalaxyGeometry({
        count,
        radius: 5,
        branches: 4,
        spin: 1.55,
        randomness: 0.32,
        randomnessPower: 2.6,
      }),
    [count],
  );
  const material = useMemo(() => makePointsMaterial(9), []);
  const dustGeometry = useMemo(
    () => buildScatterGeometry(Math.floor(count * 0.05), 1.5, 7, 0.7, [CYAN, PURPLE, "#ffffff"]),
    [count],
  );
  const dustMaterial = useMemo(() => makePointsMaterial(6), []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      dustGeometry.dispose();
      dustMaterial.dispose();
    },
    [geometry, material, dustGeometry, dustMaterial],
  );

  useFrame(({ clock }, delta) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    dustMaterial.uniforms.uTime.value = clock.elapsedTime;
    if (spinRef.current) spinRef.current.rotation.y += delta * 0.03;

    // The galaxy disk reads as "the Nexys core" as much as the CoreOrb mesh
    // does - it has to fade too, or the focused planet never actually reads
    // as the center once it's dominating the screen.
    const fadeRate = Math.min(1, 3.2 * delta);
    const opacityTarget = focusedRef.current ? 0.1 : 1;
    material.uniforms.uOpacity.value += (opacityTarget - material.uniforms.uOpacity.value) * fadeRate;
    dustMaterial.uniforms.uOpacity.value += (opacityTarget - dustMaterial.uniforms.uOpacity.value) * fadeRate;
  });

  return (
    <group ref={spinRef}>
      <points geometry={geometry} material={material} />
      <points geometry={dustGeometry} material={dustMaterial} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Space character: meteor belt, shooting stars, satellites             */
/* ------------------------------------------------------------------ */

/**
 * A warm rocky ring just beyond the domains' orbits - close and bright
 * enough to read as a distinct belt, not lost in the far starfield.
 * Drifts independently of the drag rig.
 *
 * Point size is much bigger than the galaxy dust's (22 vs. ~9) because this
 * ring is far sparser and sits alone against the nebula backdrop rather
 * than in a dense cluster - at the galaxy's point size it was there (a
 * console dump of its geometry confirmed the points), just too small and
 * faint next to everything else to actually notice.
 */
function MeteorBelt() {
  const groupRef = useRef<THREE.Group>(null);
  const geometry = useMemo(
    () => buildBeltGeometry(650, 7.0, 0.8, ["#ffb066", "#ff8c3d", "#ffcf9e", "#f5a05a"]),
    [],
  );
  const material = useMemo(() => makePointsMaterial(22), []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(({ clock }, delta) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.012;
  });

  return (
    <group ref={groupRef} rotation={[0.16, 0, 0.06]}>
      <points geometry={geometry} material={material} />
    </group>
  );
}

/**
 * Picks a short diagonal chord through the outer sky for one streak's
 * flight path. Z is forced negative (away from the camera, which settles
 * 9.6-13.4 units out depending on aspect/zoom) rather than sampled over a
 * full circle, so a streak never has to travel through the narrow gap
 * right in front of the lens.
 */
function pickShootingStarPath(): { start: THREE.Vector3; end: THREE.Vector3 } {
  const theta = Math.random() * Math.PI * 2;
  const height = -3 + Math.random() * 10;
  const radius = 9 + Math.random() * 7;
  const start = new THREE.Vector3(Math.cos(theta) * radius, height, -Math.abs(Math.sin(theta)) * radius - 3);
  const dir = new THREE.Vector3(Math.random() - 0.5, -(0.35 + Math.random() * 0.5), (Math.random() - 0.5) * 0.5).normalize();
  const length = 5 + Math.random() * 4;
  const end = start.clone().addScaledVector(dir, length);
  return { start, end };
}

/**
 * One shooting star: waits offscreen for a random interval, then streaks
 * along a short chord and fades, forever. A real 3D line segment (not a
 * camera-billboarded sprite) so it foreshortens correctly from any angle
 * without needing to track the camera's screen-space orientation.
 */
function ShootingStar({ initialDelay }: { initialDelay: number }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    geo.setAttribute("aEnd", new THREE.BufferAttribute(new Float32Array([0, 1]), 1));
    return geo;
  }, []);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: shootingStarVertex,
        fragmentShader: shootingStarFragment,
        uniforms: { uColor: { value: new THREE.Color("#e8f7ff") }, uOpacity: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );
  const state = useRef({ delay: initialDelay, t: -1, duration: 0.8, path: pickShootingStarPath() });
  // THREE.Line, not the JSX <line> intrinsic - that resolves to the DOM/SVG
  // element in this project's JSX namespace, not react-three-fiber's.
  const lineObject = useMemo(() => new THREE.Line(geometry, material), [geometry, material]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((_, delta) => {
    const s = state.current;
    if (s.t < 0) {
      s.delay -= delta;
      if (s.delay > 0) return;
      s.path = pickShootingStarPath();
      s.duration = 0.55 + Math.random() * 0.5;
      s.t = 0;
    }

    s.t += delta / s.duration;
    if (s.t >= 1) {
      s.t = -1;
      s.delay = 3 + Math.random() * 8;
      material.uniforms.uOpacity.value = 0;
      return;
    }

    const trailFraction = 0.35;
    const head = s.path.start.clone().lerp(s.path.end, s.t);
    const tail = s.path.start.clone().lerp(s.path.end, Math.max(0, s.t - trailFraction));
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, tail.x, tail.y, tail.z);
    pos.setXYZ(1, head.x, head.y, head.z);
    pos.needsUpdate = true;

    // Fade in over the first ~15% of flight, out over the last ~25%.
    const fade = Math.min(1, s.t * 7) * Math.min(1, (1 - s.t) * 4);
    material.uniforms.uOpacity.value = fade;
  });

  return <primitive object={lineObject} />;
}

function ShootingStars({ count = 3 }: { count?: number }) {
  const delays = useMemo(() => Array.from({ length: count }, (_, i) => i * 2.6 + Math.random() * 3), [count]);
  return (
    <>
      {delays.map((delay, i) => (
        <ShootingStar key={i} initialDelay={delay} />
      ))}
    </>
  );
}

interface SatelliteConfig {
  radius: number;
  speed: number;
  phase: number;
  inclination: number;
  y: number;
}

/** A tiny artificial drifter - body, two panels, a blinking light - on its own slow tilted orbit, distinct from the domain planets. */
function Satellite({ radius, speed, phase, inclination, y }: SatelliteConfig) {
  const groupRef = useRef<THREE.Group>(null);
  const blinkRef = useRef<THREE.Sprite>(null);
  const glowTexture = useMemo(() => makeGlowTexture("rgba(200,255,255,0.95)", "rgba(120,200,255,0)"), []);

  useEffect(() => () => glowTexture.dispose(), [glowTexture]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * speed + phase;
    const baseX = Math.cos(t) * radius;
    const baseZ = Math.sin(t) * radius;
    if (groupRef.current) {
      groupRef.current.position.set(baseX, y + baseZ * Math.sin(inclination) * 0.4, baseZ * Math.cos(inclination));
      groupRef.current.rotation.y = -t;
    }
    if (blinkRef.current) {
      const mat = blinkRef.current.material as THREE.SpriteMaterial;
      mat.opacity = 0.3 + 0.7 * Math.max(0, Math.sin(clock.elapsedTime * 3 + phase * 5));
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <boxGeometry args={[0.12, 0.06, 0.06]} />
        <meshBasicMaterial color="#cbd5e1" toneMapped={false} />
      </mesh>
      <mesh position={[0.16, 0, 0]}>
        <planeGeometry args={[0.2, 0.08]} />
        <meshBasicMaterial color="#3b82f6" toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-0.16, 0, 0]}>
        <planeGeometry args={[0.2, 0.08]} />
        <meshBasicMaterial color="#3b82f6" toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <sprite ref={blinkRef} scale={[0.16, 0.16, 1]} position={[0, 0.06, 0.04]}>
        <spriteMaterial map={glowTexture} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
    </group>
  );
}

// Radii stay comfortably under the camera's settled distance (9.6-13.4,
// depending on aspect/zoom - see RotationRig) so a satellite's orbit never
// carries it through the gap right in front of the lens.
const SATELLITE_CONFIGS: SatelliteConfig[] = [
  { radius: 5.4, speed: 0.09, phase: 0, inclination: 0.35, y: 2.1 },
  { radius: 6.6, speed: -0.06, phase: 2.1, inclination: -0.22, y: -1.6 },
  { radius: 4.6, speed: 0.12, phase: 4.4, inclination: 0.55, y: 3.4 },
];

function Satellites() {
  return (
    <>
      {SATELLITE_CONFIGS.map((config, i) => (
        <Satellite key={i} {...config} />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Domain icon rendered onto the planet face                            */
/* ------------------------------------------------------------------ */

function IconSprite({ domain }: { domain: NexysDomain }) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    if (!domain.icon) return;
    const Icon = domain.icon;
    const svg = renderToStaticMarkup(<Icon color={domain.color} size={96} strokeWidth={1.4} />);
    const img = new Image();
    let tex: THREE.CanvasTexture | null = null;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 128;
      const ctx = canvas.getContext("2d")!;
      ctx.shadowColor = domain.color;
      ctx.shadowBlur = 14;
      ctx.drawImage(img, 16, 16, 96, 96);
      tex = new THREE.CanvasTexture(canvas);
      setTexture(tex);
    };
    img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    return () => {
      tex?.dispose();
    };
  }, [domain]);

  if (!texture) return null;
  return (
    <sprite scale={[domain.size * 1.35, domain.size * 1.35, 1]} renderOrder={10}>
      <spriteMaterial map={texture} transparent depthTest={false} opacity={0.95} />
    </sprite>
  );
}

/* ------------------------------------------------------------------ */
/* Planet                                                              */
/* ------------------------------------------------------------------ */

/**
 * One compiled `planetVertex`/`planetFragment` program shared by every
 * domain, instead of each of the 8 domains compiling its own copy of the
 * identical shader. Measured cost of the 8 redundant compiles: on a
 * throttled (mobile-approximating) CPU, first-paint-after-login dropped
 * from ~2.8s to ~0.85s once this became a single shared material - the
 * dominant cost in the whole scene mount. Per-planet color/focus/opacity
 * differ, so each Planet keeps its own values in local refs and applies
 * them to this shared material via `onBeforeRender`, which three.js calls
 * per-object immediately before that object's own draw call - draw calls
 * are strictly sequential, so each planet still draws with its own
 * correct values even though the compiled program is shared.
 */
let sharedPlanetMaterial: THREE.ShaderMaterial | null = null;
function getSharedPlanetMaterial(): THREE.ShaderMaterial {
  if (!sharedPlanetMaterial) {
    sharedPlanetMaterial = new THREE.ShaderMaterial({
      vertexShader: planetVertex,
      fragmentShader: planetFragment,
      uniforms: {
        uColor: { value: new THREE.Color("#ffffff") },
        uTime: { value: 0 },
        uFocus: { value: 0 },
        uOpacity: { value: 1 },
      },
      transparent: true,
    });
  }
  return sharedPlanetMaterial;
}

function Planet({
  domain,
  index,
  interaction,
  focusedIndexRef,
  onSelect,
  orbitScale,
  sizeScale,
  focusMode,
}: {
  domain: NexysDomain;
  index: number;
  interaction: InteractionRef;
  focusedIndexRef: MutableRefObject<number>;
  onSelect: (domain: NexysDomain, index: number) => void;
  orbitScale: number;
  sizeScale: number;
  /** True once any planet is focused - every OTHER planet recedes (shrinks + fades) so the focused one reads as singular and central. */
  focusMode?: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const moonRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Sprite>(null);
  const focusModeRef = useRef(focusMode);
  focusModeRef.current = focusMode;
  const currentScaleRef = useRef(sizeScale);
  const position = useMemo(
    () => domainPosition(domain).multiplyScalar(orbitScale),
    [domain, orbitScale],
  );
  const currentYRef = useRef(position.y);
  const size = useThree((s) => s.size);

  // This domain's own animated values, applied to the shared material via
  // onBeforeRender right before this planet's own draw call - see
  // getSharedPlanetMaterial's comment for why this can't just be
  // `material.uniforms.X.value` like a per-instance material would.
  const colorRef = useRef(new THREE.Color(domain.color));
  const focusValueRef = useRef(0);
  const opacityValueRef = useRef(1);
  useEffect(() => {
    colorRef.current.set(domain.color);
  }, [domain.color]);

  const material = useMemo(() => getSharedPlanetMaterial(), []);
  const glowTexture = useMemo(
    () => makeGlowTexture("rgba(255,255,255,0.9)", `${domain.color}66`),
    [domain.color],
  );

  useEffect(() => () => glowTexture.dispose(), [glowTexture]);

  useFrame(({ clock }, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const t = clock.elapsedTime;
    // Frame-global (identical for every domain this frame), so setting it
    // directly is fine - unlike uColor/uFocus/uOpacity below, there's no
    // per-planet value to lose by the time the draw calls happen.
    material.uniforms.uTime.value = t;

    const focused = focusedIndexRef.current === index;
    const target = focused ? 1 : 0;
    const easeRate = Math.min(1, 5 * delta);
    focusValueRef.current += (target - focusValueRef.current) * easeRate;

    // Only the focused planet is prominent - every other planet recedes
    // (shrinks + fades) once anything is focused, so the singular focused
    // planet reads as the center and everything else as clearly peripheral.
    const peripheral = Boolean(focusModeRef.current) && !focused;
    const opacityTarget = peripheral ? 0.3 : 1;
    opacityValueRef.current += (opacityTarget - opacityValueRef.current) * easeRate;

    const sizeTarget = focused
      ? sizeScale * (1 + focusValueRef.current * 0.42)
      : peripheral
        ? sizeScale * 0.4
        : sizeScale;
    currentScaleRef.current += (sizeTarget - currentScaleRef.current) * easeRate;
    g.scale.setScalar(currentScaleRef.current);
    // Every domain sits at its own fixed height AND depth on the ring (its
    // own inclination/angle/radius) - when focused, ease toward wherever
    // this exact camera ray crosses this domain's own depth, replicating
    // RotationRig's camera dolly math (camY/clearance/lookY) so the
    // computed point is the true screen-center for THIS domain's depth, not
    // a single fixed Y that only happens to work for some radii.
    const aspect = size.width / Math.max(1, size.height);
    const portrait = aspect < 0.8;
    const camZ = domain.radius * orbitScale + focusClearance(portrait);
    const lookY = focusLookY(portrait);
    const frontDistance = Math.hypot(position.x, position.z);
    const rayT = (camZ - frontDistance) / camZ;
    const frameCenterY = FOCUS_CAM_Y + rayT * (lookY - FOCUS_CAM_Y);
    const yBaseTarget = focused ? frameCenterY : position.y;
    currentYRef.current += (yBaseTarget - currentYRef.current) * easeRate;
    g.position.y = currentYRef.current + Math.sin(t * 0.5 + index * 1.7) * 0.06;
    g.rotation.y += delta * (0.15 + index * 0.02);

    if (glowRef.current) {
      const m = glowRef.current.material as THREE.SpriteMaterial;
      const base = 0.4 + focusValueRef.current * 0.3 + Math.sin(t * 1.4 + index) * 0.05;
      m.opacity = peripheral ? base * 0.35 : base;
    }
    if (moonRef.current) moonRef.current.rotation.y += delta * 0.9;
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (isTap(interaction.current)) onSelect(domain, index);
  };

  return (
    <group ref={groupRef} position={position}>
      {/* generous invisible tap target (mobile-friendly) */}
      <mesh
        onClick={handleClick}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <sphereGeometry args={[Math.max(domain.size * 2.6, 0.5), 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh
        material={material}
        onBeforeRender={() => {
          material.uniforms.uColor.value.copy(colorRef.current);
          material.uniforms.uFocus.value = focusValueRef.current;
          material.uniforms.uOpacity.value = opacityValueRef.current;
        }}
      >
        <sphereGeometry args={[domain.size, 32, 32]} />
      </mesh>
      <sprite ref={glowRef} scale={[domain.size * 4.1, domain.size * 4.1, 1]}>
        <spriteMaterial
          map={glowTexture}
          color={domain.color}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.4}
        />
      </sprite>
      {(domain.ring || (domain.usage ?? 0) > 0.02) && (
        <mesh rotation={[1.25, 0.3, 0]}>
          <ringGeometry
            args={[
              domain.size * 1.45,
              domain.size * (1.62 + (domain.usage ?? 0) * 0.85),
              48,
            ]}
          />
          <meshBasicMaterial
            color={domain.color}
            transparent
            opacity={0.09 + (domain.usage ?? 0) * 0.2}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
      {domain.moon && (
        <group ref={moonRef}>
          <mesh position={[domain.size * 2.4, domain.size * 0.5, 0]}>
            <sphereGeometry args={[domain.size * 0.26, 16, 16]} />
            <meshBasicMaterial color="#cbd5e1" transparent opacity={0.85} />
          </mesh>
        </group>
      )}
      <IconSprite domain={domain} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* NEXYS core (the star / home anchor)                                  */
/* ------------------------------------------------------------------ */

function CoreOrb({
  label,
  interaction,
  onCoreTap,
  energyColor,
  focused,
}: {
  label: string;
  interaction: InteractionRef;
  onCoreTap?: () => void;
  energyColor?: string | null;
  /** True once a planet is focused (Target/Orbit/Hub) - the core recedes so the planet reads as the center, not Nexys. */
  focused?: boolean;
}) {
  const coreMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: coreVertex,
        fragmentShader: coreFragment,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 1 },
          uColorA: { value: new THREE.Color(MAGENTA) },
          uColorB: { value: new THREE.Color(CYAN) },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [],
  );
  const haloTexture = useMemo(
    () => makeGlowTexture("rgba(255,180,250,0.95)", "rgba(168,85,247,0.45)"),
    [],
  );
  const labelTexture = useMemo(() => makeLabelTexture(label), [label]);
  const groupRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Sprite>(null);
  const labelMatRef = useRef<THREE.SpriteMaterial>(null);
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const energyRef = useRef({ a: new THREE.Color(MAGENTA), b: new THREE.Color(CYAN), halo: new THREE.Color("#ffffff") });

  useEffect(() => {
    const e = energyRef.current;
    if (energyColor) {
      e.a.set(energyColor);
      e.b.set(energyColor).lerp(new THREE.Color("#ffffff"), 0.35);
      e.halo.set(energyColor);
    } else {
      e.a.set(MAGENTA);
      e.b.set(CYAN);
      e.halo.set("#ffffff");
    }
  }, [energyColor]);

  useEffect(
    () => () => {
      coreMaterial.dispose();
      haloTexture.dispose();
      labelTexture.dispose();
    },
    [coreMaterial, haloTexture, labelTexture],
  );

  useFrame(({ clock }, delta) => {
    coreMaterial.uniforms.uTime.value = clock.elapsedTime;
    const k = Math.min(1, 2.5 * delta); // the core's energy breathes toward the active world
    const e = energyRef.current;
    (coreMaterial.uniforms.uColorA.value as THREE.Color).lerp(e.a, k);
    (coreMaterial.uniforms.uColorB.value as THREE.Color).lerp(e.b, k);

    // Recede (fade + shrink, never fully vanish) once a planet is focused -
    // the focused planet becomes the center, not Nexys.
    const fadeRate = Math.min(1, 3.2 * delta);
    const opacityTarget = focusedRef.current ? 0.16 : 1;
    const scaleTarget = focusedRef.current ? 0.55 : 1;
    coreMaterial.uniforms.uOpacity.value += (opacityTarget - coreMaterial.uniforms.uOpacity.value) * fadeRate;
    if (groupRef.current) {
      const nextScale = groupRef.current.scale.x + (scaleTarget - groupRef.current.scale.x) * fadeRate;
      groupRef.current.scale.setScalar(nextScale);
    }
    if (labelMatRef.current) {
      labelMatRef.current.opacity += (opacityTarget - labelMatRef.current.opacity) * fadeRate;
    }
    if (haloRef.current) {
      const breathe = 3.1 + Math.sin(clock.elapsedTime * 1.6) * 0.22;
      haloRef.current.scale.setScalar(breathe);
      const haloMat = haloRef.current.material as THREE.SpriteMaterial;
      haloMat.color.lerp(e.halo, k);
      haloMat.opacity += (opacityTarget * 0.85 - haloMat.opacity) * fadeRate;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (isTap(interaction.current)) onCoreTap?.();
  };

  return (
    <group ref={groupRef}>
      <mesh
        material={coreMaterial}
        renderOrder={0}
        onClick={handleClick}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <sphereGeometry args={[0.62, 48, 48]} />
      </mesh>
      <sprite ref={haloRef} renderOrder={1} scale={[3.1, 3.1, 3.1]}>
        <spriteMaterial
          map={haloTexture}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.85}
        />
      </sprite>
      <pointLight intensity={2.2} distance={9} color={MAGENTA} />
      {/*
        renderOrder guarantees the wordmark draws last (on top) regardless
        of automatic depth-sort among transparent siblings - the core and
        halo are both additive-blended, and at only a 0.01 z-epsilon apart
        the sort can flip and let their glow paint over the label, washing
        its brand gradient toward white.
      */}
      <sprite renderOrder={2} scale={[1.2, 1.2 * (LABEL_CANVAS_HEIGHT / LABEL_CANVAS_WIDTH), 1]} position={[0, 0, 0.01]}>
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
/* Rotation rig: drag + inertia + snap-to-nearest-domain               */
/* ------------------------------------------------------------------ */

function RotationRig({
  domains,
  interactive,
  interaction,
  focusedIndexRef,
  onRotate,
  onFocusChange,
  tilt,
  zoom,
  focusMode,
  onSwipeCommit,
  orbitScale,
  children,
}: {
  domains: NexysDomain[];
  interactive: boolean;
  interaction: InteractionRef;
  focusedIndexRef: MutableRefObject<number>;
  onRotate?: (angle: number) => void;
  onFocusChange?: (domain: NexysDomain, index: number) => void;
  tilt: number;
  zoom: number;
  /** True once a planet is already focused - swiping commits to the new planet immediately instead of only offering an ambient preview. */
  focusMode?: boolean;
  onSwipeCommit?: (index: number) => void;
  orbitScale: number;
  children: React.ReactNode;
}) {
  const rigRef = useRef<THREE.Group>(null);
  const tiltRef = useRef<THREE.Group>(null);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const lastFocusRef = useRef(-1);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const focusModeRef = useRef(focusMode);
  focusModeRef.current = focusMode;
  const onSwipeCommitRef = useRef(onSwipeCommit);
  onSwipeCommitRef.current = onSwipeCommit;

  const snapTargets = useMemo(() => domains.map(domainSnapTarget), [domains]);
  // Domain indices in angular order around the ring - "next"/"previous" during
  // a drag means the angular neighbor, not array order (angles are hashed per
  // node identity, not evenly spaced).
  const angularOrder = useMemo(
    () => domains.map((_, i) => i).sort((a, b) => snapTargets[a] - snapTargets[b]),
    [domains, snapTargets],
  );
  const STEP_PX = 70;

  // Set the initial pose directly to the starting domain's target once on
  // mount - no startup sweep from a meaningless [0,0,0].
  useEffect(() => {
    if (rigRef.current) {
      rigRef.current.rotation.y = snapTargets[interaction.current.activeIndex] ?? 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!interactive) return;
    const el = gl.domElement;
    const d = interaction.current;

    const stepActiveIndex = (domainIndex: number, direction: 1 | -1) => {
      const pos = angularOrder.indexOf(domainIndex);
      const nextPos = (pos + direction + angularOrder.length) % angularOrder.length;
      return angularOrder[nextPos];
    };

    const onDown = (e: PointerEvent) => {
      d.active = true;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      d.moved = 0;
      d.dragAccum = 0;
      el.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!d.active) return;
      const dx = e.clientX - d.lastX;
      const dy = e.clientY - d.lastY;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      d.moved += Math.abs(dx) + Math.abs(dy);
      d.tilt = THREE.MathUtils.clamp(d.tilt + dy * 0.003, 0.12, 0.95);

      // Paging, not free scroll: the rig never follows raw drag distance -
      // it only steps to the next/previous planet once the drag crosses a
      // fixed pixel threshold, so it's always settled on a real planet,
      // never a meaningless in-between orientation.
      d.dragAccum += dx;
      while (Math.abs(d.dragAccum) >= STEP_PX) {
        const direction = d.dragAccum > 0 ? 1 : -1;
        d.activeIndex = stepActiveIndex(d.activeIndex, direction);
        d.dragAccum -= direction * STEP_PX;
        // Already zoomed into a planet: a swipe commits to the next one
        // immediately (Hub content follows), rather than only offering an
        // ambient preview the user has to tap to confirm.
        if (focusModeRef.current) onSwipeCommitRef.current?.(d.activeIndex);
      }
    };
    const onUp = (e: PointerEvent) => {
      d.active = false;
      d.dragAccum = 0;
      el.releasePointerCapture?.(e.pointerId);
    };

    el.style.touchAction = "none";
    el.style.cursor = "grab";
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [gl, interactive, interaction, angularOrder]);

  useFrame((_, delta) => {
    const rig = rigRef.current;
    const tiltGroup = tiltRef.current;
    if (!rig) return;
    const d = interaction.current;
    const ry = rig.rotation.y;

    const focusIdx = d.activeIndex;
    focusedIndexRef.current = focusIdx;
    if (focusIdx !== lastFocusRef.current) {
      lastFocusRef.current = focusIdx;
      onFocusChange?.(domains[focusIdx], focusIdx);
    }

    // Always ease toward the active planet's target, whether idle or mid-drag -
    // there is no free-spinning state, only a settled planet or a transition
    // between two settled planets.
    const target = snapTargets[focusIdx];
    rig.rotation.y += wrapAngle(target - ry) * Math.min(1, 6 * delta);

    if (tiltGroup) {
      // The ring's fixed tilt mixes each planet's local Y and Z into world
      // Y - harmless while browsing (nothing needs a consistent framing),
      // but once a planet is focused its local Z varies by domain (a
      // function of that domain's own orbital radius), so the SAME local Y
      // target lands at a different world-Y per domain. Leveling the tilt
      // to zero while focused removes that mixing, so Planet's local-Y
      // centering (see Planet's useFrame) lands every domain in the same
      // framed spot, not just the ones with a forgiving radius.
      const tiltXTarget = focusModeRef.current ? 0 : d.tilt;
      const tiltZTarget = focusModeRef.current ? 0 : -0.08;
      tiltGroup.rotation.x = THREE.MathUtils.lerp(tiltGroup.rotation.x, tiltXTarget, 0.12);
      tiltGroup.rotation.z = THREE.MathUtils.lerp(tiltGroup.rotation.z, tiltZTarget, 0.12);
    }

    // camera dolly for domain-entry zoom (portrait devices sit further back -
    // the floating console covers the bottom third of the viewport there, so
    // portrait needs real extra headroom, not just a touch more than landscape)
    const aspect = size.width / Math.max(1, size.height);
    const baseZ = aspect < 0.8 ? 13.4 : 9.6;
    const focused = zoomRef.current > 1.05;
    // Domains sit on rings of wildly different radii (2.2-6.4). Dollying to
    // a fixed distance-from-origin put wide-orbit domains almost on top of
    // the camera (barely any clearance left once the focused planet swings
    // to the front) while narrow-orbit ones had room to spare. Framing off
    // the focused domain's own radius instead gives every domain the same
    // real clearance, regardless of where it happens to orbit.
    const focusedDomain = domains[focusIdx];
    const clearance = focusClearance(aspect < 0.8);
    const targetZ = focused && focusedDomain
      ? focusedDomain.radius * orbitScale + clearance
      : baseZ / zoomRef.current;
    // The camera's vertical framing is fixed regardless of which domain is
    // focused - Planet centers its own world Y toward wherever this exact
    // camera ray crosses its own depth (see Planet's useFrame), so every
    // domain lands in the same framed spot instead of the camera having to
    // chase each domain's own orbital tilt.
    const targetY = focused ? FOCUS_CAM_Y : aspect < 0.8 ? 1.9 : 1.5;
    camera.position.z += (targetZ - camera.position.z) * Math.min(1, 4.5 * delta);
    camera.position.y += (targetY - camera.position.y) * Math.min(1, 4.5 * delta);
    camera.lookAt(0, focusLookY(aspect < 0.8), 0);

    onRotate?.(rig.rotation.y);
  });

  return (
    <group ref={tiltRef} rotation={[tilt, 0, -0.08]}>
      <group ref={rigRef}>{children}</group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Warp field — star streaks during domain entry                        */
/* ------------------------------------------------------------------ */

const WARP_COUNT = 320;

function WarpField({ active }: { active: boolean }) {
  const lineRef = useRef<THREE.LineSegments>(null);
  const intensity = useRef(0);

  const { geometry, material, stars } = useMemo(() => {
    const positions = new Float32Array(WARP_COUNT * 2 * 3);
    const colors = new Float32Array(WARP_COUNT * 2 * 3);
    const stars = new Array(WARP_COUNT).fill(0).map(() => {
      const r = 0.9 + Math.random() * 5.5;
      const theta = Math.random() * Math.PI * 2;
      return {
        x: Math.cos(theta) * r,
        y: Math.sin(theta) * r * 0.75,
        z: -6 + Math.random() * 20,
        speed: 9 + Math.random() * 16,
      };
    });
    const palette = [new THREE.Color("#ffffff"), new THREE.Color(CYAN), new THREE.Color(PURPLE)];
    for (let i = 0; i < WARP_COUNT; i++) {
      const c = palette[i % palette.length];
      colors[i * 6] = c.r;
      colors[i * 6 + 1] = c.g;
      colors[i * 6 + 2] = c.b;
      // tail fades to black (additive = transparent)
      colors[i * 6 + 3] = c.r * 0.05;
      colors[i * 6 + 4] = c.g * 0.05;
      colors[i * 6 + 5] = c.b * 0.05;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry, material, stars };
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((_, delta) => {
    const target = active ? 1 : 0;
    const rate = active ? 12 : 5; // fast in, smooth out — premium not cinematic
    intensity.current += (target - intensity.current) * Math.min(1, rate * delta);
    const k = intensity.current;
    const line = lineRef.current;
    if (!line) return;
    if (k < 0.02) {
      line.visible = false;
      return;
    }
    line.visible = true;
    material.opacity = k * 0.85;
    const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < WARP_COUNT; i++) {
      const s = stars[i];
      s.z += delta * s.speed * (0.15 + k);
      if (s.z > 14) s.z = -6;
      const len = 0.1 + k * 2.2;
      arr[i * 6] = s.x;
      arr[i * 6 + 1] = s.y;
      arr[i * 6 + 2] = s.z;
      arr[i * 6 + 3] = s.x;
      arr[i * 6 + 4] = s.y;
      arr[i * 6 + 5] = s.z - len;
    }
    pos.needsUpdate = true;
  });

  return <lineSegments ref={lineRef} geometry={geometry} material={material} visible={false} />;
}

/* ------------------------------------------------------------------ */
/* Atmosphere veil — per-domain world tint on entry                     */
/* ------------------------------------------------------------------ */

function AtmosphereVeil({ color }: { color: string | null }) {
  const tex = useMemo(
    () => makeGlowTexture("rgba(255,255,255,0.9)", "rgba(255,255,255,0.35)"),
    [],
  );
  const backRef = useRef<THREE.Sprite>(null);
  const frontRef = useRef<THREE.Sprite>(null);
  const colRef = useRef(new THREE.Color("#ffffff"));

  useEffect(() => {
    if (color) colRef.current.set(color);
  }, [color]);
  useEffect(() => () => tex.dispose(), [tex]);

  useFrame((_, delta) => {
    const target = color ? 1 : 0;
    const refs = [backRef, frontRef];
    const maxOpacity = [0.45, 0.14];
    refs.forEach((r, i) => {
      const m = r.current?.material as THREE.SpriteMaterial | undefined;
      if (!m) return;
      m.opacity += (target * maxOpacity[i] - m.opacity) * Math.min(1, 2.2 * delta);
      m.color.lerp(colRef.current, Math.min(1, 3 * delta));
    });
  });

  return (
    <>
      <sprite ref={backRef} position={[0, 0, -11]} scale={[36, 22, 1]}>
        <spriteMaterial map={tex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite ref={frontRef} position={[0, -1.2, 4.2]} scale={[17, 10, 1]}>
        <spriteMaterial map={tex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </>
  );
}

/**
 * Mounts `children` ~350ms after this component itself first mounts.
 * Used for the scene's purely ambient extras (meteor belt, shooting stars,
 * satellites) - each is another shader/material the GPU has to compile,
 * which is real synchronous cost during the scene's first mount, right on
 * the critical path from login to a usable galaxy. None of them need to be
 * present in the very first frame, so keeping them off that critical path
 * (they fade in a beat later instead) costs nothing visually.
 */
function DeferredAmbience({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 350);
    return () => window.clearTimeout(id);
  }, []);
  return ready ? <>{children}</> : null;
}

/* ------------------------------------------------------------------ */
/* Public scene (for embedding into an existing Canvas)                */
/* ------------------------------------------------------------------ */

export interface NexysCoreSceneProps {
  onRotate?: (angle: number) => void;
  onFocusChange?: (domain: NexysDomain, index: number) => void;
  onDomainSelect?: (domain: NexysDomain, index: number) => void;
  onCoreTap?: () => void;
  domains: NexysDomain[];
  interactive?: boolean;
  particleCount?: number;
  label?: string;
  tilt?: number;
  zoom?: number;
  warp?: boolean;
  atmosphere?: string | null;
  /** True once a planet is already focused (Target/Orbit/Hub, not Home). */
  focusMode?: boolean;
  /** Fires when a swipe commits to a new planet while already focused. */
  onSwipeCommit?: (domain: NexysDomain, index: number) => void;
  /** Fires on a direct tap of the planet that's already focused/centered - distinct from selecting a different one. */
  onFocusedTap?: (domain: NexysDomain, index: number) => void;
  /**
   * The domain id the surrounding page considers focused (route/ZAR/Back-
   * driven, not just a local tap or swipe). The scene's own rotation state
   * only otherwise updates from its own gestures - this keeps it in sync
   * when the route changes some other way (a direct link, ZAR navigation,
   * Back from a workspace), so the right planet is the one that visually
   * centers, not whichever one a stale gesture last touched.
   */
  focusedDomainId?: string | null;
}

export function NexysCoreScene({
  onRotate,
  onFocusChange,
  onDomainSelect,
  onCoreTap,
  domains,
  interactive = true,
  // Was 42000 - on a throttled/mobile-class CPU, building + first-uploading
  // this many points (plus the galaxy/core/planet shader compiles that
  // can't be avoided) measurably delayed the first paint after login, since
  // the whole mount is synchronous main-thread work. Visually the galaxy
  // reads just as full at this density.
  particleCount = 20000,
  label = "ZAR",
  tilt = 0.44,
  zoom = 1,
  warp = false,
  atmosphere = null,
  focusMode = false,
  onSwipeCommit,
  onFocusedTap,
  focusedDomainId = null,
}: NexysCoreSceneProps) {
  // The system always starts facing Workspaces, never wherever a domain
  // happens to hash-land - falls back to the first domain if Workspaces
  // isn't present (defensive; production manifests always include it).
  const initialActiveIndex = Math.max(0, domains.findIndex((d) => d.id === "workspaces"));
  const interaction = useRef<InteractionState>({
    active: false,
    lastX: 0,
    lastY: 0,
    tilt,
    moved: 0,
    dragAccum: 0,
    activeIndex: initialActiveIndex,
  });
  const focusedIndexRef = useRef(initialActiveIndex);
  const size = useThree((s) => s.size);

  // Keep the scene's own rotation focus in sync with whatever the page
  // considers focused, for changes that didn't originate from a tap/swipe
  // right here (a direct link, Back from a workspace, ZAR navigating by
  // itself) - otherwise the visually "centered" planet can silently drift
  // out of sync with the real focused node the Hub is showing.
  useEffect(() => {
    if (!focusedDomainId) return;
    const index = domains.findIndex((d) => d.id === focusedDomainId);
    if (index >= 0 && interaction.current.activeIndex !== index) {
      interaction.current.activeIndex = index;
    }
  }, [focusedDomainId, domains]);
  const aspect = size.width / Math.max(1, size.height);
  const isPortrait = aspect < 0.8;
  // mobile-first: compress orbits + enlarge planets so the system stays in frame
  const orbitScale = isPortrait ? THREE.MathUtils.clamp(aspect * 1.15, 0.52, 1) : 1;
  const sizeScale = isPortrait ? 1.05 : 1;

  const handleSelect = (domain: NexysDomain, index: number) => {
    // Tapping the planet that's already front-and-center (while already
    // zoomed in) means "go in", not "re-select the same thing" - the Hub's
    // own action row remains how you choose among ambiguous options.
    if (focusMode && focusedIndexRef.current === index) {
      onFocusedTap?.(domain, index);
      return;
    }
    interaction.current.activeIndex = index;
    onDomainSelect?.(domain, index);
  };

  return (
    <>
      <Universe starCount={Math.max(600, Math.floor(particleCount * 0.05))} />
      <DeferredAmbience>
        <MeteorBelt />
        <ShootingStars />
        <Satellites />
      </DeferredAmbience>
      <WarpField active={warp} />
      <AtmosphereVeil color={atmosphere} />
      <RotationRig
        domains={domains}
        interactive={interactive}
        interaction={interaction}
        focusedIndexRef={focusedIndexRef}
        onRotate={onRotate}
        onFocusChange={onFocusChange}
        tilt={tilt}
        zoom={zoom}
        focusMode={focusMode}
        onSwipeCommit={(index) => onSwipeCommit?.(domains[index], index)}
        orbitScale={orbitScale}
      >
        <GalaxyField count={particleCount} focused={focusMode} />
        {domains.map((d, i) => (
          <Planet
            key={d.id}
            domain={d}
            index={i}
            interaction={interaction}
            focusedIndexRef={focusedIndexRef}
            onSelect={handleSelect}
            orbitScale={orbitScale}
            sizeScale={sizeScale}
            focusMode={focusMode}
          />
        ))}
        <CoreOrb label={label} interaction={interaction} onCoreTap={onCoreTap} energyColor={atmosphere} focused={focusMode} />
      </RotationRig>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Default export: self-contained component with its own Canvas        */
/* ------------------------------------------------------------------ */

export interface NexysCoreProps extends NexysCoreSceneProps {
  width?: number | string;
  height?: number | string;
  transparent?: boolean;
  background?: string;
  className?: string;
  style?: CSSProperties;
}

export default function NexysCore({
  width = "100%",
  height = "100%",
  transparent = true,
  background,
  className,
  style,
  ...sceneProps
}: NexysCoreProps) {
  return (
    <div
      data-testid="nexys-core-canvas"
      className={className}
      style={{ width, height, background: transparent ? background ?? "transparent" : background, ...style }}
    >
      <Canvas
        dpr={[1, 2]}
        gl={{ alpha: transparent, antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 1.4, 8.8], fov: 45, near: 0.1, far: 80 }}
        style={{ background: "transparent" }}
      >
        <NexysCoreScene {...sceneProps} />
      </Canvas>
    </div>
  );
}
