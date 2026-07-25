/**
 * NexusCore V2 — living celestial navigation system.
 *
 * Default export renders its own R3F <Canvas> (transparent, fills container).
 * Named export <NexusCoreScene /> can be dropped into an existing Canvas.
 *
 * V2: domains are planets (unique scale/color/orbit/inclination), no graph
 * lines, snap-to-nearest-domain on release, expanded universe (distant stars,
 * nebulae, dust), NEXUS core tap = home, planet tap = domain select.
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
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as THREE from "three";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  BookOpen,
  Brain,
  Fingerprint,
  FolderOpen,
  LayoutGrid,
  Plug,
  Settings as SettingsIcon,
  Wrench,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Palette & domains                                                    */
/* ------------------------------------------------------------------ */

const CYAN = "#22d3ee";
const PURPLE = "#a855f7";
const MAGENTA = "#ff3ec8";
const CORE_HOT = "#ffe9fb";

export interface NexusDomain {
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

// chakra-aligned domain identities (rings are earned through usage)
export const DEFAULT_DOMAINS: NexusDomain[] = [
  { id: "identity", label: "IDENTITY", color: "#e8ecf4", size: 0.22, radius: 2.65, inclination: 0.19, angle: 0.42, icon: Fingerprint },
  { id: "memory", label: "MEMORY", color: "#8b5cf6", size: 0.31, radius: 3.45, inclination: -0.13, angle: 1.28, icon: Brain },
  { id: "knowledge", label: "KNOWLEDGE", color: "#22d3ee", size: 0.26, radius: 4.35, inclination: 0.09, angle: 2.02, icon: BookOpen },
  { id: "projects", label: "PROJECTS", color: "#eab308", size: 0.18, radius: 2.95, inclination: -0.23, angle: 2.88, icon: FolderOpen },
  { id: "workspaces", label: "WORKSPACES", color: "#34d399", size: 0.24, radius: 3.85, inclination: 0.16, angle: 3.52, moon: true, icon: LayoutGrid },
  { id: "connect", label: "CONNECT", color: "#fb923c", size: 0.28, radius: 4.62, inclination: -0.08, angle: 4.46, icon: Plug },
  { id: "tools", label: "TOOLS", color: "#ef4444", size: 0.16, radius: 2.32, inclination: 0.26, angle: 5.02, moon: true, icon: Wrench },
  { id: "settings", label: "SETTINGS", color: "#6366f1", size: 0.2, radius: 3.15, inclination: -0.19, angle: 5.86, icon: SettingsIcon },
];

const wrapAngle = (x: number) => Math.atan2(Math.sin(x), Math.cos(x));

function domainPosition(d: NexusDomain): THREE.Vector3 {
  return new THREE.Vector3(
    Math.cos(d.angle) * d.radius,
    Math.sin(d.angle) * Math.sin(d.inclination) * d.radius,
    Math.sin(d.angle) * Math.cos(d.inclination) * d.radius,
  );
}

function domainSnapTarget(d: NexusDomain): number {
  const az = Math.atan2(Math.sin(d.angle) * Math.cos(d.inclination), Math.cos(d.angle));
  // settle the focused planet front-right of the core, not dead-center at the camera
  return wrapAngle(Math.PI / 2 - 0.85 - az);
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
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    float strength = pow(1.0 - clamp(d * 2.0, 0.0, 1.0), 3.0);
    if (strength < 0.001) discard;
    gl_FragColor = vec4(vColor, strength * vAlpha);
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
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float fresnel = pow(1.0 - abs(dot(vNormal, vView)), 2.2);
    float pulse = 0.75 + 0.25 * sin(uTime * 1.6);
    vec3 col = mix(uColorA, uColorB, fresnel);
    gl_FragColor = vec4(col, (0.18 + fresnel * 0.9) * pulse);
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
    gl_FragColor = vec4(col, 1.0);
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
function makeLabelTexture(text: string, color: string): THREE.CanvasTexture {
  const width = 512;
  const height = 128;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "700 52px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#1b0b33";
  ctx.shadowBlur = 14;
  ctx.fillStyle = color;
  const spaced = text.split("").join(" ");
  ctx.fillText(spaced, width / 2, height / 2);
  const texture = new THREE.CanvasTexture(canvas);
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
    uniforms: { uTime: { value: 0 }, uSize: { value: size } },
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
  velocity: number;
  tilt: number;
  moved: number;
  overrideIndex: number | null;
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

function GalaxyField({ count }: { count: number }) {
  const spinRef = useRef<THREE.Group>(null);
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
  });

  return (
    <group ref={spinRef}>
      <points geometry={geometry} material={material} />
      <points geometry={dustGeometry} material={dustMaterial} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Domain icon rendered onto the planet face                            */
/* ------------------------------------------------------------------ */

function IconSprite({ domain }: { domain: NexusDomain }) {
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

function Planet({
  domain,
  index,
  interaction,
  focusedIndexRef,
  onSelect,
  orbitScale,
  sizeScale,
}: {
  domain: NexusDomain;
  index: number;
  interaction: InteractionRef;
  focusedIndexRef: MutableRefObject<number>;
  onSelect: (domain: NexusDomain, index: number) => void;
  orbitScale: number;
  sizeScale: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const moonRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Sprite>(null);
  const position = useMemo(
    () => domainPosition(domain).multiplyScalar(orbitScale),
    [domain, orbitScale],
  );

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: planetVertex,
        fragmentShader: planetFragment,
        uniforms: {
          uColor: { value: new THREE.Color(domain.color) },
          uTime: { value: 0 },
          uFocus: { value: 0 },
        },
      }),
    [domain.color],
  );
  const glowTexture = useMemo(
    () => makeGlowTexture("rgba(255,255,255,0.9)", `${domain.color}66`),
    [domain.color],
  );

  useEffect(
    () => () => {
      material.dispose();
      glowTexture.dispose();
    },
    [material, glowTexture],
  );

  useFrame(({ clock }, delta) => {
    const g = groupRef.current;
    if (!g) return;
    const t = clock.elapsedTime;
    material.uniforms.uTime.value = t;

    const focused = focusedIndexRef.current === index;
    const target = focused ? 1 : 0;
    material.uniforms.uFocus.value +=
      (target - material.uniforms.uFocus.value) * Math.min(1, 5 * delta);

    const scale = sizeScale * (1 + material.uniforms.uFocus.value * 0.22);
    g.scale.setScalar(scale);
    g.position.y = position.y + Math.sin(t * 0.5 + index * 1.7) * 0.06;
    g.rotation.y += delta * (0.15 + index * 0.02);

    if (glowRef.current) {
      const m = glowRef.current.material as THREE.SpriteMaterial;
      m.opacity = 0.4 + material.uniforms.uFocus.value * 0.3 + Math.sin(t * 1.4 + index) * 0.05;
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
      <mesh material={material}>
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
/* NEXUS core (the star / home anchor)                                  */
/* ------------------------------------------------------------------ */

function CoreOrb({
  label,
  interaction,
  onCoreTap,
  energyColor,
}: {
  label: string;
  interaction: InteractionRef;
  onCoreTap?: () => void;
  energyColor?: string | null;
}) {
  const coreMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: coreVertex,
        fragmentShader: coreFragment,
        uniforms: {
          uTime: { value: 0 },
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
  const labelTexture = useMemo(() => makeLabelTexture(label, "#ffffff"), [label]);
  const haloRef = useRef<THREE.Sprite>(null);
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
    if (haloRef.current) {
      const s = 3.1 + Math.sin(clock.elapsedTime * 1.6) * 0.22;
      haloRef.current.scale.setScalar(s);
      (haloRef.current.material as THREE.SpriteMaterial).color.lerp(e.halo, k);
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (isTap(interaction.current)) onCoreTap?.();
  };

  return (
    <group>
      <mesh
        material={coreMaterial}
        onClick={handleClick}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <sphereGeometry args={[0.62, 48, 48]} />
      </mesh>
      <sprite ref={haloRef} scale={[3.1, 3.1, 3.1]}>
        <spriteMaterial
          map={haloTexture}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.85}
        />
      </sprite>
      <pointLight intensity={2.2} distance={9} color={MAGENTA} />
      <sprite scale={[1.7, 0.42, 1]} position={[0, 0, 0.01]}>
        <spriteMaterial map={labelTexture} transparent depthWrite={false} />
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
  children,
}: {
  domains: NexusDomain[];
  interactive: boolean;
  interaction: InteractionRef;
  focusedIndexRef: MutableRefObject<number>;
  onRotate?: (angle: number) => void;
  onFocusChange?: (domain: NexusDomain, index: number) => void;
  tilt: number;
  zoom: number;
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

  const snapTargets = useMemo(() => domains.map(domainSnapTarget), [domains]);

  useEffect(() => {
    if (!interactive) return;
    const el = gl.domElement;
    const d = interaction.current;

    const onDown = (e: PointerEvent) => {
      d.active = true;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      d.velocity = 0;
      d.moved = 0;
      d.overrideIndex = null;
      el.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!d.active || !rigRef.current) return;
      const dx = e.clientX - d.lastX;
      const dy = e.clientY - d.lastY;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      d.moved += Math.abs(dx) + Math.abs(dy);
      rigRef.current.rotation.y += dx * 0.0055;
      d.velocity = dx * 0.0055;
      d.tilt = THREE.MathUtils.clamp(d.tilt + dy * 0.003, 0.12, 0.95);
    };
    const onUp = (e: PointerEvent) => {
      d.active = false;
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
  }, [gl, interactive, interaction]);

  useFrame((_, delta) => {
    const rig = rigRef.current;
    const tiltGroup = tiltRef.current;
    if (!rig) return;
    const d = interaction.current;
    const ry = rig.rotation.y;

    // nearest domain by current orientation
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < snapTargets.length; i++) {
      const dist = Math.abs(wrapAngle(ry - snapTargets[i]));
      if (dist < best) {
        best = dist;
        nearest = i;
      }
    }

    const focusIdx = d.overrideIndex ?? nearest;
    focusedIndexRef.current = focusIdx;
    if (focusIdx !== lastFocusRef.current) {
      lastFocusRef.current = focusIdx;
      onFocusChange?.(domains[focusIdx], focusIdx);
    }

    if (!d.active) {
      if (Math.abs(d.velocity) > 0.004) {
        rig.rotation.y += d.velocity;
        d.velocity *= Math.pow(0.05, delta);
      } else {
        d.velocity = 0;
        // ease to the focused domain — no meaningless orientations
        const target = snapTargets[focusIdx];
        rig.rotation.y += wrapAngle(target - ry) * Math.min(1, 5.5 * delta);
      }
    }

    if (tiltGroup) {
      tiltGroup.rotation.x = THREE.MathUtils.lerp(tiltGroup.rotation.x, d.tilt, 0.12);
    }

    // camera dolly for domain-entry zoom (portrait devices sit further back)
    const aspect = size.width / Math.max(1, size.height);
    const baseZ = aspect < 0.8 ? 10.6 : 8.8;
    const targetZ = baseZ / zoomRef.current;
    const targetY = zoomRef.current > 1.05 ? 0.6 : 1.4;
    camera.position.z += (targetZ - camera.position.z) * Math.min(1, 4.5 * delta);
    camera.position.y += (targetY - camera.position.y) * Math.min(1, 4.5 * delta);
    // portrait: lift the system above the command console
    camera.lookAt(0, aspect < 0.8 ? -1.05 : -0.3, 0);

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

/* ------------------------------------------------------------------ */
/* Public scene (for embedding into an existing Canvas)                */
/* ------------------------------------------------------------------ */

export interface NexusCoreSceneProps {
  onRotate?: (angle: number) => void;
  onFocusChange?: (domain: NexusDomain, index: number) => void;
  onDomainSelect?: (domain: NexusDomain, index: number) => void;
  onCoreTap?: () => void;
  domains?: NexusDomain[];
  interactive?: boolean;
  particleCount?: number;
  label?: string;
  tilt?: number;
  zoom?: number;
  warp?: boolean;
  atmosphere?: string | null;
}

export function NexusCoreScene({
  onRotate,
  onFocusChange,
  onDomainSelect,
  onCoreTap,
  domains = DEFAULT_DOMAINS,
  interactive = true,
  particleCount = 42000,
  label = "NEXUS",
  tilt = 0.44,
  zoom = 1,
  warp = false,
  atmosphere = null,
}: NexusCoreSceneProps) {
  const interaction = useRef<InteractionState>({
    active: false,
    lastX: 0,
    lastY: 0,
    velocity: 0,
    tilt,
    moved: 0,
    overrideIndex: null,
  });
  const focusedIndexRef = useRef(0);
  const size = useThree((s) => s.size);
  const aspect = size.width / Math.max(1, size.height);
  const isPortrait = aspect < 0.8;
  // mobile-first: compress orbits + enlarge planets so the system stays in frame
  const orbitScale = isPortrait ? THREE.MathUtils.clamp(aspect * 1.15, 0.52, 1) : 1;
  const sizeScale = isPortrait ? 1.05 : 1;

  const handleSelect = (domain: NexusDomain, index: number) => {
    interaction.current.overrideIndex = index;
    interaction.current.velocity = 0;
    onDomainSelect?.(domain, index);
  };

  return (
    <>
      <Universe starCount={Math.max(600, Math.floor(particleCount * 0.05))} />
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
      >
        <GalaxyField count={particleCount} />
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
          />
        ))}
        <CoreOrb label={label} interaction={interaction} onCoreTap={onCoreTap} energyColor={atmosphere} />
      </RotationRig>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Default export: self-contained component with its own Canvas        */
/* ------------------------------------------------------------------ */

export interface NexusCoreProps extends NexusCoreSceneProps {
  width?: number | string;
  height?: number | string;
  transparent?: boolean;
  background?: string;
  className?: string;
  style?: CSSProperties;
}

export default function NexusCore({
  width = "100%",
  height = "100%",
  transparent = true,
  background,
  className,
  style,
  ...sceneProps
}: NexusCoreProps) {
  return (
    <div
      data-testid="nexus-core-canvas"
      className={className}
      style={{ width, height, background: transparent ? background ?? "transparent" : background, ...style }}
    >
      <Canvas
        dpr={[1, 2]}
        gl={{ alpha: transparent, antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 1.4, 8.8], fov: 45, near: 0.1, far: 80 }}
        style={{ background: "transparent" }}
      >
        <NexusCoreScene {...sceneProps} />
      </Canvas>
    </div>
  );
}
