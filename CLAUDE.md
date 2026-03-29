# Project: AI Workforce Hub (Ollama-based)

## Current System Status
**CRITICAL**: Active build in progress. UI and backend structure EXIST and are partially functional.
**Primary Issue**: Debugging import errors and server startup failures.
**Framework**: Ollama (local LLM inference) + [Your UI framework] + [Your backend stack]

## Architecture Overview
- **Local LLM**: Ollama (models: [list what you have installed])
- **UI**: [Your framework - React/Vue/Svelte/etc.]
- **Backend**: [Express/FastAPI/Django/etc.]
- **Database**: [SQLite/PostgreSQL/etc.]
- **Planned Agents**: Operations (Exec+Social), Intelligence (R&D), Audio Engineer, IDE Operator

## ABSOLUTE CONSTRAINTS (Do Not Violate)
1. **NEVER modify existing UI component structure** without explicit "UI_REDESIGN_APPROVED" flag
2. **NEVER change Ollama configuration** (ports, models, env vars) unless explicitly debugging Ollama connection
3. **ALWAYS check existing imports** in `package.json`/`requirements.txt`/`Cargo.toml` before suggesting new ones
4. **NEVER delete existing route files** - append or modify, don't destroy
5. **SERVER STARTUP IS THE GOAL** - every change must be tested with `npm start`/`python server.py`/etc.

## Debugging Protocol (Current Priority)
When import errors or server failures occur:

### Step 1: Diagnostic (Read-Only)
```
1. Check package.json dependencies (what's installed vs. what's imported)
2. Check for typos in import statements (case sensitivity, path aliases)
3. Verify Ollama is running: `ollama list` and `ollama ps`
4. Check server logs for stack traces (last 20 lines)
5. Identify: Is this a missing dependency, path error, or runtime crash?
```

### Step 2: Dependency Resolution
```
- If package missing: `npm install [exact-package-name]` (check npm registry first)
- If version conflict: Check package.json for version ranges, suggest pin
- If path alias broken: Check tsconfig.json/jsconfig.json paths
- If Ollama connection fails: Verify CORS, port 11434, model availability
```

### Step 3: Surgical Fix
```
- ONE change at a time
- Test server start after each change
- If fails, revert and document in KNOWN_ISSUES
- No "shotgun debugging" (changing 5 things hoping one works)
```

## Project Structure (Existing)
```
[Your actual structure - to be filled in first session]
├── ui/ or src/ or client/          [Your UI directory]
│   ├── components/                  [EXISTING - hands off]
│   ├── pages/ or views/             [EXISTING - hands off]
│   └── [other UI files]              [EXISTING - hands off]
├── server/ or api/ or backend/      [Your backend directory]
│   ├── routes/                       [EXISTING - modify carefully]
│   ├── models/ or db/                [EXISTING - hands off]
│   └── [other backend files]         [EXISTING - hands off]
├── ollama/ or config/                [Ollama integration - hands off]
└── package.json / requirements.txt   [CRITICAL - check before changes]
```

## Current Known Issues (Update As We Work)
- [ ] Import error: [specific module] in [specific file] - Status: [investigating/fixed]
- [ ] Server fails to start: [error message] - Status: [investigating/fixed]
- [ ] Ollama connection: [issue] - Status: [investigating/fixed]

## Working Session Log (Persistent Memory)
**2026-03-29**: Initial CLAUDE.md creation. Current focus: Stabilize existing Ollama + UI + backend integration before adding agent infrastructure.

## Agent Integration Plan (Post-Stabilization)
Once server starts reliably:
1. Add Operations Agent endpoints (exec/social APIs)
2. Add Intelligence Agent background worker
3. Integrate with existing Ollama for local LLM inference
4. Add Audio Engineer (DAW control)
5. Add IDE Operator (code review of this project + other apps)

## Tool Permissions
- Read: All files (diagnostic)
- Write: Backend routes (new agent endpoints), config files (careful), documentation
- Execute: Server start/stop, test commands, Ollama status checks
- **Locked**: UI components (read-only unless explicitly unlocked)

## Communication Style
- Direct, minimal, action-focused
- When stuck: State exactly what's blocking, propose 2 options, wait for choice
- No circular debugging - if 3 attempts fail, escalate to human with full context

