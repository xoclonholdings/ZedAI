# ZAR UI Evolution — Knowledge-Centered Experience

## Purpose

Evolve ZAR away from a chatbot-first interface toward an operational intelligence workspace where **knowledge is the primary interface** and conversation is one tool inside it. This document is the audit + plan; implementation lands as follow-up PRs one stage at a time so no existing functionality regresses.

## Non-goals

- No product rewrite. Every existing service, API, agent, memory system, and business rule keeps working as it does today.
- No new placeholder systems. Every screen this doc proposes must be backed by existing data or existing endpoints.
- No parallel implementations. Where a component already exists (Knowledge tab, project store, approval queue), the evolution extends it — it doesn't fork it.

---

## 1. UI Audit — current shape

### Entry
- Login (`client/src/pages/login.tsx`) → Chat (`client/src/pages/chat.tsx`) by default.
- Admin panel at `/admin` with tabs: Settings, Integrations, Knowledge, Approvals, Logs, Security, Tools, Rules.

### Chat surface
- Sidebar: conversation list, workspace/project scope, agent-mode selector, mode chips.
- Main: message list, composer, dictation, response streaming.
- Right-hand session panel (files, analytics, quick actions).

### Admin surface
- Every tab now uses the plain-language SettingGroup/SettingRow/Segmented/SaveIndicator atoms (Settings, Integrations, Approvals, Logs are fully in the new style; Tools/Rules/Security/Knowledge headers switched but internals still use per-section widgets).

### Persistent objects that already exist
| Object | Where it lives today |
|---|---|
| Projects | `hub/shared-memory/projects/*`, project routes, `ProjectFilingStore` |
| Conversations | Neon Postgres + `ConversationDatabaseStorage` |
| Decisions | `hub/shared-memory/consensus/`, reflection engine |
| Tasks | Approval queue + Deferred scheduler + Task lifecycle manager |
| Memory objects | `hub/shared-memory/object-memory/graph.json` (via new reparse) |
| Personal notes | `hub/user-personalization/<userId>/notes/*.md` |
| Integrations | `hub/config/admin-settings.json` |
| Trading records | `hub/trading/paper-trades.json`, TradingStore |
| Runtime activity | `hub/logs/runtime.log`, TraceValidator |

Every object in the "Knowledge-Centered Navigation" list from the brief already has a backing store. **None of the new Home surface requires new data — only new views over existing data.**

---

## 2. Information Architecture Proposal

Two-mode shell:

```
┌─────────────────────────────────────────┐
│ Home (Knowledge Map)                    │  ← default landing (was Chat)
├─────────────────────────────────────────┤
│ Projects · Decisions · People · Memory  │  ← persistent object nav
│ Research · Tasks · Timeline · Discovery │
├─────────────────────────────────────────┤
│ Conversations (one tool, not the shell) │
├─────────────────────────────────────────┤
│ Admin (unchanged surface)               │
└─────────────────────────────────────────┘
```

- The current `/chat` route is preserved untouched. Conversations become an object type reachable from Home, not the default landing.
- The current `/admin` route is preserved untouched. It's the settings/observability plane.
- New `/` route becomes the Home / Knowledge Map.

### Object → route map (proposed)

| Route | View | Data source |
|---|---|---|
| `/` | Knowledge Map (Home) | Aggregates existing stores |
| `/projects` | Project list | `ProjectFilingStore` |
| `/projects/:id` | Project detail | ProjectFilingStore + related objects from object graph |
| `/decisions` | Decision timeline | `object-memory/graph.json` filtered by type=decision |
| `/decisions/:id` | Decision detail | ObjectGraph + related conversations |
| `/memory` | Memory browser | ObjectGraph (already-built), personalization corpus |
| `/tasks` | Task list | Approval queue + deferred scheduler + task lifecycle |
| `/research` | Research briefs | IntelligenceAgent output + WebSearch history |
| `/discovery` | Discovery feed | Curation engine + trace validator + memory conflicts |
| `/timeline` | Evolution view | Reflection engine + reparse-history.jsonl + event objects |
| `/conversations` | Conversation list (current chat sidebar as its own view) | ConversationDatabaseStorage |
| `/chat` | Current chat surface | Unchanged |

Every route above reads from a store that already exists. Nothing is fabricated.

---

## 3. User Flow Proposal

### First-visit flow (was: sign in → chat empty state)

