import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import type { NexusDriftState, NexusSceneNode } from "./nexusSceneContract";

interface NexusSceneProps {
  readonly nodes: readonly NexusSceneNode[];
  readonly drift: React.MutableRefObject<NexusDriftState>;
  readonly reducedMotion: boolean;
}

export default function NexusScene({ nodes, drift, reducedMotion }: NexusSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
      camera={{ position: [0, 0, 8], fov: 40 }}
      frameloop={reducedMotion ? "demand" : "always"}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      aria-hidden="true"
    >
      <SceneInner nodes={nodes} drift={drift} reducedMotion={reducedMotion} />
    </Canvas>
  );
}

function SceneInner({ nodes, drift, reducedMotion }: NexusSceneProps) {
  const { viewport, size } = useThree();
  const worldPerPx = viewport.width / size.width;
  const toWorld = (xPct: number, yPct: number): [number, number] => [
    (xPct / 100 - 0.5) * viewport.width,
    -(yPct / 100 - 0.5) * viewport.height,
  ];

  const glowTex = useDisposableTexture(() => makeRadialTexture(1));
  const softTex = useDisposableTexture(() => makeRadialTexture(0.45));

  return (
    <>
      <Starfield count={340} zRange={[-6, -3]} sizePx={1.4} opacity={0.55} parallax={0.05} sway={0.02} texture={softTex} palette={["#ffffff", "#bae6fd", "#ddd6fe"]} drift={drift} reducedMotion={reducedMotion} />
      <Starfield count={130} zRange={[-3, -1.2]} sizePx={2.4} opacity={0.75} parallax={0.14} sway={0.045} texture={softTex} palette={["#ffffff", "#7dd3fc", "#f0abfc", "#c4b5fd"]} drift={drift} reducedMotion={reducedMotion} />
      <Nebula drift={drift} reducedMotion={reducedMotion} />
      <EnvironmentFilaments />
      <GraphSystem nodes={nodes} toWorld={toWorld} worldPerPx={worldPerPx} glowTex={glowTex} softTex={softTex} drift={drift} reducedMotion={reducedMotion} />
      <Starfield count={26} zRange={[1, 2.2]} sizePx={3.4} opacity={0.5} parallax={0.4} sway={0.09} texture={softTex} palette={["#e0f2fe", "#fbcfe8", "#ffffff"]} drift={drift} reducedMotion={reducedMotion} />
    </>
  );
}

/* ------------------------------------------------------------------ */

