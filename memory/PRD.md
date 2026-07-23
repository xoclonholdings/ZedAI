# PRD — NexusCore 3D Component (ZED AI repo)

## Original Problem Statement
Build a standalone, modular 3D React component `NexusCore` (Three.js + @react-three/fiber) for the center of the app UI: glowing "NEXUS" core, rotating spiral-galaxy particle field with custom vertex/fragment shaders (cyan/purple/magenta cosmic theme), radial constellation lines with glowing nodes, Y-axis auto-rotation, drag-to-rotate with inertia, `onRotate(angle)` callback, frame-budget-friendly, single self-contained file.

## User Choices (2026-06)
- Component + live demo page in this app
- "NEXUS" text rendered inside the 3D core
- Tilted spiral galaxy view
- 8 radial lines with glowing endpoint nodes

## Architecture
- Existing codebase: ZED AI monorepo — `client/` (React 18 + Vite 4 + TS + Tailwind), `server/` (Express, NOT running in this env, not needed for demo)
- Frontend served via supervisor shim: `/app/frontend/package.json` start script → `cd /app/client && ./node_modules/.bin/vite --host 0.0.0.0 --port 3000`
- `client/vite.config.ts`: added `allowedHosts: true` (preview domain) and `watch.usePolling` (low inotify limit in pod)
- New deps in client: `three@0.185`, `@react-three/fiber@8.18`, `@react-three/drei@9.122`, `@types/three`

## Implemented (2026-06)
### V1 (superseded)
- Galaxy particle core + 8 radial constellation lines + HTML satellites demo. Testing iteration_1: 100% pass.

### V2 — Celestial Navigation System (current)
- `client/src/nexus/components/NexusCore.tsx` (single file, ~750 lines):
  - Domains are PLANETS: unique size/color/orbital radius/inclination/irregular angles; some with rings (memory, knowledge, settings) and moons (workspaces, tools); lucide icon sprites rendered onto planet faces (renderToStaticMarkup → canvas texture)
  - NO graph lines (removed RadialLines per behavior spec)
  - Snap-to-domain: on release after inertia decay, rig eases to nearest domain (snap target offset 0.85 rad → focused planet settles front-right of core); never meaningless orientations; galaxy self-spins to stay alive
  - `onFocusChange(domain, index)`, `onDomainSelect(domain, index)` (planet tap, with <8px tap guard), `onCoreTap` (NEXUS = home), `zoom` prop drives camera dolly (8.8/zoom), camera.lookAt(0,-0.3,0)
  - Universe env: distant star shell (18-36 radius), 4 procedural nebula sprites, dust; DEFAULT_DOMAINS exported
- `client/src/pages/nexus-core-demo.tsx`:
  - Full-viewport celestial system; ZAR header w/ greeting + sparkle button; focused-domain pill; domain-entry flash → placeholder overlay (back btn or core tap returns home)
  - Command console per user mockups: angular chassis (clip-path), ZAR·Online, 6 modes (Text/Talk/Image/Draw/Doc/Upload), dual waveforms + central mic, "Tap to speak", History/Memory Context pills — VISUAL MOCK ONLY (non-functional by design, mockup provided by user)
- Testing iteration_2: 100% pass (all V2 flows)

## Notes / Gotchas
- Pod uses software WebGL (SwiftShader): automated tests must use `?particles=2500` and `domcontentloaded` waits
- App's Express backend not running; `/api/me` 502s on demo page are expected and harmless
- Node modules/package.json were reverted once by a platform checkpoint — if `three` imports fail, re-run `yarn install` in `/app/client`

## Backlog
- P1: Integrate NexusCore V2 into the real NexusRootPage (planets → real domain routes, console → NexusCommunicationDock)
- P2: Adaptive particle count based on GPU detection (auto-lower on software rasterizers)
- P2: Bloom postprocessing on capable GPUs; asteroid field edge details (per mockups)
- User will send further console mockup refinements if needed
