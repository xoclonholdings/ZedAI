# ZED AI

The canonical project spec is [SPEC.md](./SPEC.md).

If project behavior, architecture, deploy steps, branch policy, or repo structure changes, update `SPEC.md` first.

## Quick Start

```powershell
cd server
npm run dev
```

Server runs on `http://localhost:5000`.

## Local Workstation Scripts

Local Windows boot/install scripts live in [scripts/local](./scripts/local/).

- `scripts/local/start-zed-now.cmd` starts ZED and opens the browser.
- `scripts/local/install-zed-workstation.cmd` installs workstation logon startup.
- `scripts/local/install-zed-model-host.cmd` installs the local Ollama model host and pulls the default model stack.
- `scripts/local/zed-start-dev.ps1` starts the optional dual-process dev launcher.
- `scripts/local/zed-stop.ps1` stops managed ZED processes.

## Deploy

Netlify is configured from [netlify.toml](./netlify.toml) with:

- base: `client`
- build: `npm install && npm run build`
- publish: `dist`

## Branch Policy

Only these branches should exist long-term:

- `main`
- `backup`
