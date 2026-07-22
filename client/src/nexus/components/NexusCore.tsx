/**
 * NexusCore — self-contained 3D cosmic core component.
 *
 * Default export renders its own R3F <Canvas> (transparent, fills container).
 * Named export <NexusCoreScene /> can be dropped into an existing Canvas.
 *
 * Usage:
 *   <NexusCore onRotate={(angle) => ...} />
 */
import {
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type MutableRefObject,
} from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";

/* ------------------------------------------------------------------ */
/* Palette                                                             */
/* ------------------------------------------------------------------ */

const CYAN = "#22d3ee";
const PURPLE = "#a855f7";
const MAGENTA = "#ff3ec8";
const CORE_HOT = "#ffe9fb";

const LINE_COLORS = [CYAN, PURPLE, MAGENTA, "#6ea8ff", MAGENTA, CYAN, PURPLE, "#6ea8ff"];

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

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
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

function buildStardustGeometry(count: number, spread: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const rands = new Float32Array(count);
  const palette = [new THREE.Color(CYAN), new THREE.Color(PURPLE), new THREE.Color("#ffffff")];

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const dir = new THREE.Vector3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
    ).normalize();
    const r = 1.5 + Math.pow(Math.random(), 0.5) * spread;
    positions[i3] = dir.x * r;
    positions[i3 + 1] = dir.y * r * 0.7;
    positions[i3 + 2] = dir.z * r;
    const c = palette[Math.floor(Math.random() * palette.length)];
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
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function GalaxyField({ count }: { count: number }) {
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
  const dustGeometry = useMemo(() => buildStardustGeometry(Math.floor(count * 0.05), 5.5), [count]);
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

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    dustMaterial.uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <>
      <points geometry={geometry} material={material} />
      <points geometry={dustGeometry} material={dustMaterial} />
    </>
  );
}

function RadialLines({ count, innerRadius, outerRadius }: {
  count: number;
  innerRadius: number;
  outerRadius: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const nodeTexture = useMemo(() => makeGlowTexture("rgba(255,255,255,1)", "rgba(120,220,255,0.55)"), []);

  const lines = useMemo(() => {
    const segments = 24;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      const color = new THREE.Color(LINE_COLORS[i % LINE_COLORS.length]);
      const positions = new Float32Array((segments + 1) * 3);
      const colors = new Float32Array((segments + 1) * 3);
      for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        const r = innerRadius + (outerRadius - innerRadius) * t;
        positions[s * 3] = Math.cos(angle) * r;
        positions[s * 3 + 1] = Math.sin(t * Math.PI) * 0.12;
        positions[s * 3 + 2] = Math.sin(angle) * r;
        const fade = 0.85 - t * 0.45;
        colors[s * 3] = color.r * fade;
        colors[s * 3 + 1] = color.g * fade;
        colors[s * 3 + 2] = color.b * fade;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const end = new THREE.Vector3(
        Math.cos(angle) * outerRadius,
        0,
        Math.sin(angle) * outerRadius,
      );
      const midDots = [0.3, 0.55, 0.8].map((t) =>
        new THREE.Vector3(
          Math.cos(angle) * (innerRadius + (outerRadius - innerRadius) * t),
          Math.sin(t * Math.PI) * 0.12,
          Math.sin(angle) * (innerRadius + (outerRadius - innerRadius) * t),
        ),
      );
      const object = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({
          vertexColors: true,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      return { geo, color, end, midDots, object, phase: i * 0.7 };
    });
  }, [count, innerRadius, outerRadius]);

  useEffect(
    () => () => {
      lines.forEach((l) => {
        l.geo.dispose();
        (l.object.material as THREE.Material).dispose();
      });
      nodeTexture.dispose();
    },
    [lines, nodeTexture],
  );

  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.children.forEach((child, idx) => {
      const line = lines[Math.floor(idx / 2)];
      if (!line) return;
      const pulse = 0.6 + 0.4 * Math.sin(t * 1.8 + line.phase);
      if (child instanceof THREE.Line) {
        (child.material as THREE.LineBasicMaterial).opacity = 0.28 + pulse * 0.35;
      } else if (child instanceof THREE.Group) {
        const node = child.children[0];
        if (node) node.scale.setScalar(0.5 + pulse * 0.28);
      }
    });
  });

  return (
    <group ref={groupRef}>
      {lines.flatMap((line, i) => [
        <primitive key={`line-${i}`} object={line.object} />,
        <group key={`node-${i}`} position={line.end.toArray() as [number, number, number]}>
          <sprite scale={[0.6, 0.6, 0.6]}>
            <spriteMaterial
              map={nodeTexture}
              color={line.color}
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
          {line.midDots.map((p, j) => (
            <sprite
              key={j}
              position={p.clone().sub(line.end).toArray() as [number, number, number]}
              scale={[0.16, 0.16, 0.16]}
            >
              <spriteMaterial
                map={nodeTexture}
                color={line.color}
                transparent
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </sprite>
          ))}
        </group>,
      ])}
    </group>
  );
}

