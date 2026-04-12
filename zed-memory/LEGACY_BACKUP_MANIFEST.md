# Zed Memory Legacy Backup Manifest

`zed-memory/` is an immutable raw backup archive of older ChatGPT export data.

It is intentionally retained even after the active memory foundation was merged into `hub/shared-memory/`.

## Role

- Preserve the original export files and attachment structure from the older Zed memory pack
- Act as a last-resort raw backup if the normalized hub memory ever needs to be re-derived
- Avoid accidental deletion of export details that are not fully represented in the normalized hub layer

## Current Relationship To Active Memory

- Active canonical memory lives under `hub/shared-memory/`
- Normalized merged conversation archive lives under `hub/shared-memory/semantic/foundation/`
- `zed-memory/` is not the live runtime memory source
- `zed-memory/` should not be edited, reorganized, or deleted casually

## Inventory Snapshot

- Snapshot date: `2026-04-12`
- Total files under `zed-memory/`: `1181`
- Top-level export directories under `zed-memory/storage/ZedAI_data/Zed_Memory_GPT/`: `19`
- Attachment/image folders: `Zed_Memory_Images1` through `Zed_Memory_Images17`
- Export parts:
  - `Zed_Memory_part1/chat.html`
  - `Zed_Memory_part2/conversations.json`
  - `Zed_Memory_part2/message_feedback.json`
  - `Zed_Memory_part2/shared_conversations.json`
  - `Zed_Memory_part2/user.json`

## Important Notes

- `Zed_Memory_part2/conversations.json` is the main structured conversation export used during the merge into the canonical hub memory
- The many `Zed_Memory_Images*` folders indicate there are raw attachment assets still preserved only in this legacy backup area
- Because of that raw attachment footprint, `zed-memory/` contains more than the normalized conversation text alone

## Handling Policy

- Keep `zed-memory/` as read-only backup storage
- Treat `hub/shared-memory/` as the live canonical memory system
- If future reconciliation work is needed, derive from `zed-memory/` into `hub/shared-memory/`, not the other way around
- Do not delete `zed-memory/` unless a newer verified archival strategy has replaced it
