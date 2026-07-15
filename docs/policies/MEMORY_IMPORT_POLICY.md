# Memory Import Policy

Zed uses four separate memory layers:

1. Zed Core: shared identity, governance, orchestration, policy, tool contracts, verification rules, and shared object schemas. It must never contain personal conversations, uploaded documents, private projects, business records, or ChatGPT exports.
2. Shared system knowledge: reusable domain knowledge intentionally installed for all authorized users. It is shared, but it is not Zed Core and is not user-owned memory.
3. User identity and personalization: profile, preferred name, communication preferences, memory permissions, goals, working style, and confirmed or proposed preferences owned by one authenticated user.
4. User knowledge and history: uploaded documents, imported conversations, projects, decisions, relationships, extracted objects, evidence, conflicts, timelines, and long-term retrieval history owned by one authenticated user.

## Rules

- Every user-owned memory write must carry a real authenticated `userId`.
- Do not use fallback owners such as `user`, `user_001`, `default-user`, `anonymous`, or invented admin IDs.
- Do not drop new ChatGPT or external memory exports directly into `hub/shared-memory/`.
- Do not put user data in Git.
- Do not write runtime memory into `zed-memory/` or `zed-memory/storage/`.
- Treat `zed-memory/` as the admin user's read-only legacy personal historical archive.
- Use durable database-backed memory contracts for production memory.
- Filesystem memory paths are allowed only as local development fallback, read-only legacy source, exports, or temporary processing areas.

## Legacy Admin Archive

The existing `zed-memory/` corpus belongs only to `user_admin`.

- It is not Zed Core.
- It is not shared system knowledge.
- It is not the runtime source for new users.
- It is historical evidence, not automatic current truth.
- It remains preserved and unmigrated until a later verified migration and reconciliation pass.

See `zed-memory/LEGACY_BACKUP_MANIFEST.md` for the ownership manifest.

## Recommended Flow For Future Imports

1. Put new raw exports into ignored temporary staging outside source-controlled memory paths.
2. Associate the import with the authenticated owner before any processing.
3. Inspect and validate the export before promoting anything.
4. Store user-owned memory in durable user-scoped tables or user-scoped object storage.
5. Store intentionally shared knowledge only in shared-system records explicitly marked as shared.
6. Keep raw exports out of Git and remove temporary staging files after verification.