function CoreOrb({ label }: { label: string }) {
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
  const haloRef = useRef<THREE.Sprite>(null);

  useEffect(
    () => () => {
      coreMaterial.dispose();
      haloTexture.dispose();
    },
    [coreMaterial, haloTexture],
  );

  useFrame(({ clock }) => {
    coreMaterial.uniforms.uTime.value = clock.elapsedTime;
    if (haloRef.current) {
      const s = 3.1 + Math.sin(clock.elapsedTime * 1.6) * 0.22;
      haloRef.current.scale.setScalar(s);
    }
  });

  return (
    <group>
      <mesh material={coreMaterial}>
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
      <Billboard>
        <Text
          fontSize={0.34}
          letterSpacing={0.32}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.012}
          outlineColor={PURPLE}
          outlineBlur={0.09}
        >
          {label}
          <meshBasicMaterial color="#ffffff" toneMapped={false} transparent depthWrite={false} />
        </Text>
      </Billboard>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Rotation rig: auto-rotate + drag with inertia                       */
/* ------------------------------------------------------------------ */

interface RotationRigProps {
  autoRotateSpeed: number;
  interactive: boolean;
  onRotate?: (angle: number) => void;
  tilt: number;
  children: React.ReactNode;
}

function RotationRig({ autoRotateSpeed, interactive, onRotate, tilt, children }: RotationRigProps) {
  const rigRef = useRef<THREE.Group>(null);
  const tiltRef = useRef<THREE.Group>(null);
  const gl = useThree((s) => s.gl);

  const drag: MutableRefObject<{
    active: boolean;
    lastX: number;
    lastY: number;
    velocity: number;
    tilt: number;
  }> = useRef({ active: false, lastX: 0, lastY: 0, velocity: 0, tilt });

  useEffect(() => {
    if (!interactive) return;
    const el = gl.domElement;
    const d = drag.current;

    const onDown = (e: PointerEvent) => {
      d.active = true;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
      d.velocity = 0;
      el.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!d.active || !rigRef.current) return;
      const dx = e.clientX - d.lastX;
      const dy = e.clientY - d.lastY;
      d.lastX = e.clientX;
      d.lastY = e.clientY;
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
  }, [gl, interactive]);

  useFrame((_, delta) => {
    const rig = rigRef.current;
    const tiltGroup = tiltRef.current;
    if (!rig) return;
    const d = drag.current;

    if (!d.active) {
      rig.rotation.y += d.velocity + autoRotateSpeed * delta;
      d.velocity *= Math.pow(0.06, delta); // frame-rate independent decay
      if (Math.abs(d.velocity) < 0.00005) d.velocity = 0;
    }
    if (tiltGroup) {
      tiltGroup.rotation.x = THREE.MathUtils.lerp(tiltGroup.rotation.x, d.tilt, 0.12);
    }
    onRotate?.(rig.rotation.y);
  });

  return (
    <group ref={tiltRef} rotation={[tilt, 0, -0.08]}>
      <group ref={rigRef}>{children}</group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Public scene (for embedding into an existing Canvas)                */
/* ------------------------------------------------------------------ */

export interface NexusCoreSceneProps {
  onRotate?: (angle: number) => void;
  autoRotateSpeed?: number;
  interactive?: boolean;
  particleCount?: number;
  lineCount?: number;
  label?: string;
  tilt?: number;
}

export function NexusCoreScene({
  onRotate,
  autoRotateSpeed = 0.12,
  interactive = true,
  particleCount = 42000,
  lineCount = 8,
  label = "NEXUS",
  tilt = 0.5,
}: NexusCoreSceneProps) {
  return (
    <RotationRig
      autoRotateSpeed={autoRotateSpeed}
      interactive={interactive}
      onRotate={onRotate}
      tilt={tilt}
    >
      <GalaxyField count={particleCount} />
      <RadialLines count={lineCount} innerRadius={1.15} outerRadius={4.7} />
      <CoreOrb label={label} />
    </RotationRig>
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
        camera={{ position: [0, 1.4, 7.4], fov: 45, near: 0.1, far: 60 }}
        style={{ background: "transparent" }}
      >
        <NexusCoreScene {...sceneProps} />
      </Canvas>
    </div>
  );
}