function Starfield({
  count, zRange, sizePx, opacity, parallax, sway, texture, palette, drift, reducedMotion,
}: {
  readonly count: number;
  readonly zRange: readonly [number, number];
  readonly sizePx: number;
  readonly opacity: number;
  readonly parallax: number;
  readonly sway: number;
  readonly texture: THREE.Texture;
  readonly palette: readonly string[];
  readonly drift: React.MutableRefObject<NexusDriftState>;
  readonly reducedMotion: boolean;
}) {
  const { viewport, size } = useThree();
  const group = useRef<THREE.Group>(null);
  const material = useRef<THREE.PointsMaterial>(null);
  const seed = useMemo(() => Math.random() * 100, []);

  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i += 1) {
      pos[i * 3] = (Math.random() - 0.5) * viewport.width * 1.5;
      pos[i * 3 + 1] = (Math.random() - 0.5) * viewport.height * 1.5;
      pos[i * 3 + 2] = zRange[0] + Math.random() * (zRange[1] - zRange[0]);
      c.set(palette[Math.floor(Math.random() * palette.length)]);
      const dim = 0.35 + Math.random() * 0.65;
      col[i * 3] = c.r * dim;
      col[i * 3 + 1] = c.g * dim;
      col[i * 3 + 2] = c.b * dim;
    }
    return { positions: pos, colors: col };
    // Regenerate only when the field itself changes shape, not on resize jitter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, zRange[0], zRange[1]]);

  useFrame(({ clock }) => {
    if (document.hidden) return;
    const g = group.current;
    if (!g) return;
    const d = drift.current;
    const t = clock.elapsedTime + seed;
    const worldPerPx = viewport.width / size.width;
    g.position.x = d.px * parallax * 12 * worldPerPx + (reducedMotion ? 0 : Math.sin(t * 0.05) * sway);
    g.position.y = -d.py * parallax * 12 * worldPerPx + (reducedMotion ? 0 : Math.cos(t * 0.04) * sway);
    if (!reducedMotion && material.current) {
      material.current.opacity = opacity * (0.86 + 0.14 * Math.sin(t * 0.6));
    }
  });

  return (
    <group ref={group}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={material}
          map={texture}
          vertexColors
          transparent
          opacity={opacity}
          size={(sizePx * viewport.width) / size.width}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

function Nebula({ drift, reducedMotion }: { readonly drift: React.MutableRefObject<NexusDriftState>; readonly reducedMotion: boolean }) {
  const { viewport } = useThree();
  const group = useRef<THREE.Group>(null);
  const volumes = useMemo(() => [
    { hue: "#312e81", x: -0.34, y: 0.3, z: -4.5, s: 6.5, o: 0.16 },
    { hue: "#6d28d9", x: 0.3, y: 0.16, z: -3.6, s: 5, o: 0.13 },
    { hue: "#0e7490", x: -0.12, y: -0.3, z: -4.2, s: 5.5, o: 0.11 },
    { hue: "#a21caf", x: 0.36, y: -0.2, z: -3, s: 4, o: 0.1 },
    { hue: "#9a3412", x: 0.05, y: 0.42, z: -5, s: 3.4, o: 0.06 },
  ], []);
  const textures = useMemo(() => volumes.map((v) => makeRadialTexture(0.28, v.hue)), [volumes]);
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);

  useFrame(({ clock }) => {
    if (document.hidden || reducedMotion) return;
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.children.forEach((child, i) => {
      child.rotation.z = t * 0.004 * (i % 2 === 0 ? 1 : -1);
      const pulse = 1 + 0.03 * Math.sin(t * 0.05 + i * 1.7);
      child.scale.setScalar(volumes[i].s * pulse);
    });
    g.position.x = drift.current.px * 0.03;
    g.position.y = -drift.current.py * 0.03;
  });

  return (
    <group ref={group}>
      {volumes.map((v, i) => (
        <sprite key={v.hue + String(i)} position={[v.x * viewport.width, v.y * viewport.height, v.z]} scale={v.s}>
          <spriteMaterial map={textures[i]} transparent opacity={v.o} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      ))}
    </group>
  );
}

function EnvironmentFilaments() {
  const object = useMemo(() => {
    const g = new THREE.Group();
    const mat = new THREE.LineBasicMaterial({ color: "#7dd3fc", transparent: true, opacity: 0.05, depthWrite: false });
    const mat2 = new THREE.LineBasicMaterial({ color: "#e879f9", transparent: true, opacity: 0.04, depthWrite: false });
    const specs = [
      { from: [-4.4, 2.6, -2.5], ctrl: [-2, 3.4, -3], to: [1.6, 4, -3.5], m: mat },
      { from: [3.6, -3.4, -2], ctrl: [4.6, -1, -3], to: [4.2, 2.4, -3.5], m: mat2 },
      { from: [-4.6, -2.2, -3], ctrl: [-3.2, -3.6, -2.5], to: [0.4, -4.4, -3], m: mat },
    ] as const;
    for (const s of specs) {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(...s.from), new THREE.Vector3(...s.ctrl), new THREE.Vector3(...s.to),
      );
      const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(24));
      g.add(new THREE.Line(geo, s.m));
    }
    return g;
  }, []);
  useEffect(() => () => {
    object.children.forEach((c) => (c as THREE.Line).geometry.dispose());
  }, [object]);
  return <primitive object={object} />;
}

/* ------------------------------------------------------------------ */

