# Knowledge Curation and Evolution Engine

## Objective

The Knowledge Curation and Evolution Engine maintains the quality, accuracy, organization, and long-term evolution of ZAR's knowledge.

ZAR should not simply accumulate information. It should continuously improve knowledge so the graph becomes cleaner, more connected, and more reliable with every interaction.

## Position In The Memory System

This is the third active knowledge system:

1. Knowledge Ingestion Engine: learns from new inputs.
2. Context Engine: understands meaning, relevance, and situational context.
3. Knowledge Curation and Evolution Engine: acts on what was learned and understood to keep knowledge coherent over time.

The engine consumes ingestion outputs, context interpretations, user confirmations, source evidence, conversation history, agent outputs, and existing knowledge graph state.

## Runtime Implementation

The active backend implementation lives in `server/services/KnowledgeCurationEngine.ts` and is wired through `server/routes-modules/knowledge.ts`.

At server boot, `server/index.ts` starts the curation scheduler unless `ZED_KNOWLEDGE_CURATION_DISABLED=true` is set. The default interval is 6 hours and can be overridden with `ZED_KNOWLEDGE_CURATION_INTERVAL_MS`.

Runtime reports are written to:

- `hub/shared-memory/curation/latest-review.json`
- `hub/shared-memory/curation/review-history.jsonl`

Active endpoints:

- `GET /api/knowledge/curation/latest`: returns the latest persisted review.
- `POST /api/knowledge/curation/review`: runs an authenticated on-demand review.
- `POST /api/knowledge/curation/evaluate`: compares incoming knowledge against existing objects and classifies the effect.
- `GET /api/admin/knowledge/curation`: admin read-through endpoint that returns the latest report or runs one if none exists.

## Core Principle

Knowledge is a living system.

Every new piece of information should either:

- strengthen existing knowledge
- refine existing knowledge
- replace outdated knowledge
- create new knowledge
- generate questions that improve understanding

The engine should prefer refinement over accumulation when an existing object can be improved.

## Continuous Monitoring

The engine continuously monitors the knowledge graph for:

- duplicate objects
- weak relationships
- contradictions
- outdated information
- incomplete objects
- orphaned knowledge
- missing context
- missing evidence
- missing decisions
- low-confidence facts
- redundant concepts
- unorganized collections

Detected issues should become explicit curation candidates with reasons, evidence links, confidence, and recommended next action.

## Knowledge Health Score

Every knowledge object receives a dynamic health score. The score should be recalculated when evidence, relationships, confirmations, conflicts, or freshness change.

Health factors:

- Completeness: how much required object detail is present.
- Confidence: how strongly the system believes the object is accurate.
- Context depth: how well the object is explained and situated.
- Relationship density: how well the object connects to related objects.
- Source diversity: how many independent sources support it.
- Freshness: how recently it was updated or verified.
- Conflict count: how many unresolved contradictions affect it.
- Verification status: whether sources, agents, or the user have verified it.
- User confirmation: whether the user has approved or corrected it.

Suggested health bands:

- Strong: complete, connected, current, verified, and low-conflict.
- Acceptable: usable but missing some context, evidence, or relationships.
- Weak: low confidence, sparse relationships, missing rationale, or poor evidence.
- Needs review: stale, contradicted, incomplete, or awaiting user confirmation.
- Historical: preserved for lineage but no longer current canonical knowledge.

Objects with poor health become candidates for refinement, merging, clarification, or archival status.

## Continuous Refinement

Whenever new information arrives, the engine compares it against existing objects and determines whether it:

- confirms an object
- expands an object
- contradicts an object
- supersedes an object
- merges with an object
- replaces an object
- creates a new object
- raises a clarification question

The engine should never create duplicate knowledge when refinement is possible.

## Canonical Knowledge

Every concept should have one canonical object representing ZAR's current understanding.

Non-canonical material should be attached to the canonical object as one of:

- alias
- historical version
- rejected proposal
- archived draft
- supporting evidence
- conflicting evidence
- pending clarification

