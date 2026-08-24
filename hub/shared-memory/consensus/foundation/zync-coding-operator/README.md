# Zync Coding Operator

This directory is Zed's core-memory registry for Zync, the future standalone
coding operator app.

The entries here are not decorative documentation. `server/services/ZyncCodingOperatorService.ts`
loads `capabilities.json`, verifies every registry entry has a live handler,
and exposes the working functions through admin-only routes. The service is
kept isolated so it can later be extracted into the Zync app with minimal
rewiring.

## Runtime Contract

- Registry file: `capabilities.json`
- Loader: `ZyncCodingOperatorService.loadRegistry()`
- Admin status route: `GET /api/admin/zync-coding-operator/status`
- Admin action routes: `/api/admin/zync-coding-operator/*`
- Audit trail: runtime log events beginning with `zync.`

## Capabilities

1. Repository context scan
2. Relevant code search
3. Change impact review
4. Verification runner
5. GitHub branch hygiene

Each capability must report exactly what it did, whether it executed, and
whether external GitHub credentials were required.