function GraphSystem({
  nodes, toWorld, worldPerPx, glowTex, softTex, drift, reducedMotion,
}: {
  readonly nodes: readonly NexusSceneNode[];
  readonly toWorld: (x: number, y: number) => [number, number];
  readonly worldPerPx: number;
  readonly glowTex: THREE.Texture;
  readonly softTex: THREE.Texture;
  readonly drift: React.MutableRefObject<NexusDriftState>;
  readonly reducedMotion: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const coreGroup = useRef<THREE.Group>(null);
  const coreGlow = useRef<THREE.Sprite>(null);

  const anchors = useMemo(
    () => nodes.map((node) => {
      const [x, y] = toWorld(node.x, node.y);
      return { ...node, wx: x, wy: y, wz: (hashUnit(node.id) - 0.5) * 0.5 };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, worldPerPx],
  );

  const curves = useMemo(() => {
    const list: { curve: THREE.QuadraticBezierCurve3; color: string; active: boolean }[] = [];
    for (const a of anchors) {
      const mid = new THREE.Vector3(a.wx * 0.5, a.wy * 0.5, 0.3 + (hashUnit(a.id) - 0.5) * 0.4);
      mid.x += -a.wy * 0.08;
      mid.y += a.wx * 0.08;
      list.push({
        curve: new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), mid, new THREE.Vector3(a.wx, a.wy, a.wz)),
        color: a.color,
        active: a.focused,
      });
    }
    for (let i = 0; i < anchors.length; i += 1) {
      const a = anchors[i];
      const b = anchors[(i + 1) % anchors.length];
      const mid = new THREE.Vector3((a.wx + b.wx) * 0.55, (a.wy + b.wy) * 0.55, -0.2);
      list.push({
        curve: new THREE.QuadraticBezierCurve3(new THREE.Vector3(a.wx, a.wy, a.wz), mid, new THREE.Vector3(b.wx, b.wy, b.wz)),
        color: a.color,
        active: a.focused || b.focused,
      });
    }
    return list;
  }, [anchors]);

  const linksObject = useMemo(() => {
    const g = new THREE.Group();
    for (const link of curves) {
      const geometry = new THREE.BufferGeometry().setFromPoints(link.curve.getPoints(18));
      const material = new THREE.LineBasicMaterial({
        color: link.active ? link.color : "#94a3b8",
        transparent: true,
        opacity: link.active ? 0.4 : 0.1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      g.add(new THREE.Line(geometry, material));
    }
    return g;
  }, [curves]);
  useEffect(() => () => {
    linksObject.children.forEach((c) => {
      (c as THREE.Line).geometry.dispose();
      ((c as THREE.Line).material as THREE.Material).dispose();
    });
  }, [linksObject]);

  const core = useMemo(() => makeCoreCluster(720), []);
  const pulses = usePulses(curves, reducedMotion);

  useFrame(({ clock }) => {
    if (document.hidden) return;
    const t = clock.elapsedTime;
    const d = drift.current;
    if (group.current) {
      group.current.position.x = d.x * worldPerPx + d.px * 0.35 * 12 * worldPerPx;
      group.current.position.y = -d.y * worldPerPx - d.py * 0.35 * 12 * worldPerPx;
    }
    if (reducedMotion) return;
    if (coreGroup.current) {
      coreGroup.current.rotation.z = t * 0.015;
      const breathe = 1 + 0.025 * Math.sin(t * 0.7);
      coreGroup.current.scale.setScalar(breathe);
    }
    if (coreGlow.current) {
      (coreGlow.current.material as THREE.SpriteMaterial).opacity = 0.3 + 0.08 * Math.sin(t * 0.5);
    }
  });

  return (
    <group ref={group}>
      <primitive object={linksObject} />

      <sprite ref={coreGlow} scale={1.9}>
        <spriteMaterial map={glowTex} color="#7c3aed" transparent opacity={0.22} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite scale={1.1} position={[0.16, -0.08, 0.1]}>
        <spriteMaterial map={glowTex} color="#fb923c" transparent opacity={0.1} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite scale={3} position={[0, -1.2, -1.2]}>
        <spriteMaterial map={softTex} color="#38bdf8" transparent opacity={0.04} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>

      <group ref={coreGroup}>
        <points>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[core.positions, 3]} />
            <bufferAttribute attach="attributes-color" args={[core.colors, 3]} />
          </bufferGeometry>
          <pointsMaterial map={softTex} vertexColors transparent opacity={0.85} size={0.045} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
        </points>
      </group>

      {anchors.map((a) => (
        <group key={a.id} position={[a.wx, a.wy, a.wz]}>
          <sprite scale={a.focused ? 0.95 : 0.6}>
            <spriteMaterial map={glowTex} color={a.color} transparent opacity={a.focused ? 0.5 : 0.28} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        </group>
      ))}

      {pulses}
    </group>
  );
}

/** A few bright sparks travelling along random graph paths, staggered. */
function usePulses(
  curves: readonly { curve: THREE.QuadraticBezierCurve3; color: string; active: boolean }[],
  reducedMotion: boolean,
) {
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  const state = useRef([
    { curveIndex: 0, t: 0, wait: 0.5 },
    { curveIndex: 3, t: 0, wait: 2.2 },
    { curveIndex: 6, t: 0, wait: 4.1 },
  ]);
  const tex = useDisposableTexture(() => makeRadialTexture(1));

  useFrame((_, delta) => {
    if (document.hidden || reducedMotion || curves.length === 0) return;
    state.current.forEach((pulse, i) => {
      const sprite = refs.current[i];
      if (!sprite) return;
      if (pulse.wait > 0) {
        pulse.wait -= delta;
        sprite.visible = false;
        return;
      }
      pulse.t += delta * 0.55;
      if (pulse.t >= 1) {
        pulse.t = 0;
        pulse.wait = 1.5 + Math.random() * 3.5;
        const activeIndexes = curves.flatMap((c, idx) => (c.active ? [idx] : []));
        pulse.curveIndex = Math.random() < 0.6 && activeIndexes.length > 0
          ? activeIndexes[Math.floor(Math.random() * activeIndexes.length)]
          : Math.floor(Math.random() * curves.length);
        return;
      }
      const link = curves[pulse.curveIndex % curves.length];
      const p = link.curve.getPoint(pulse.t);
      sprite.visible = true;
      sprite.position.copy(p);
      (sprite.material as THREE.SpriteMaterial).color.set(link.color);
      (sprite.material as THREE.SpriteMaterial).opacity = Math.sin(Math.PI * pulse.t) * 0.9;
    });
  });

  if (reducedMotion) return null;
  return (
    <>
      {state.current.map((_, i) => (
        <sprite key={i} ref={(el) => { refs.current[i] = el; }} scale={0.14} visible={false}>
          <spriteMaterial map={tex} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */

function makeCoreCluster(count: number) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette = ["#c4b5fd", "#e879f9", "#f0abfc", "#7dd3fc", "#a78bfa", "#ffffff", "#fdba74"];
  const clumps = [
    [0, 0, 0], [0.3, 0.16, 0.1], [-0.24, -0.12, -0.12], [0.08, -0.28, 0.15],
  ] as const;
  const c = new THREE.Color();
  for (let i = 0; i < count; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    let x: number;
    let y: number;
    let z: number;
    if (Math.random() < 0.62) {
      // Ring-biased swirl around a darker center, like the approved energy vortex.
      const ringRadius = 0.52 + gaussian() * 0.13;
      x = Math.cos(theta) * ringRadius;
      y = Math.sin(theta) * ringRadius * 0.82;
      z = gaussian() * 0.14;
    } else {
      const clump = clumps[Math.floor(Math.random() * clumps.length)];
      const radius = Math.abs(gaussian()) * 0.5;
      const phi = Math.acos(2 * Math.random() - 1);
      x = clump[0] + radius * Math.sin(phi) * Math.cos(theta);
      y = clump[1] + radius * Math.sin(phi) * Math.sin(theta) * 0.85;
      z = clump[2] + radius * Math.cos(phi) * 0.6;
    }
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    c.set(palette[Math.floor(Math.random() * palette.length)]);
    const brightness = 0.45 + Math.random() * 0.55;
    colors[i * 3] = c.r * brightness;
    colors[i * 3 + 1] = c.g * brightness;
    colors[i * 3 + 2] = c.b * brightness;
  }
  return { positions, colors };
}

function gaussian(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function hashUnit(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) % 997;
  return h / 997;
}

function makeRadialTexture(hardness: number, hue = "#ffffff"): THREE.Texture {
  const sizePx = 64;
  const canvas = document.createElement("canvas");
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(sizePx / 2, sizePx / 2, 0, sizePx / 2, sizePx / 2, sizePx / 2);
    const color = new THREE.Color(hue);
    const rgb = `${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)}`;
    gradient.addColorStop(0, `rgba(${rgb},1)`);
    gradient.addColorStop(Math.min(hardness, 0.98), `rgba(${rgb},0.5)`);
    gradient.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, sizePx, sizePx);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function useDisposableTexture(factory: () => THREE.Texture): THREE.Texture {
  const texture = useMemo(factory, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}