The canonical object must show why it is canonical, where it came from, how confident ZAR is, and what evidence or user confirmation supports it.

## Version History

Knowledge should evolve rather than disappear. Do not delete knowledge to resolve change.

Each meaningful update must preserve:

- original state
- updated state
- reason for change
- user clarification, when present
- supporting evidence
- timestamp
- confidence before
- confidence after
- affected relationships
- actor that proposed or applied the change

Version history should make it possible to answer how ZAR's understanding changed over time.

## Relationship Refinement

The engine continuously discovers and strengthens relationships.

A knowledge object may relate to:

- projects
- research
- people
- companies
- frameworks
- books
- ideas
- specifications
- agents
- workflows
- goals
- tasks
- learning paths
- previous conversations
- future roadmap items

Relationship confidence should improve when multiple sources, conversations, or user confirmations support the connection.

## Automatic Living Collections

The engine should generate and maintain living collections, including:

- Projects
- Research
- People
- Companies
- Frameworks
- Books
- Ideas
- Specifications
- Agents
- Workflows
- Goals
- Tasks
- Learning Paths

Collections are graph views, not separate disconnected knowledge stores. They update automatically as canonical objects and relationships change.

## Knowledge Aging

Older information must not be assumed correct.

Objects should be marked with one of these aging states:

- Recently Updated
- Stable
- Needs Review
- Potentially Outdated
- Historical

Aging should consider topic volatility, elapsed time, newer contradictory evidence, lack of recent verification, and whether the object affects active work.

## Learning Gaps

The engine actively identifies missing knowledge and generates recommended questions to close gaps.

Examples:

- This project has no documented objectives.
- This workflow has no owner.
- This decision has no rationale.
- This feature has no specification.
- This claim has no supporting evidence.
- This object has no relationship to an active project or goal.

Gap questions should be specific, answerable, and tied to the object they would improve.

## Cross-Domain Discovery

The engine should look for useful relationships across domains.

Examples:

- A concept learned from trading may improve business planning.
- A behavioral insight may improve product design.
- A research paper may influence multiple projects.
- A workflow pattern from one agent may improve another agent.

Cross-domain connections should be surfaced for review when confidence is moderate or the implication is strategically meaningful.

## User Confirmation Loop

The user remains the authority for major long-term knowledge changes.

Ask for confirmation before applying changes such as:

- promoting a major canonical replacement
- merging two high-value concepts
- marking a major concept historical
- resolving a high-impact contradiction
- changing a decision record
- assigning ownership, priority, or intent when not explicit

Example confirmation prompt:

```text
I found evidence that this concept replaces an earlier version. Would you like me to update the canonical record?
```

Minor refinements, added evidence, relationship suggestions, and low-risk metadata improvements may be staged automatically, but should remain auditable.

## Periodic Knowledge Reviews

The active scheduler runs background reviews that:

- strengthen weak objects
- merge duplicates
- identify outdated information
- recommend missing context
- summarize recent evolution
- surface unresolved contradictions
- propose stale-object review queues

Reviews produce compact reports that show what changed, what needs confirmation, and what knowledge is becoming less reliable.

## Success Criteria

At any point, ZAR should be able to answer:

- What do I know?
- Why do I believe it?
- How confident am I?
- Where did it come from?
- How has it changed?
- What still needs clarification?
- What knowledge is becoming outdated?

The target state is a self-maintaining knowledge ecosystem rather than a larger pile of documents.

## Implementation Notes

- Store curation metadata with or adjacent to each knowledge object.
- Preserve raw evidence and historical versions instead of overwriting them without lineage.
- Treat canonical objects, aliases, versions, rejected proposals, archived drafts, and evidence as different states in the same knowledge lifecycle.
- Integrate major confirmation requests with the existing approval queue pattern when implemented in the app.
- Keep generated collections as derived graph views so they cannot drift away from canonical objects.
- Prefer deterministic curation records for metadata, version history, and health scoring, even when LLMs assist with interpretation.
