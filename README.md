# ZED AI

The canonical project spec is [SPEC.md](C:/Users/DGN/Desktop/Xoclon_Holdings/Zed/ZedAI/SPEC.md).

If project behavior, architecture, deploy steps, branch policy, or repo structure changes, update `SPEC.md` first.

## Quick Start

```powershell
cd server
npm run dev
```

Server runs on `http://localhost:5000`.

## Windows Auto Start

For a hands-off local workstation boot flow:

- [C:\Users\DGN\Desktop\Xoclon_Holdings\Zed\ZedAI\install-zed-workstation.cmd](C:/Users/DGN/Desktop/Xoclon_Holdings/Zed/ZedAI/install-zed-workstation.cmd)
  - installs workstation logon startup
- [C:\Users\DGN\Desktop\Xoclon_Holdings\Zed\ZedAI\install-zed-model-host.cmd](C:/Users/DGN/Desktop/Xoclon_Holdings/Zed/ZedAI/install-zed-model-host.cmd)
  - installs the Ollama model host on `D:` and pulls the default ZED model stack
- [C:\Users\DGN\Desktop\Xoclon_Holdings\Zed\ZedAI\zed-start.ps1](C:/Users/DGN/Desktop/Xoclon_Holdings/Zed/ZedAI/zed-start.ps1)
  - builds the client when needed and starts the production server on `http://127.0.0.1:5000`
- [C:\Users\DGN\Desktop\Xoclon_Holdings\Zed\ZedAI\zed-ollama-host.ps1](C:/Users/DGN/Desktop/Xoclon_Holdings/Zed/ZedAI/zed-ollama-host.ps1)
  - runs the local Ollama host using `D:\.ollama\models`
- [C:\Users\DGN\Desktop\Xoclon_Holdings\Zed\ZedAI\zed-start-dev.ps1](C:/Users/DGN/Desktop/Xoclon_Holdings/Zed/ZedAI/zed-start-dev.ps1)
  - optional dual-process dev launcher
- [C:\Users\DGN\Desktop\Xoclon_Holdings\Zed\ZedAI\zed-stop.ps1](C:/Users/DGN/Desktop/Xoclon_Holdings/Zed/ZedAI/zed-stop.ps1)
  - stops managed ZED processes

## Deploy

Netlify is configured from [netlify.toml](C:/Users/DGN/Desktop/Xoclon_Holdings/Zed/ZedAI/netlify.toml) with:

- base: `client`
- build: `npm install && npm run build`
- publish: `dist`

## Branch Policy

Only these branches should exist long-term:

- `main`
- `backup`