1. Land on `/` (Knowledge Map).
2. See a canvas of the user's active work: 3 active projects, 5 recent decisions, 2 tasks waiting for approval, 1 unresolved question flagged by curation.
3. Tap any object → object detail. Object detail always offers "Talk to ZAR about this" as one action that opens a chat scoped to that object.

### Contextual intelligence flow (was: user picks agent)

- On a project detail page, the composer is pre-scoped to that project — no agent picker needed. If the project is tagged `finance`, Finance capabilities are available; if `research`, Research capabilities. This is a UI hint layer over the existing ManagerAgent — the router still decides, but the user isn't forced to.

### Discovery flow (was: no notifications)

- The Discovery Feed reads from `memory-conflicts.json`, `unresolved-questions.json`, and the trace validator to surface: "You have 2 memory conflicts to review", "3 open questions unresolved for >7d", "TraceValidator flagged 5 chat executions this week with missing selected agents." All backed by existing stores.

---

## 4. Incremental Implementation Plan

Every stage lands as its own PR, ships to main, and preserves every existing route.

### Stage 1 — Non-breaking scaffold (1 PR)
- Add new `/` Home route rendering a placeholder Knowledge Map that reads real data (project count, decision count, task count, activity summary) from existing APIs.
- Move current `/` behavior (redirect to chat) to remain accessible.
- **No existing route changes.** `/chat`, `/admin`, `/login` unchanged.
- Verify: existing user flows still work (chat still opens, admin still opens, auth still works).

### Stage 2 — Object routes (2-3 PRs)
- `/projects` list + `/projects/:id` detail using ProjectFilingStore.
- `/decisions` from object graph.
- `/tasks` from approval queue + deferred scheduler.
- Each route is additive. Chat / admin still work.

### Stage 3 — Relationships (1 PR)
- Object detail pages show "Related X" panels sourced from the object graph's relationships. Not a node graph; a scannable list of typed edges.

### Stage 4 — Discovery feed (1 PR)
- `/discovery` route reading from memory-conflicts.json, unresolved-questions.json, and trace-validation summaries.

### Stage 5 — Timeline (1 PR)
- `/timeline` route reading from reparse-history + reflection summaries + event objects.

### Stage 6 — Conversation surface as an object type (1 PR)
- `/conversations` route lists conversations as memory objects, with tags for related projects/decisions.
- Existing `/chat` route remains as the interactive view.

### Stage 7 — Contextual composer (1 PR)
- On object detail pages, embed the chat composer pre-scoped to the object.
- No agent picker; ManagerAgent handles routing as it does now.

### Stage 8 — Home becomes default (1 PR — reversible)
- Change post-login default route from `/chat` to `/`.
- Feature-flagged: env var `ZED_HOME_DEFAULT=true` gates it. Off by default until user opts in.

---

## 5. Preservation guarantees

Every stage above **preserves**:

- `/chat` route + all chat functionality
- `/admin` route + every admin tab
- All existing APIs (nothing removed, nothing renamed)
- All existing agents (Operations, Intelligence, Business, Finance)
- All existing memory systems (foundation, personalization, object memory, project memory, scratchpad, retrieved)
- All existing approval / execution / self-repair layers
- All existing subsystems (trading, workflow, operational)

The only thing that changes for users who don't opt in to Stage 8: they see new object routes as additive nav — nothing they used before disappears.

## 6. Mobile-first constraints

- iPhone-14-sized viewport (390px) as the primary design target.
- Every list is a single column of rows (SettingRow pattern) not a card grid.
- Progressive disclosure over information density: collapsed groups, expand-on-tap details.
- Sticky bottom action bar for object detail pages (Talk about this / Take action).

## 7. Data-truthiness checklist for every new view

Before any new view merges, the PR must confirm each panel is one of:

- Read from an existing store with no fabrication
- Derived deterministically from stored data
- Explicitly labeled "empty state" when no data exists

No view may show mocked or invented data.

## 8. Success criteria

The evolution is complete when:

- A first-time user lands on Home and can see their operational state without opening chat.
- Every persistent object type (projects, decisions, tasks, memory, integrations, conversations) has a first-class view.
- Contextual capabilities surface naturally based on where the user is (finance → finance tools available) without forcing agent selection.
- Discovery Feed surfaces real insights from real stored data.
- Every existing route and workflow still functions unchanged.
