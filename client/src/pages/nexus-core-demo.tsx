import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Clock,
  FileText,
  Image as ImageIcon,
  Layers,
  MessageSquare,
  Mic,
  PenLine,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import NexusCore, { type NexusDomain } from "@/nexus/components/NexusCore";

const CONSOLE_MODES = [
  { id: "text", label: "Text", Icon: MessageSquare },
  { id: "talk", label: "Talk", Icon: Mic },
  { id: "image", label: "Image", Icon: ImageIcon },
  { id: "draw", label: "Draw", Icon: PenLine },
  { id: "doc", label: "Doc", Icon: FileText },
  { id: "upload", label: "Upload", Icon: Upload },
];

function Waveform({ colorFrom, colorTo, flip }: { colorFrom: string; colorTo: string; flip?: boolean }) {
  const bars = useMemo(
    () => Array.from({ length: 34 }, (_, i) => 3 + Math.abs(Math.sin(i * 1.7) * 14 + Math.sin(i * 0.6) * 6)),
    [],
  );
  const gid = useMemo(() => `wf-${Math.random().toString(36).slice(2, 8)}`, []);
  return (
    <svg viewBox="0 0 136 40" className="h-8 w-full opacity-80" style={{ transform: flip ? "scaleX(-1)" : undefined }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={colorFrom} />
          <stop offset="100%" stopColor={colorTo} />
        </linearGradient>
      </defs>
      {bars.map((h, i) => (
        <rect key={i} x={i * 4} y={20 - h / 2} width={2} height={h} rx={1} fill={`url(#${gid})`} />
      ))}
    </svg>
  );
}

export default function NexusCoreDemoPage() {
  const angleRef = useRef<HTMLSpanElement>(null);
  const [focused, setFocused] = useState<NexusDomain | null>(null);
  const [selected, setSelected] = useState<NexusDomain | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [flash, setFlash] = useState(false);
  const panelTimer = useRef<ReturnType<typeof setTimeout>>();

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5 || h >= 22) return "Good night,";
    if (h < 12) return "Good morning,";
    if (h < 18) return "Good afternoon,";
    return "Good evening,";
  }, []);

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
  }, []);

  const handleFocusChange = useCallback((domain: NexusDomain) => {
    setFocused(domain);
  }, []);

  const handleDomainSelect = useCallback((domain: NexusDomain) => {
    setSelected(domain);
    setFlash(true);
    clearTimeout(panelTimer.current);
    panelTimer.current = setTimeout(() => {
      setFlash(false);
      setPanelOpen(true);
    }, 750);
  }, []);

  const returnHome = useCallback(() => {
    clearTimeout(panelTimer.current);
    setPanelOpen(false);
    setFlash(false);
    setSelected(null);
  }, []);

  useEffect(() => () => clearTimeout(panelTimer.current), []);

  return (
    <div
      data-testid="nexus-core-demo-page"
      className="relative h-screen w-full overflow-hidden text-white"
      style={{
        background:
          "radial-gradient(ellipse 90% 70% at 50% 35%, #0b0620 0%, #050211 55%, #010005 100%)",
        fontFamily: "'SF Pro Display', -apple-system, sans-serif",
      }}
    >
      {/* Celestial system — fills the entire viewport */}
      <div className="absolute inset-0">
        <NexusCore
          particleCount={particleCount}
          onRotate={handleRotate}
          onFocusChange={handleFocusChange}
          onDomainSelect={handleDomainSelect}
          onCoreTap={returnHome}
          zoom={selected ? 2.3 : 1}
        />
      </div>

      {/* HUD — top */}
      <header className="pointer-events-none absolute left-0 right-0 top-0 flex items-start justify-between px-6 pt-5">
        <div>
          <span
            className="bg-gradient-to-r from-fuchsia-500 via-purple-400 to-blue-400 bg-clip-text text-3xl font-bold tracking-wide text-transparent"
            data-testid="demo-title"
          >
            ZAR
          </span>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-purple-300/70">
            <Sparkles className="h-3 w-3" /> Your Nexus. Your Universe.
            <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </p>
          <p className="mt-4 text-lg font-semibold text-gray-100">{greeting}</p>
          <p className="text-sm text-gray-400">How can I assist you today?</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-purple-400/40 bg-black/40 backdrop-blur transition-transform hover:scale-105"
            data-testid="hud-sparkle-btn"
          >
            <Sparkles className="h-5 w-5 text-purple-200" />
          </button>
          <div className="rounded-full border border-purple-500/20 bg-black/30 px-3 py-1 text-[10px] backdrop-blur">
            <span className="text-gray-500">heading </span>
            <span ref={angleRef} data-testid="rotation-angle-readout" className="font-mono text-cyan-300/80">
              0.0°
            </span>
          </div>
        </div>
      </header>

      {/* Focused domain indicator */}
      <div className="pointer-events-none absolute bottom-[248px] left-0 right-0 flex justify-center">
        {focused && !selected && (
          <div
            data-testid="focused-domain-label"
            className="flex items-center gap-2.5 rounded-full border border-white/10 bg-black/35 px-5 py-2 backdrop-blur-md"
            style={{ animation: "nexus-fade-in 400ms ease both" }}
          >
            <span
              className="block h-2 w-2 rounded-full"
              style={{ background: focused.color, boxShadow: `0 0 10px 2px ${focused.color}88` }}
            />
            <span className="text-xs font-medium tracking-[0.3em] text-gray-200">
              {focused.label}
            </span>
          </div>
        )}
      </div>

      {/* Command console — spacecraft command deck */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center">
        <div className="relative w-full max-w-[760px]" data-testid="command-console">
          {/* chassis */}
          <div
            className="relative border border-b-0 border-indigo-400/25 bg-gradient-to-b from-[#0d0a1f] via-[#0a0718] to-[#070512] px-5 pb-4 pt-3 shadow-[0_-10px_60px_-15px_rgba(99,102,241,0.45)]"
            style={{
              clipPath: "polygon(0 26px, 7% 26px, 10% 0, 90% 0, 93% 26px, 100% 26px, 100% 100%, 0 100%)",
            }}
          >
            {/* edge accent lights */}
            <div className="pointer-events-none absolute left-0 top-1/2 h-16 w-[3px] -translate-y-1/2 rounded-r bg-gradient-to-b from-cyan-400/70 to-purple-500/70 blur-[1px]" />
            <div className="pointer-events-none absolute right-0 top-1/2 h-16 w-[3px] -translate-y-1/2 rounded-l bg-gradient-to-b from-purple-500/70 to-cyan-400/70 blur-[1px]" />

            {/* status row */}
            <div className="mb-2 mt-5 flex items-center gap-2 px-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-300" />
              <span className="text-xs font-semibold tracking-wider text-gray-200">ZAR</span>
              <span className="text-[11px] text-emerald-400" data-testid="console-status">· Online</span>
            </div>

            {/* mode row */}
            <div className="mb-3 flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3 py-2">
              {CONSOLE_MODES.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  data-testid={`console-mode-${id}`}
                  className="group flex flex-col items-center gap-1 rounded-lg px-3 py-1 transition-colors hover:bg-white/5"
                >
                  <Icon className="h-[18px] w-[18px] text-gray-300 transition-colors group-hover:text-cyan-300" />
                  <span className="text-[10px] text-gray-400 group-hover:text-gray-200">{label}</span>
                </button>
              ))}
            </div>

            {/* waveform + mic */}
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5">
              <div className="flex-1"><Waveform colorFrom="#a855f7" colorTo="#6d28d9" /></div>
              <button
                data-testid="console-mic-btn"
                className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-cyan-400/60 bg-[#0b0a1a] shadow-[0_0_22px_-2px_rgba(34,211,238,0.55)] transition-transform hover:scale-105"
              >
                <Mic className="h-5 w-5 text-gray-100" />
                <span className="absolute inset-[-6px] rounded-full border border-cyan-400/20" />
              </button>
              <div className="flex-1"><Waveform colorFrom="#22d3ee" colorTo="#3b82f6" flip /></div>
            </div>
            <div className="mt-1.5 text-center text-[11px] text-gray-400">Tap to speak</div>

            {/* bottom pills */}
            <div className="mt-2 flex items-center justify-between">
              <button
                data-testid="console-history-btn"
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3.5 py-1.5 text-[11px] text-gray-300 transition-colors hover:bg-white/5"
              >
                <Clock className="h-3.5 w-3.5" /> History
              </button>
              <button
                data-testid="console-memory-btn"
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3.5 py-1.5 text-[11px] text-gray-300 transition-colors hover:bg-white/5"
              >
                Memory Context <Layers className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Domain entry flash */}
      {flash && selected && (
        <div
          data-testid="domain-entry-flash"
          className="pointer-events-none absolute inset-0 z-20"
          style={{
            background: `radial-gradient(circle at 50% 45%, ${selected.color}55 0%, transparent 65%)`,
            animation: "nexus-flash 750ms ease both",
          }}
        />
      )}

      {/* Domain placeholder overlay */}
      {panelOpen && selected && (
        <div
          data-testid="domain-overlay"
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 backdrop-blur-[3px]"
          style={{ animation: "nexus-fade-in 500ms ease both" }}
        >
          <div
            className="relative mx-4 w-full max-w-md rounded-2xl border bg-[#0a0618]/85 p-8 text-center backdrop-blur-xl"
            style={{ borderColor: `${selected.color}44`, boxShadow: `0 0 60px -15px ${selected.color}99` }}
          >
            <button
              data-testid="domain-back-btn"
              onClick={returnHome}
              className="absolute right-3.5 top-3.5 rounded-full p-1.5 text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <span
              className="mx-auto mb-5 block h-3 w-3 rounded-full"
              style={{ background: selected.color, boxShadow: `0 0 18px 5px ${selected.color}77` }}
            />
            <h2
              data-testid="domain-overlay-title"
              className="text-2xl font-semibold tracking-[0.35em]"
              style={{ color: selected.color }}
            >
              {selected.label}
            </h2>
            <p className="mt-3 text-sm text-gray-400">
              Domain interface placeholder — this workspace opens here.
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes nexus-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes nexus-flash { 0% { opacity: 0; } 35% { opacity: 1; } 100% { opacity: 0.65; } }
      `}</style>
    </div>
  );
}
