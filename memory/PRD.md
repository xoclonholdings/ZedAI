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
- `/app/client/src/nexus/components/NexusCore.tsx` — single-file component:
  - Default export `NexusCore` (own transparent Canvas, props: width/height/transparent/background/className/style + scene props)
  - Named export `NexusCoreScene` for embedding in an existing Canvas
  - Scene props: `onRotate`, `autoRotateSpeed`, `interactive`, `particleCount` (42k default), `lineCount` (8), `label` ("NEXUS"), `tilt`
  - Custom shader Points (galaxy spiral, 4 branches + stardust), twinkle in vertex shader, additive blending, no per-frame CPU attribute updates
  - Fresnel-shader core orb + pulsing halo sprite + drei Billboard Text "NEXUS"
  - 8 radial gradient lines + pulsing endpoint node sprites + mid dots
  - RotationRig: auto-rotate, pointer drag (Y-rotation + clamped tilt), frame-rate-independent inertia decay, emits `onRotate(rig.rotation.y)` each frame
- `/app/client/src/pages/nexus-core-demo.tsx` — demo page at public route `/nexus-core-demo` (registered in App.tsx): angle readout HUD, 8 HTML satellite labels anchored to rotation via onRotate (direct DOM transform updates), `?particles=N` query param for test environments
- Testing: iteration_1 — 100% pass (load, canvas, auto-rotation, drag, inertia, satellite anchoring, no errors)

## Notes / Gotchas
- Pod uses software WebGL (SwiftShader): automated tests must use `?particles=2500` and `domcontentloaded` waits
- App's Express backend not running; `/api/me` 502s on demo page are expected and harmless
- Node modules/package.json were reverted once by a platform checkpoint — if `three` imports fail, re-run `yarn install` in `/app/client`

## Backlog
- P1: Integrate NexusCore into the real NexusRootPage constellation UI (replace/augment NexusConstellation)
- P2: Adaptive particle count based on `WEBGL_debug_renderer_info` (auto-lower on software rasterizers)
- P2: Optional bloom postprocessing pass (@react-three/postprocessing) for stronger glow on capable GPUs
