# ZYNC Software Studio Foundation

Status: implementation foundation
Date: 2026-08-24
Owner: ZYNC Canvas -> Build
Surfaces: Coding | Design | Publish

## Product contract

ZYNC is the software-engineering workspace of ZCOS. It is not a chatbot or a replacement for professional developer tooling. ZAR remains the user-facing operator. ZYNC owns governed engineering execution and coordinates specialized engineering roles behind the ZAR relationship.

The studio collapses planning, architecture, implementation, verification, visual review, version control, deployment, documentation, project intelligence, and cross-project impact analysis into one continuous workspace.

## Studio model

Every ZYNC project can expose these working views without creating new ZCOS domains:

- Project Overview
- Architecture
- Chat
- Tasks
- Preview
- Code
- Files
- Logs
- Testing
- Database
- API Explorer
- Git
- Deployments
- Documentation
- Knowledge
- Memory
- Agent Activity

These are Build/project workspace views. They do not replace the seven shared ZCOS galaxy domains. ZYNC remains Canvas -> Build -> Coding | Design | Publish, consistent with the locked ZCOS architecture.

## Engineering loop

1. Receive typed engineering intent from ZAR/ZCOS.
2. Inspect repository structure, governing documentation, affected code, dependencies, conventions, current git state, and available verification commands.
3. Build an implementation plan with affected files, dependencies, risks, verification, and rollback points.
4. Execute the smallest complete change.
5. Rebuild continuously when a runnable project environment is attached.
6. Run compile, tests, lint, type safety, API-contract checks, migration validation, and runtime checks that the repository actually supports.
7. For significant UI work, capture rendered evidence, compare requested and actual appearance, inspect responsive behavior and motion, and self-correct when evidence is insufficient.
8. Group version-control changes logically and preserve exact execution evidence.
9. Publish/deploy only through configured, authorized integrations and verify the resulting deployment.
10. Return status and evidence through ZCOS to ZAR.

Compilation is necessary evidence, not sufficient evidence for UI correctness.

## Project intelligence

ZYNC maintains a living project model of architecture, patterns, dependencies, data flow, routing, state, providers, services, documentation, business rules, naming conventions, coding style, and approved UI language.

The project graph links components, pages, services, APIs, schemas, events, database tables, functions, packages, documentation, engineering roles, tests, deployments, and source repositories. It must support impact questions such as:

- What breaks if this service is removed?
- What depends on this API?
- Where is this state used?
- Which tests verify this component?
- Which deployments contain this change?

Graph evidence must preserve provenance. Inference must not be presented as a proven dependency.

## Cross-project intelligence

ZYNC extends project intelligence across authorized ZCOS projects. A cross-project graph records shared services, packages, schemas, authentication boundaries, design systems, APIs, deployment dependencies, and explicit project relationships.

Before changing a shared resource, ZYNC should resolve affected projects and return:

- directly dependent projects;
- transitively dependent projects where evidence exists;
- relationship type and source evidence;
- compatibility risk;
- required project-specific verification;
- coordinated rollout or rollback order.

Cross-project access remains scoped by ZCOS Admin Access. Presence in the graph does not grant repository or project authority.

## Engineering Constitution

Every project has a versioned Engineering Constitution. At minimum:

- inspect before modifying;
- preserve approved UI unless a design change is requested;
- preserve architecture when possible;
- extend working systems before replacing them;
- respect repository conventions;
- minimize unrelated changes;
- protect production stability;
- never claim verification that was not executed;
- retain errors, blockers, partial effects, and recovery evidence.

Project-specific rules may add constraints but cannot override ZCOS authorization or security policy.

## Design and visual reasoning

Approved interfaces become design-memory evidence for the project. ZYNC records approved spacing, typography, layout, motion, interaction patterns, components, and design language with provenance to the approved artifact/version.

Design inspection should connect a rendered element to its component, source file, styles, dependencies, tests, and relevant design-memory evidence.

Visual diff is a first-class verification result, not a substitute for semantic/accessibility/runtime testing.

## Live preview

When an executable development environment is available, ZYNC watches relevant changes, rebuilds, streams build/runtime state, and refreshes the preview automatically. A preview must report its source revision and runtime status so the user can distinguish a current preview from stale output.

## Continuous verification

Verification jobs are repository-derived and allowlisted. Results preserve command, working directory, exit code, stdout/stderr, duration, source revision, and timestamp.

ZYNC may attempt bounded self-repair. Every repair attempt remains visible in Agent Activity and must stop on changed scope, unsafe side effects, exhausted retry policy, or missing authority.

## Git intelligence

Git operations are an implementation service, not a separate user workflow. ZYNC can prepare branches, commits, diffs, conflict analysis, pull requests, merge recommendations, rollback points, and repository-history explanations.

Automation must never erase provenance. Destructive or ambiguous operations require the applicable ZCOS/ZENA authorization policy.

## Engineering roles

ZYNC can coordinate specialized roles such as Architect, Planner, Frontend, Backend, Database, Infrastructure, DevOps, Designer, Accessibility, QA, Security, Performance, Documentation, and Deployment.

These are engineering roles, not independent user-facing personalities. They share governed project context and activity records. The user continues to communicate through ZAR.

## Development timeline

Each project maintains an append-only evolution view for major milestones, architectural decisions, design approvals, feature changes, verification results, deployments, and rollback points. Timeline entries link back to commits, artifacts, tasks, evidence, and deployments where available.

## External tooling

External developer tools are connected through ZCOS Settings -> Integrations and scoped capability grants. ZYNC can integrate with source control, editors, containers, databases, hosting/deployment providers, design tools, API clients, browser automation, terminals, package managers, and infrastructure platforms without making those providers the system authority.

## Initial runtime expansion

The existing ZyncCodingOperatorService is the seed implementation. Its current repository scan, code search, impact review, verification runner, and GitHub branch checks remain reusable. The next runtime layer adds:

- engineering-plan generation from repository evidence;
- project manifest and Engineering Constitution loading;
- relationship-graph records and impact traversal;
- cross-project manifest/relationship registry;
- timeline/event records;
- visual-verification contracts;
- live-preview session contracts;
- typed agent-activity records.

This foundation is additive and must not redesign existing ZCOS/ZAR UI.
