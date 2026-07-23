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

### V2.1 — Warp + Atmospheric worlds (2026-06)
- `WarpField` in NexusCore.tsx: 320 additive line-segment star streaks (grow/fade with intensity lerp), `warp` prop; demo activates during domain entry (select → 1150ms warp+flash → overlay)
- `AtmosphereVeil` in NexusCore.tsx: two colored glow sprites (back z-11 / front z4.2) lerp opacity+color to the selected domain color — `atmosphere` prop
- Demo: `atmosphere-tint` CSS radial overlay in domain color (900ms fade), per-domain world taglines (DOMAIN_WORLDS map) shown in overlay via `domain-world-tagline`
- Verified via screenshot: warp streaks + cyan identity atmosphere + themed overlay all working

### V2.2 — FINAL VISUAL CONVERGENCE (2026-06) — VISUALS FROZEN
- Chakra planet palette: identity=white #e8ecf4, memory=violet #8b5cf6 (crown), knowledge=cyan #22d3ee (throat), projects=gold #eab308 (solar), workspaces=green #34d399 (heart), connect=orange #fb923c (sacral), tools=red #ef4444 (root), settings=indigo #6366f1 (third eye)
- Warp: premium 420ms entry (fast-in 9/s, smooth-out 5/s intensity lerp, shorter/subtler streaks, opacity 0.7)
- World entry: modal overlay + flash + taglines REMOVED per final spec. Replaced with minimal top workspace bar (chevron back + colored dot + domain name; testids kept: domain-overlay, domain-overlay-title, domain-back-btn). Universe changes instead of pages.
- NEXUS energy: CoreOrb `energyColor` prop — core shader colors + halo lerp toward active world color (2.5/s breathe), geometry unchanged
- Console: layout identical; accents only (mic ring/glow, status dot, edge lights) follow active world color w/ 700ms CSS transitions; default accent cyan
- Zoom softened 2.3→1.8, camera lerp 3→4.5/s for fast settle
- Verified via scripted browser check: home state, world entry (IDENTITY), back-to-home all pass
- STATUS: visual system feature-complete. Next phase = production integration into ZAR app (NOT visual iteration)

### V2.3 — Mobile-first fixes (2026-06)
- Portrait (aspect<0.8): orbitScale clamp(aspect*1.15, 0.52, 1), planet sizeScale 1.28, camera baseZ 10.6, lookAt y -1.05 (system lifted above console) — whole system now in frame on phones
- Tap targets: invisible sphere (max(size*2.6, 0.5), opacity-0 material) around each planet — reliable mobile taps
- Snap detents: velocity threshold 0.0018→0.004, ease 3.2→5.5/s — visibly locks onto each planet with focused label before tapping
- Warp: rise 12/s, opacity 0.85, streaks k*2.2, entry 500ms — clearly visible on tap, then world UI
- Core "NEXUS" text: dark outline (#1b0b33) so it stays legible over bright core on small screens; greeting fades while in-world; focus pill z-10 @ bottom-292px
- Verified at 390x844: home framing, drag snap (IDENTITY→MEMORY), planet tap → MEMORY world, label visibility

## Notes / Gotchas
- Pod uses software WebGL (SwiftShader): automated tests must use `?particles=2500` and `domcontentloaded` waits
- App's Express backend not running; `/api/me` 502s on demo page are expected and harmless
- Node modules/package.json were reverted once by a platform checkpoint — if `three` imports fail, re-run `yarn install` in `/app/client`

## Backlog
- P1: Integrate NexusCore V2 into the real NexusRootPage (planets → real domain routes, console → NexusCommunicationDock)
- P2: Adaptive particle count based on GPU detection (auto-lower on software rasterizers)
- P2: Bloom postprocessing on capable GPUs; asteroid field edge details (per mockups)
- User will send further console mockup refinements if needed
