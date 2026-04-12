# ZED AI

The canonical project spec is [SPEC.md](C:/Users/DGN/Desktop/Xoclon_Holdings/Zed/ZedAI/SPEC.md).

If project behavior, architecture, deploy steps, branch policy, or repo structure changes, update `SPEC.md` first.

## Quick Start

```powershell
cd server
npm run dev
```

Server runs on `http://localhost:5000`.

## Deploy

Netlify is configured from [netlify.toml](C:/Users/DGN/Desktop/Xoclon_Holdings/Zed/ZedAI/netlify.toml) with:

- base: `client`
- build: `npm install && npm run build`
- publish: `dist`

## Branch Policy

Only these branches should exist long-term:

- `main`
- `backup`
