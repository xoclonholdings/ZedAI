import { useCallback, useRef } from "react";
import NexusCore from "@/nexus/components/NexusCore";

const SATELLITES = [
  { label: "IDENTITY", color: "#22d3ee" },
  { label: "MEMORY", color: "#a855f7" },
  { label: "KNOWLEDGE", color: "#6ea8ff" },
  { label: "WORKSPACES", color: "#2dd4bf" },
  { label: "PROJECTS", color: "#6ea8ff" },
  { label: "TOOLS", color: "#f59e0b" },
  { label: "CONNECT", color: "#ff3ec8" },
  { label: "SETTINGS", color: "#22d3ee" },
];

const RADIUS_X = 46; // % of container half-width
const RADIUS_Y = 19; // squashed to match galaxy tilt

export default function NexusCoreDemoPage() {
  const angleRef = useRef<HTMLSpanElement>(null);
  const satRefs = useRef<(HTMLDivElement | null)[]>([]);
  const particleCount = (() => {
    const p = new URLSearchParams(window.location.search).get("particles");
    const n = p ? parseInt(p, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 42000;
  })();

  const handleRotate = useCallback((angle: number) => {
    if (angleRef.current) {
      const deg = ((angle * 180) / Math.PI) % 360;
      angleRef.current.textContent = `${(deg < 0 ? deg + 360 : deg).toFixed(1)}°`;
    }
    SATELLITES.forEach((_, i) => {
      const el = satRefs.current[i];
      if (!el) return;
      const a = angle + (i / SATELLITES.length) * Math.PI * 2;
      const x = Math.cos(a) * RADIUS_X;
      const y = Math.sin(a) * RADIUS_Y;
      const depth = Math.sin(a); // >0 front, <0 behind
      el.style.transform = `translate(-50%, -50%) translate(${x}cqw, ${y}cqw) scale(${0.82 + depth * 0.18})`;
      el.style.opacity = `${0.45 + (depth + 1) * 0.275}`;
      el.style.zIndex = depth > 0 ? "3" : "1";
    });
  }, []);

  return (
    <div
      data-testid="nexus-core-demo-page"
      className="min-h-screen w-full text-white"
      style={{
        background: "radial-gradient(ellipse 80% 60% at 50% 40%, #120a2e 0%, #070312 55%, #020108 100%)",
        fontFamily: "'SF Pro Display', -apple-system, sans-serif",
      }}
    >
      <header className="flex items-center justify-between px-8 pt-6">
        <div>
          <span
            className="bg-gradient-to-r from-pink-500 via-purple-400 to-cyan-400 bg-clip-text text-2xl font-bold tracking-wide text-transparent"
            data-testid="demo-title"
          >
            NexusCore
          </span>
          <p className="mt-1 text-xs text-gray-400">
            Drag to rotate · release for inertia · auto-rotation resumes
          </p>
        </div>
        <div className="rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-sm backdrop-blur">
          <span className="text-gray-400">onRotate → </span>
          <span
            ref={angleRef}
            data-testid="rotation-angle-readout"
            className="font-mono text-cyan-300"
          >
            0.0°
          </span>
        </div>
      </header>

      <main className="flex items-center justify-center px-4">
        <div
          className="relative w-full max-w-[720px]"
          style={{ containerType: "inline-size", aspectRatio: "1 / 1" }}
        >
          <NexusCore onRotate={handleRotate} particleCount={particleCount} lineCount={8} />

          {/* HTML satellites anchored to the 3D rotation via onRotate */}
          <div className="pointer-events-none absolute inset-0" data-testid="satellite-layer">
            {SATELLITES.map((sat, i) => (
              <div
                key={sat.label}
                ref={(el) => {
                  satRefs.current[i] = el;
                }}
                data-testid={`satellite-node-${i}`}
                className="absolute left-1/2 top-1/2 flex flex-col items-center gap-1.5"
                style={{ transition: "opacity 120ms linear" }}
              >
                <span
                  className="block h-2.5 w-2.5 rounded-full"
                  style={{ background: sat.color, boxShadow: `0 0 12px 3px ${sat.color}66` }}
                />
                <span className="text-[10px] font-medium tracking-[0.18em] text-gray-300">
                  {sat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="pb-6 text-center text-[11px] text-gray-500">
        Standalone component · <code className="text-purple-400">client/src/nexus/components/NexusCore.tsx</code>
      </footer>
    </div>
  );
}
