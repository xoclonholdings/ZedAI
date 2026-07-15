# Zed Memory Legacy Archive Ownership

`zed-memory/` is the admin user's legacy personal historical archive.

## Ownership

- Owner: `user_admin`
- Role: legacy personal historical corpus
- Authority: historical evidence, not automatic current truth
- Shared with other users: never
- Zed Core: no
- Shared system knowledge: no
- Writable by the runtime: no
- Runtime source for new users: no

## Handling Policy

- Treat this archive as read-only.
- Do not load this archive for any user other than `user_admin`.
- Do not treat this archive as universal Zed memory.
- Do not treat this archive as shared installed knowledge.
- Do not write new runtime memory, uploads, graph outputs, summaries, embeddings, or extracted objects into this directory.
- Preserve the archive until a later verified migration and reconciliation pass exists.
- Deletion is prohibited until reconciliation is complete.

## Current Pass

This manifest only classifies ownership and handling rules. It does not migrate, delete, move, parse, summarize, index, inventory, or reinterpret archive contents.