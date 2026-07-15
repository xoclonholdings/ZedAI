# Zed Memory Legacy Archive Ownership

`zed-memory/` is the current admin user's legacy personal historical archive.

## Classification

- Canonical owner: `user_admin`
- Classification: personal historical corpus
- Authority: historical evidence, not automatic current truth
- Shared across users: never
- Part of Zed Core: no
- Part of shared system knowledge: no
- Writable by runtime: no
- Active runtime source: no
- Eligible for deletion now: no
- Eligible for migration now: no
- Later migration destination: admin-owned durable user memory, not shared memory

## Handling Rules

- Keep this archive read-only.
- Do not load this archive for users other than `user_admin`.
- Do not treat this archive as universal Zed memory.
- Do not treat this archive as shared system knowledge.
- Do not write runtime memory, uploads, extracted objects, embeddings, summaries, or generated graphs into this directory.
- Preserve this archive until a later verified migration and reconciliation pass exists.
- Deletion is prohibited until reconciliation is complete.

## Current Pass

This manifest only classifies ownership and handling rules. It does not migrate, delete, move, parse, summarize, index, inventory, or reinterpret archive contents.
