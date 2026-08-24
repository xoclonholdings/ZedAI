# ZYNC Coding Operator

This directory is the live capability registry for the current ZYNC coding-operator seed runtime.

ZYNC is no longer treated as merely a future standalone coding app. It is the software-engineering workspace of ZCOS: Canvas -> Build -> Coding | Design | Publish. The broader studio contract lives in `../zync-software-studio/`.

The entries here are executable runtime capabilities. `server/services/ZyncCodingOperatorService.ts` loads `capabilities.json`, verifies registry entries against live handlers, and exposes the current functions through admin-only routes.

## Runtime Contract

- Registry file: `capabilities.json`
- Loader: `ZyncCodingOperatorService.loadRegistry()`
- Admin status route: `GET /api/admin/zync-coding-operator/status`
- Admin action routes: `/api/admin/zync-coding-operator/*`
- Audit trail: runtime log events beginning with `zync.`
- Studio foundation: `../zync-software-studio/README.md`
- Studio manifest: `../zync-software-studio/studio-manifest.json`
- Cross-project registry: `../zync-software-studio/cross-project-registry.json`

## Current executable seed capabilities

1. Repository context scan
2. Relevant code search
3. Change impact review
4. Verification runner
5. GitHub branch hygiene

Each capability must report exactly what it did, whether it executed, and whether external credentials were required.

## Expansion rule

New studio capabilities should extend this runtime or be extracted behind typed ZYNC services. Do not move ZCOS Identity, Memory, Knowledge, authorization, or integration authority into ZYNC. ZYNC consumes those governed services.
