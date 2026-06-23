# Memory Import Policy

This project uses a two-layer memory model:

- `hub/shared-memory/` is the active canonical memory used by the app
- raw exports stay in archive or staging areas until they are reconciled into the hub

## Rules

- Do not drop new ChatGPT or external memory exports directly into `hub/shared-memory/`
- Do not delete `zed-memory/` unless a newer verified raw archive has replaced it
- Treat `zed-memory/` as read-only backup storage
- Use normalized hub outputs for day-to-day reasoning
- Use raw archives only when re-importing, auditing, or recovering lost detail

## Recommended Flow For Future Imports

1. Put new raw exports into `memory-imports/` as temporary staging
2. Inspect and validate the export before merging anything
3. Normalize the useful content into `hub/shared-memory/`
4. Preserve any raw backup only if it contains details not fully represented in the hub
5. Remove temporary staging files after the import is verified

## Current Canonical Memory Paths

- `hub/shared-memory/working/`
- `hub/shared-memory/episodic/`
- `hub/shared-memory/consensus/`
- `hub/shared-memory/semantic/`

## Current Legacy Backup

- `zed-memory/`
- See `zed-memory/LEGACY_BACKUP_MANIFEST.md` for the backup inventory and handling policy
