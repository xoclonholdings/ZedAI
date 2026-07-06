# ZED Object Memory Reparse

## What it does

The object-memory reparse turns ZED's flat foundation memory (ChatGPT exports, conversation transcripts, markdown summaries) into structured objects that the Cognitive Core can retrieve and reason over.

Instead of stuffing raw text into every prompt, ZED extracts typed objects (projects, systems, features, decisions, preferences, rules, constraints, open questions, tasks, integrations, repositories, events) with provenance, confidence, and relationships. Retrieval is selective per query — only the top-K objects most relevant to what the user is asking about are pulled into the prompt.

## Input sources

By default the CLI reads every `.md`, `.json`, and `.txt` file under:

- `hub/shared-memory/semantic/foundation/`
- `hub/shared-memory/consensus/foundation/`

Additional sources can be passed with `--source <path>` (repeatable). Source files are never mutated.

## Object schema

Every object extends `BaseObject` (in `shared/object-memory-types.ts`) which carries:

- `id` — stable ID (`obj_<type>_<hash>`)
- `type` — one of the 14 object types
- `canonicalName`, `aliases`, `summary`
- `properties` — type-specific fields
- `sourceRefs` — at least one `{ sourceFile, evidenceQuote, extractedAt, ... }` with a verbatim quote
- `confidence` — 0..1
- `createdAt`, `updatedAt`, `status`
- `promotionTier` — classification (see below)

Object types: `user_profile`, `project`, `system`, `feature`, `decision`, `preference`, `rule`, `constraint`, `open_question`, `task`, `integration`, `repository`, `event`, `memory_conflict`.

## Relationship schema

`ObjectRelationship` links objects with a typed edge:

- `BELONGS_TO`, `DEPENDS_ON`, `IMPLEMENTS`, `OWNS`, `USES`
- `BLOCKED_BY`, `SUPERSEDES`, `CONTRADICTS`
- `PREFERS`, `REJECTS`, `RELATED_TO`
- `ROUTES_TO`, `STORES_IN`, `EXPOSED_BY`, `CONFIGURED_BY`

Every relationship carries `evidence`, `confidence`, and `createdAt`.

## CLI usage

```bash
# From server/
npm run memory:reparse-objects           # dry run + markdown summary
npm run memory:reparse-objects:apply     # dry run + apply (backs up prior graph)

# Direct
tsx scripts/reparseBaseMemoryToObjects.ts --dry-run --write-markdown
tsx scripts/reparseBaseMemoryToObjects.ts --apply
tsx scripts/reparseBaseMemoryToObjects.ts --source hub/shared-memory/semantic/foundation/merged-conversations.json
```

Flags:

| Flag | Default | Meaning |
|---|---|---|
| `--dry-run` | true | Write to `hub/shared-memory/object-reparse/` only |
| `--apply` | false | Also write applied graph to `hub/shared-memory/object-memory/graph.json` |
| `--source <path>` | (auto) | Add explicit source file; repeatable |
| `--limit <n>` | none | Cap total objects |
| `--offset <n>` | 0 | Skip first n sentences per source |
| `--project <name>` | none | Only emit objects tagged with this project |
| `--type <type>` | none | Only emit objects of this type |
| `--min-confidence <n>` | none | Drop objects below this confidence |
| `--include-conflicts` | true | Include `memory_conflict` objects |
| `--no-conflicts` | false | Exclude `memory_conflict` objects |
| `--write-markdown` | false | Render markdown summary alongside JSON |

## Dry-run outputs

Written to `hub/shared-memory/object-reparse/`:

- `object-memory-dry-run.json` — full graph (objects + relationships + stats)
- `object-memory-dry-run.md` — human-readable summary (with `--write-markdown`)
- `object-graph.json` — objects only
- `object-relationships.json` — relationships only
- `promotion-candidates.json` — every object's promotion tier
- `memory-conflicts.json` — extracted `memory_conflict` objects
- `unresolved-questions.json` — extracted `open_question` objects
- `extraction-manifest.json` — sources + stats
- `source-coverage-report.json` — per-source object counts + byte size

## Apply mode

When `--apply` is passed:

1. The dry-run outputs are written as usual (never skipped).
2. If a prior applied graph exists at `hub/shared-memory/object-memory/graph.json`, it is backed up to `graph.backup.<timestamp>.json` in the same directory.
3. The new graph is written to `graph.json`.
4. A one-line record is appended to `reparse-history.jsonl`.

Prior graphs are never destroyed — every apply preserves the previous state.

## Promotion policy

Every object is classified into one of:

- `core_memory_candidate` — stable user identity, durable preferences, major rules
- `project_memory_candidate` — project-specific facts, repos, feature decisions, architecture
- `working_memory_candidate` — temporary tasks, active issues, short-term plans
- `do_not_promote` — old ideas, discarded plans, speculation, contradicted details
- `requires_review` — conflicts, sensitive facts, uncertain extraction (confidence < 0.5)

The classifier is heuristic: `user_profile` / `rule` / `preference` → core; `project` / `system` / `feature` / `repository` → project; `task` / `open_question` / `event` → working; `memory_conflict` → requires_review.

## How ZED uses object memory

At every chat request, `KnowledgeService.buildContext` calls `retrieveObjectMemoryForQuery(query, 5)`. That function reads the applied graph (if one exists), scores objects against the query by keyword overlap and confidence, and returns a formatted block containing at most K objects — never the whole graph.

The block is slotted into the Cognitive Core knowledge stack right after Foundation Knowledge and before Personalization, so structured facts are visible to the model without displacing lighter-weight sources.

## Non-goals for the first pass

- **LLM-based extraction** — the current extractor is deterministic and pattern-based. Reproducibility and testability come first; LLM inference lands behind an `--llm` flag in a follow-up.
- **Automatic promotion into core memory** — every object is classified but nothing is silently promoted. An admin surface for reviewing and approving promotions lands in a follow-up.
- **Full graph visualization in the admin UI** — the applied graph is JSON on disk and browsable via retrieval; a visual browser is a follow-up.

## Extending it

- **Add an object type** — extend `ObjectMemoryType` in `shared/object-memory-types.ts`, add the interface, and add a heuristic in `extractor.ts`.
- **Add a relationship type** — extend `RelationshipType` and add the emission logic near the bottom of `extractObjectsFromSource`.
- **Improve extraction quality** — tune the pattern anchors in `extractor.ts` or layer LLM inference on top.
- **Add a source format** — extend `readSourceText` in `reparseBaseMemoryToObjects.ts` to handle the new format.

## Wiring to user-added memory

The user-facing "add to base memory" path is `POST /api/me/personalization/notes` (see `server/routes-modules/me.ts` and `UserPersonalizationCorpus`). When a user adds a note, the note is stored per-user and retrieved by keyword at query time. To also have those notes flow into the object graph, run the reparse CLI with `--source hub/user-personalization/<userId>/notes/*.md`.
